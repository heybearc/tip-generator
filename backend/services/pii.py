"""
PII pseudonymization service using Microsoft Presidio + spaCy.

Scrub phase  : replace PII with {{ENTITY_TYPE_N}} tokens before sending to Claude.
Restore phase: substitute tokens back after Claude returns the generated TIP.

Mapping stored in draft_pii_maps (JSONB) keyed by draft_id.
"""
import json
import re
from typing import Optional
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Lazy-load Presidio to avoid import cost when PII scrubbing is not enabled
# ---------------------------------------------------------------------------
_analyzer = None
_anonymizer = None
_engine_lock = None


def _get_engines():
    global _analyzer, _anonymizer, _engine_lock
    import threading
    if _engine_lock is None:
        _engine_lock = threading.Lock()
    if _analyzer is None:
        with _engine_lock:
            if _analyzer is None:  # double-checked locking
                from presidio_analyzer import AnalyzerEngine
                from presidio_analyzer.nlp_engine import NlpEngineProvider
                from presidio_anonymizer import AnonymizerEngine

                provider = NlpEngineProvider(nlp_configuration={
                    "nlp_engine_name": "spacy",
                    "models": [{"lang_code": "en", "model_name": "en_core_web_lg"}],
                })
                _analyzer = AnalyzerEngine(nlp_engine=provider.create_engine())
                _anonymizer = AnonymizerEngine()
    return _analyzer, _anonymizer


# Entity types to detect — ordered roughly by specificity
ENTITY_TYPES = [
    "IP_ADDRESS",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "URL",
    "DOMAIN_NAME",
    "PERSON",
    "ORGANIZATION",
    "LOCATION",
    "DATE_TIME",
    "NRP",               # Nationalities, religions, political groups
    "MEDICAL_LICENSE",
    "CRYPTO",
    "IBAN_CODE",
    "CREDIT_CARD",
    "US_SSN",
    "US_DRIVER_LICENSE",
]

# Regex patterns for things Presidio may miss in structured text
_EXTRA_PATTERNS = [
    # MAC addresses
    (re.compile(r'\b([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}\b'), "MAC_ADDRESS"),
    # VLAN IDs (e.g. VLAN 100, vlan100)
    (re.compile(r'\bVLAN\s*(\d{1,4})\b', re.IGNORECASE), "VLAN_ID"),
    # Subnet masks / CIDR
    (re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}/\d{1,2}\b'), "IP_ADDRESS"),
    # Hostnames (word.word.word pattern — catches FQDNs missed by URL detector)
    (re.compile(r'\b(?:[a-zA-Z0-9\-]+\.){2,}[a-zA-Z]{2,}\b'), "DOMAIN_NAME"),
]


def scrub(text: str, draft_id: int, db: Session) -> str:
    """
    Detect PII in text, replace with tokens, persist mapping to DB.
    Returns scrubbed text safe to send to Claude.
    """
    from models.draft import DraftPIIMap

    analyzer, _ = _get_engines()

    results = analyzer.analyze(text=text, language="en", entities=ENTITY_TYPES)

    # Sort by start position descending so we can replace without offset drift
    results = sorted(results, key=lambda r: r.start, reverse=True)

    pii_map: dict[str, str] = {}
    counters: dict[str, int] = {}
    scrubbed = text

    for result in results:
        original = text[result.start:result.end]
        # Deduplicate — same value gets same token
        existing_token = next((k for k, v in pii_map.items() if v == original), None)
        if existing_token:
            token = existing_token
        else:
            entity = result.entity_type
            counters[entity] = counters.get(entity, 0) + 1
            token = f"{{{{{entity}_{counters[entity]}}}}}"
            pii_map[token] = original

        scrubbed = scrubbed[:result.start] + token + scrubbed[result.end:]

    # Apply extra regex patterns on the scrubbed text (won't double-replace tokens)
    for pattern, label in _EXTRA_PATTERNS:
        for match in sorted(pattern.finditer(scrubbed), key=lambda m: m.start(), reverse=True):
            original = match.group(0)
            if original.startswith("{{"):
                continue  # already tokenized
            existing_token = next((k for k, v in pii_map.items() if v == original), None)
            if existing_token:
                token = existing_token
            else:
                counters[label] = counters.get(label, 0) + 1
                token = f"{{{{{label}_{counters[label]}}}}}"
                pii_map[token] = original
            scrubbed = scrubbed[:match.start()] + token + scrubbed[match.end():]

    # Persist / update map in DB
    existing = db.query(DraftPIIMap).filter(DraftPIIMap.draft_id == draft_id).first()
    if existing:
        merged = json.loads(existing.pii_map) if isinstance(existing.pii_map, str) else existing.pii_map
        merged.update(pii_map)
        existing.pii_map = merged
    else:
        db.add(DraftPIIMap(draft_id=draft_id, pii_map=pii_map))
    db.commit()

    token_count = len(pii_map)
    print(f"[pii] scrubbed {token_count} PII tokens from draft {draft_id}")
    return scrubbed


def restore(text: str, draft_id: int, db: Session) -> str:
    """
    Replace all {{TOKEN}} placeholders back with original PII values.
    """
    from models.draft import DraftPIIMap

    row = db.query(DraftPIIMap).filter(DraftPIIMap.draft_id == draft_id).first()
    if not row:
        return text

    pii_map = row.pii_map if isinstance(row.pii_map, dict) else json.loads(row.pii_map)

    restored = text
    # Sort longest token first to avoid partial substitution collisions
    for token, original in sorted(pii_map.items(), key=lambda x: len(x[0]), reverse=True):
        restored = restored.replace(token, original)

    missing = re.findall(r'\{\{[A-Z_]+_\d+\}\}', restored)
    if missing:
        print(f"[pii] WARNING: {len(missing)} tokens not restored for draft {draft_id}: {missing[:5]}")

    return restored


def clear_map(draft_id: int, db: Session) -> None:
    """Delete PII map for a draft (e.g. after successful restore and storage)."""
    from models.draft import DraftPIIMap
    db.query(DraftPIIMap).filter(DraftPIIMap.draft_id == draft_id).delete()
    db.commit()
