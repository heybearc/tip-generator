"""
Claude API service for TIP generation
"""
import os
import json
from typing import Optional, Dict, Any, List
from anthropic import Anthropic
from sqlalchemy.orm import Session
from models.draft import Draft, DraftStatus
from models.document import Document

# Approximate token budget thresholds
# Claude Sonnet context window is ~200k tokens but we keep prompts lean.
# 1 token ≈ 4 chars — we target prompts under ~60k tokens (240k chars).
SINGLE_PASS_CHAR_LIMIT = 40_000   # Combined doc text under this → single pass
SECTION_CHUNK_SIZE = 5            # Sections per chunk in chunked mode

# Sections that are cover-page / structural placeholders — skip entirely from prompt and output
SKIP_SECTION_TITLES = {
    "technical implementation plan",
    "document end",
    "template usage guide",
}

# Sections to move to the front of the generated output
FRONT_SECTIONS = ["executive summary"]

# ── Prompt caching ───────────────────────────────────────────────────────────
# SYSTEM_PREAMBLE is identical on every generation call — marked cache_control=ephemeral.
# Anthropic caches this block for up to 5 min, charging ~10% of normal input token price
# on cache hits. Applied to: generation (single-pass + chunked), refine-guided, refine-all.
SYSTEM_PREAMBLE = (
    "You are an expert technical writer creating Technical Implementation Plans (TIPs) "
    "for Thrive Networks, a Managed Service Provider. "
    "You write professional, precise, engineer-grade documentation. "
    "You ONLY use facts from the source documents provided — never invent names, IPs, dates, or details. "
    "Where data is missing write [DATA NEEDED: description].\n\n"
    "CRITICAL RULES:\n"
    "- Do NOT generate a 'Risk Register' section — it is not part of this template.\n"
    "- Do NOT include a Service Order callout block (no **Service Order:**, **Prepared by:**, **Date:** header lines).\n"
    "- PILLAR STRUCTURE: When the template uses Pillars, generate each Pillar with:\n"
    "  * A clear Pillar heading (e.g. ## Pillar 1: Network & Infrastructure)\n"
    "  * Preconditions — hard go/no-go gates as a bullet list\n"
    "  * Phase steps — numbered steps per phase sub-section\n"
    "  * Acceptance Checklist — checkbox items (use - [ ] prefix) for sign-off\n"
    "  * Generate as many Pillars as the project scope requires (typically 4-6)\n"
    "  * Name each Pillar after the technology area it covers\n"
    "- Implementation Details / Phase Steps: numbered steps in sufficient detail for another engineer to follow. "
    "Only use Option A/B sub-headings when genuinely multiple distinct approaches exist.\n"
    "- Include relevant vendor documentation links in technical sections where applicable.\n"
    "- Risks and Contingencies: 4-column markdown table: | Risk | Likelihood | Mitigation Strategy | Rollback Plan |\n"
    "- Acceptance Criteria: 3-column markdown table: | # | Acceptance Criterion | Verification Method |\n"
    "- Deliverables: 4-column markdown table: | # | Deliverable | Description | Expected Date |\n"
    "- Approximate Timing: table showing each Pillar/phase, estimated start, duration, dependencies.\n"
    "- Site Mapping: table with columns: Site Name | Location | Role (Source/Target) | Primary Contact.\n"
    "- Open Items: table with columns: Item | Pillar Blocked | Customer Owner | Status.\n"
    "- SERVER/VM INVENTORY: markdown table: | Hostname | Role | OS | vCPU | RAM (GB) | Disk (GB) | Notes |\n"
    "- IP/VLAN/NETWORK data: markdown table — never list IPs as prose bullets.\n"
    "- FIREWALL RULES: table: | Rule | Source | Destination | Port/Protocol | Action |\n"
    "- Any tabular data from source documents MUST be rendered as a markdown table.\n"
    "- Numbered lists restart at 1 for each new section or sub-section.\n"
    "- Template Usage Guide: SKIP — do not output it.\n"
    "- Appendix A (Server Inventory): populate from source documents, one table per site.\n"
    "- Appendix B (Risk Reference): author reference only — will be removed before delivery.\n"
)


class ClaudeService:
    """Service for interacting with Claude API"""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key
        self.model = model or os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5")
        self.max_tokens = int(os.getenv("CLAUDE_MAX_TOKENS", "8000"))

        if not self.api_key:
            raise ValueError("No Claude API key configured. Add your Anthropic API key in your profile settings.")

        self.client = Anthropic(
            api_key=self.api_key,
            default_headers={"X-Anthropic-Do-Not-Store": "true"},
        )

    def _doc_text(self, doc: Optional[Document]) -> str:
        """Return extracted text or empty string."""
        return (doc.extracted_text or "") if doc else ""

    def _combined_doc_size(
        self,
        discovery_doc: Optional[Document],
        service_order_doc: Optional[Document]
    ) -> int:
        return len(self._doc_text(discovery_doc)) + len(self._doc_text(service_order_doc))

    async def generate_tip(
        self,
        draft: Draft,
        discovery_doc: Optional[Document],
        service_order_doc: Optional[Document],
        db: Session,
        template_structure: Optional[Dict[str, Any]] = None,
        library_examples: Optional[List[Dict[str, str]]] = None,
        supplemental_docs: Optional[List[Document]] = None,
    ) -> Draft:
        """
        Generate TIP using Claude API.
        Automatically switches to chunked section-by-section generation when
        combined document text exceeds SINGLE_PASS_CHAR_LIMIT.
        """
        draft.status = DraftStatus.GENERATING
        db.commit()

        try:
            doc_size = self._combined_doc_size(discovery_doc, service_order_doc)
            use_chunked = (
                doc_size > SINGLE_PASS_CHAR_LIMIT
                and template_structure
                and template_structure.get("sections")
            )

            if use_chunked:
                generated_content, total_tokens = await self._generate_chunked(
                    draft, discovery_doc, service_order_doc, template_structure, db,
                    library_examples=library_examples,
                    supplemental_docs=supplemental_docs,
                )
            else:
                prompt = self._build_prompt(
                    draft, discovery_doc, service_order_doc, template_structure,
                    library_examples=library_examples,
                    supplemental_docs=supplemental_docs,
                )
                draft.generation_prompt = f"[SINGLE PASS: {doc_size} chars]"
                db.commit()
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    system=[
                        {
                            "type": "text",
                            "text": SYSTEM_PREAMBLE,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    messages=[{"role": "user", "content": prompt}]
                )
                generated_content = response.content[0].text
                total_tokens = response.usage.output_tokens

            from datetime import datetime, date

            # Post-process: stamp Revision History with correct date and author
            author_name = "Thrive"
            if db:
                try:
                    from models.user import User as UserModel
                    user = db.query(UserModel).filter(UserModel.id == draft.user_id).first()
                    if user:
                        author_name = user.full_name or user.username
                except Exception:
                    pass
            today_str = date.today().strftime("%B %d, %Y")
            generated_content = self._fix_revision_history(generated_content, author_name, today_str)
            generated_content = self._post_process_content(generated_content, draft.title)

            draft.content = generated_content
            draft.status = DraftStatus.COMPLETED
            draft.claude_model = self.model
            draft.generation_tokens = total_tokens
            draft.sections = self._parse_sections(generated_content, template_structure)
            draft.generated_at = datetime.utcnow()

            db.commit()
            db.refresh(draft)
            return draft

        except Exception as e:
            draft.status = DraftStatus.FAILED
            draft.content = f"Error generating TIP: {str(e)}"
            db.commit()
            raise

    async def _generate_chunked(
        self,
        draft: Draft,
        discovery_doc: Optional[Document],
        service_order_doc: Optional[Document],
        template_structure: Dict[str, Any],
        db: Optional[Session] = None,
        library_examples: Optional[List[Dict[str, str]]] = None,
        supplemental_docs: Optional[List[Document]] = None,
    ) -> tuple:
        """
        Generate TIP section by section when documents are large.
        Splits template sections into chunks of SECTION_CHUNK_SIZE and calls
        Claude once per chunk, passing the full document text each time but
        asking only for a subset of sections. Assembles results into one document.
        Writes chunk progress to draft.generation_prompt after each call.
        """
        raw_sections = template_structure.get("sections", [])
        instructions = template_structure.get("instructions", [])

        # Build instruction lookup by section title
        instruction_map: Dict[str, List[str]] = {}
        for inst in instructions:
            sec = inst.get("section", "")
            instruction_map.setdefault(sec, []).append(inst["text"])

        # Filter cover-page/structural placeholder sections
        sections = [
            s for s in raw_sections
            if s.get("title", "").strip().lower() not in SKIP_SECTION_TITLES
        ]

        # Also skip any H2 whose title matches the draft title (cover-page TIP name heading)
        draft_title_lower = (draft.title or "").strip().lower()
        if draft_title_lower:
            sections = [
                s for s in sections
                if not (s.get("level") == 2 and s.get("title", "").strip().lower() == draft_title_lower)
            ]

        # Reorder: bring FRONT_SECTIONS to the top (after any H1)
        front = [s for s in sections if s.get("title", "").strip().lower() in FRONT_SECTIONS]
        rest  = [s for s in sections if s.get("title", "").strip().lower() not in FRONT_SECTIONS]
        sections = front + rest

        # Prepare document text — full text, no truncation per chunk
        discovery_text = self._doc_text(discovery_doc)
        service_order_text = self._doc_text(service_order_doc)
        supplemental_texts = [
            (d.original_filename, d.extracted_text)
            for d in (supplemental_docs or [])
            if d and d.extracted_text
        ]

        # Separate appendix sections (H1 Appendix*) from body — they go last
        body_sections  = [s for s in sections if not s.get("title", "").strip().lower().startswith("appendix")]
        appendix_sections = [s for s in sections if s.get("title", "").strip().lower().startswith("appendix")]

        # Split body into chunks; appendix sections go in their own final chunk
        body_chunks = [
            body_sections[i:i + SECTION_CHUNK_SIZE]
            for i in range(0, len(body_sections), SECTION_CHUNK_SIZE)
        ]

        # Dedicated pillar chunks: 3 pillars per pass, injected after body, before appendix
        # We don't know the pillar count yet — use 2 passes to cover up to 6 pillars
        pillar_chunks = [{"_pillar_pass": True, "_pillar_batch": 1, "_pillar_offset": 0},
                         {"_pillar_pass": True, "_pillar_batch": 2, "_pillar_offset": 3}]

        chunks = body_chunks + [[p] for p in pillar_chunks]
        if appendix_sections:
            chunks += [appendix_sections[i:i + SECTION_CHUNK_SIZE]
                       for i in range(0, len(appendix_sections), SECTION_CHUNK_SIZE)]
        total_chunks = len(chunks)

        all_content_parts: List[str] = []
        total_tokens = 0

        for chunk_idx, chunk in enumerate(chunks):
            # Check if draft was cancelled between chunks — bail out cleanly
            if db:
                db.refresh(draft)
                if draft.status == DraftStatus.FAILED:
                    raise Exception("Generation cancelled by user")

            is_pillar_pass = len(chunk) == 1 and chunk[0].get("_pillar_pass")
            pillar_offset = chunk[0].get("_pillar_offset", 0) if is_pillar_pass else 0
            pillar_batch  = chunk[0].get("_pillar_batch", 1) if is_pillar_pass else 1

            # Write progress before each call so the UI can show it
            if db:
                draft.generation_prompt = json.dumps({
                    "mode": "chunked",
                    "chunk": chunk_idx + 1,
                    "total_chunks": total_chunks,
                    "sections": len(sections),
                })
                db.commit()
                try:
                    from services.audit import log as audit_log
                    section_titles = ["[pillar pass]"] if is_pillar_pass else [s.get("title", "") for s in chunk if s.get("title")]
                    audit_log(db, draft.id, "batch_start", {
                        "sections": section_titles,
                    }, batch_index=chunk_idx + 1, total_batches=total_chunks)
                except Exception:
                    pass

            # Dedicated pillar generation pass
            if is_pillar_pass:
                prompt = self._build_pillar_prompt(
                    draft=draft,
                    discovery_text=discovery_text,
                    service_order_text=service_order_text,
                    supplemental_texts=supplemental_texts,
                    library_examples=library_examples,
                    pillar_offset=pillar_offset,
                    pillar_batch=pillar_batch,
                )
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    system=[{"type": "text", "text": SYSTEM_PREAMBLE, "cache_control": {"type": "ephemeral"}}],
                    messages=[{"role": "user", "content": prompt}]
                )
                chunk_tokens = response.usage.output_tokens
                all_content_parts.append(response.content[0].text.strip())
                total_tokens += chunk_tokens
                if db:
                    try:
                        from services.audit import log as audit_log
                        audit_log(db, draft.id, "claude_call", {
                            "output_tokens": chunk_tokens, "model": self.model, "pass": "pillars",
                        }, batch_index=chunk_idx + 1, total_batches=total_chunks)
                    except Exception:
                        pass
                continue

            # Retrieve RAG chunks for sections in this batch
            rag_chunks = []
            if db:
                try:
                    from services.embedding import retrieve_relevant_chunks
                    section_titles = [s.get("title", "") for s in chunk if s.get("title")]
                    query = f"{draft.title} " + " ".join(section_titles)
                    for section_title in section_titles:
                        hits = retrieve_relevant_chunks(query, section_title, db, top_k=2)
                        for hit in hits:
                            rag_chunks.append({
                                "section_title": hit.section_title,
                                "content": hit.content,
                                "source": hit.library_doc.title if hit.library_doc else "library",
                            })
                    if rag_chunks:
                        print(f"[generate] RAG injected {len(rag_chunks)} chunks for chunk {chunk_idx + 1}")
                        try:
                            from services.audit import log as audit_log
                            audit_log(db, draft.id, "rag_inject", {
                                "chunks_injected": len(rag_chunks),
                                "sources": [c["source"] for c in rag_chunks],
                            }, batch_index=chunk_idx + 1, total_batches=total_chunks)
                        except Exception:
                            pass
                except Exception as e:
                    print(f"[generate] RAG retrieval skipped: {e}")

            prompt = self._build_chunk_prompt(
                draft=draft,
                discovery_text=discovery_text,
                service_order_text=service_order_text,
                sections_chunk=chunk,
                instruction_map=instruction_map,
                chunk_index=chunk_idx,
                total_chunks=total_chunks,
                library_examples=library_examples,
                supplemental_texts=supplemental_texts,
                rag_chunks=rag_chunks or None,
            )

            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PREAMBLE,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": prompt}]
            )

            chunk_tokens = response.usage.output_tokens
            all_content_parts.append(response.content[0].text.strip())
            total_tokens += chunk_tokens

            if db:
                try:
                    from services.audit import log as audit_log
                    audit_log(db, draft.id, "claude_call", {
                        "output_tokens": chunk_tokens,
                        "model": self.model,
                    }, batch_index=chunk_idx + 1, total_batches=total_chunks)
                except Exception:
                    pass

        return "\n\n".join(all_content_parts), total_tokens

    def _post_process_content(self, content: str, draft_title: str) -> str:
        """
        Strip cover-page sections and structural placeholders from generated output.
        Applied to both single-pass and chunked generation results.
        """
        import re
        # Strip H1 cover heading
        content = re.sub(r'^# Technical Implementation Plan\s*\n', '', content, flags=re.MULTILINE)
        # Strip H2 TIP-name subtitle (e.g. "## DialConnection LLC — ThriveCloud Migration")
        if draft_title:
            escaped = re.escape(draft_title.strip())
            content = re.sub(rf'^## {escaped}.*\n', '', content, flags=re.MULTILINE)
        # Strip any H2 that ends with "Technical Implementation Plan" or "— ThriveCloud Migration"
        content = re.sub(r'^## .+(?:Technical Implementation Plan|ThriveCloud Migration)\s*\n', '', content, flags=re.MULTILINE)
        # Strip Document End section and everything after
        content = re.sub(r'^# Document End.*', '', content, flags=re.MULTILINE | re.DOTALL)
        # Collapse 3+ blank lines
        content = re.sub(r'\n{3,}', '\n\n', content)
        return content.strip()

    def _build_pillar_prompt(
        self,
        draft: Draft,
        discovery_text: str,
        service_order_text: str,
        supplemental_texts: Optional[List[tuple]] = None,
        library_examples: Optional[List[Dict[str, str]]] = None,
        pillar_offset: int = 0,
        pillar_batch: int = 1,
    ) -> str:
        """
        Build a prompt for generating 3 Pillar sections (one batch of pillars).
        pillar_offset: 0 = pillars 1-3, 3 = pillars 4-6.
        """
        start_num = pillar_offset + 1
        end_num   = pillar_offset + 3
        parts = []
        parts.append(
            f"Generate Pillars {start_num} through {end_num} for this TIP (batch {pillar_batch} of 2).\n"
            f"Number pillars starting at {start_num}. Each Pillar covers one technology area.\n"
            "For EACH Pillar output exactly:\n"
            f"  ## Pillar {start_num}: [Technology Area]\n"
            "  ### Preconditions\n"
            "  - bullet list of hard go/no-go gates\n"
            "  ### Phase N.1: [Phase Name]\n"
            "  1. numbered implementation steps\n"
            "  ### Acceptance Checklist — Pillar N\n"
            "  - [ ] checkbox items\n\n"
            f"Output ALL THREE pillars ({start_num}, {start_num+1}, {end_num}). "
            "If fewer than 3 pillars remain in scope, generate only those that apply. "
            "Use ONLY facts from the source documents. "
            "Where data is missing write [DATA NEEDED: description].\n\n"
        )
        if discovery_text:
            parts.append("=== DISCOVERY WORKSHEET ===\n")
            parts.append(discovery_text)
            parts.append("\n\n")
        if service_order_text:
            parts.append("=== SERVICE ORDER ===\n")
            parts.append(service_order_text)
            parts.append("\n\n")
        for fname, ftext in (supplemental_texts or []):
            parts.append(f"=== SUPPLEMENTAL DOCUMENT: {fname} ===\n")
            parts.append(ftext)
            parts.append("\n\n")
        if draft.description:
            parts.append(f"=== ADDITIONAL CONTEXT ===\n{draft.description}\n\n")
        if library_examples:
            parts.append(self._build_examples_block(library_examples))
        parts.append("Generate ALL Pillar sections now. Output markdown only.\n")
        return "".join(parts)

    def _build_chunk_prompt(
        self,
        draft: Draft,
        discovery_text: str,
        service_order_text: str,
        sections_chunk: List[Dict],
        instruction_map: Dict[str, List[str]],
        chunk_index: int,
        total_chunks: int,
        library_examples: Optional[List[Dict[str, str]]] = None,
        supplemental_texts: Optional[List[tuple]] = None,
        rag_chunks: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Build a prompt for a single chunk of template sections.
        Includes full document context but asks only for the given sections.
        """
        parts = []

        parts.append(
            f"This is part {chunk_index + 1} of {total_chunks} — generate ONLY the sections listed below.\n"
            "Use ONLY facts from the source documents. Where data is missing write [DATA NEEDED: description].\n\n"
        )

        SKIP_SECTIONS = {"template usage guide"}

        if discovery_text:
            # For large documents, include full text but clearly delimited
            parts.append("=== DISCOVERY WORKSHEET ===\n")
            parts.append(discovery_text)
            parts.append("\n\n")

        if service_order_text:
            parts.append("=== SERVICE ORDER ===\n")
            parts.append(service_order_text)
            parts.append("\n\n")

        for fname, ftext in (supplemental_texts or []):
            parts.append(f"=== SUPPLEMENTAL DOCUMENT: {fname} ===\n")
            parts.append(ftext)
            parts.append("\n\n")

        if draft.description:
            parts.append(f"=== ADDITIONAL CONTEXT ===\n{draft.description}\n\n")

        if library_examples:
            parts.append(self._build_examples_block(library_examples))

        if rag_chunks:
            parts.append(self._build_rag_block(rag_chunks))

        parts.append("=== SECTIONS TO GENERATE NOW ===\n\n")

        for section in sections_chunk:
            level = section.get("level", 1)
            title = section.get("title", "").strip()
            content = section.get("content", "").strip()

            if title.lower() in SKIP_SECTIONS:
                continue

            heading_prefix = "#" * level
            parts.append(f"{heading_prefix} {title}\n")
            if content:
                parts.append(f"{content}\n")
            for inst_text in instruction_map.get(title, []):
                parts.append(f"[INSTRUCTION: {inst_text}]\n")
            parts.append("\n")

        parts.append(
            "Generate ONLY the sections listed above. "
            "Use exact heading names. Do not add sections not listed.\n"
        )

        return "".join(parts)

    def _build_examples_block(
        self,
        examples: List[Dict[str, str]],
        max_chars_per_example: int = 8000,
    ) -> str:
        """
        Build a few-shot reference block from approved library TIPs.
        Caps each example to max_chars_per_example to protect context budget.
        examples: list of {"title": str, "category": str, "text": str}
        """
        if not examples:
            return ""
        parts = [
            "=== REFERENCE EXAMPLES ===\n"
            "The following are approved, real-world TIPs from the library. "
            "Use them as style and structure references ONLY — "
            "do NOT copy their content, client names, or specific data.\n\n"
        ]
        for i, ex in enumerate(examples, 1):
            title = ex.get("title", f"Example {i}")
            category = ex.get("category", "")
            text = ex.get("text", "")
            if len(text) > max_chars_per_example:
                text = text[:max_chars_per_example] + "\n[...truncated for brevity...]"
            parts.append(f"--- Reference TIP {i}: {title} ({category}) ---\n")
            parts.append(text.strip())
            parts.append("\n\n")
        parts.append("=== END REFERENCE EXAMPLES ===\n\n")
        return "".join(parts)

    def _build_rag_block(self, rag_chunks: List[Dict[str, str]]) -> str:
        """
        Build an authoritative playbook injection block from retrieved section chunks.
        rag_chunks: list of {"section_title": str, "content": str, "source": str}
        """
        if not rag_chunks:
            return ""
        parts = [
            "=== THRIVE PLAYBOOK (AUTHORITATIVE) ===\n"
            "The following are Thrive's standard processes for this technology area. "
            "Use them as authoritative content — incorporate their steps, naming, and structure "
            "into the relevant sections below. Adapt specifics to the customer data.\n\n"
        ]
        for chunk in rag_chunks:
            parts.append(f"--- Playbook: {chunk['section_title']} (from: {chunk['source']}) ---\n")
            parts.append(chunk["content"].strip())
            parts.append("\n\n")
        parts.append("=== END THRIVE PLAYBOOK ===\n\n")
        return "".join(parts)

    def _build_prompt(
        self,
        draft: Draft,
        discovery_doc: Optional[Document],
        service_order_doc: Optional[Document],
        template_structure: Optional[Dict[str, Any]] = None,
        library_examples: Optional[List[Dict[str, str]]] = None,
        supplemental_docs: Optional[List[Document]] = None,
    ) -> str:
        """
        Build a template-aware prompt for Claude.

        When a parsed template structure is available, the prompt instructs Claude
        to populate each section using the template instructions and the extracted
        document content. When no template is available it falls back to a generic
        TIP structure so the endpoint never fails.
        """
        parts = []
        # System preamble is passed as a cached system block — not repeated in user message

        # ── Source documents ─────────────────────────────────────────────────
        if discovery_doc and discovery_doc.extracted_text:
            parts.append("=== DISCOVERY WORKSHEET ===\n")
            parts.append(discovery_doc.extracted_text)  # Full text — no truncation
            parts.append("\n\n")

        if service_order_doc and service_order_doc.extracted_text:
            parts.append("=== SERVICE ORDER ===\n")
            parts.append(service_order_doc.extracted_text)  # Full text — no truncation
            parts.append("\n\n")

        for d in (supplemental_docs or []):
            if d and d.extracted_text:
                parts.append(f"=== SUPPLEMENTAL DOCUMENT: {d.original_filename} ===\n")
                parts.append(d.extracted_text)
                parts.append("\n\n")

        if draft.description:
            parts.append(f"=== ADDITIONAL CONTEXT ===\n{draft.description}\n\n")

        if not discovery_doc and not service_order_doc:
            parts.append(
                "NOTE: No source documents were provided. Generate a TIP structure "
                "with placeholder text indicating where real data should be inserted.\n\n"
            )

        if library_examples:
            parts.append(self._build_examples_block(library_examples))

        # ── Template-guided instructions ─────────────────────────────────────
        if template_structure and template_structure.get("sections"):
            sections = template_structure["sections"]
            instructions = template_structure.get("instructions", [])

            # Build an instruction-to-section lookup
            instruction_map: Dict[str, List[str]] = {}
            for inst in instructions:
                sec = inst.get("section", "")
                instruction_map.setdefault(sec, []).append(inst["text"])

            parts.append(
                "=== YOUR TASK ===\n"
                "Generate the complete TIP document by populating each section below. "
                "Follow the [INSTRUCTION] notes embedded in each section — they are "
                "guidance for you and must NOT appear in your output. "
                "Use only facts from the source documents above. "
                "Where data is missing write [DATA NEEDED: description].\n\n"
                "Format output as a clean markdown document. Use heading names exactly as given. "
                "Do not add commentary or sections not listed.\n\n"
            )

            parts.append("=== TEMPLATE SECTIONS TO POPULATE ===\n\n")

            # Sections to skip entirely from output
            SKIP_SECTIONS = {"template usage guide"}

            for section in sections:
                level = section.get("level", 1)
                title = section.get("title", "").strip()
                content = section.get("content", "").strip()

                if title.lower() in SKIP_SECTIONS:
                    continue

                # Heading markers scaled to level
                heading_prefix = "#" * level
                parts.append(f"{heading_prefix} {title}\n")

                if content:
                    parts.append(f"{content}\n")

                # Any matching Claude instructions for this section
                for inst_text in instruction_map.get(title, []):
                    parts.append(f"[INSTRUCTION: {inst_text}]\n")

                parts.append("\n")

        else:
            # ── Fallback: generic TIP structure ──────────────────────────────
            parts.append(
                "=== YOUR TASK ===\n"
                "No template structure is available. Generate a comprehensive Pillar-based TIP "
                "using this standard structure. Populate each section from the source documents above.\n\n"
                "# Technical Implementation Plan\n"
                "## Project Overview\n"
                "## Revision History\n"
                "## Site Mapping\n"
                "## Executive Summary\n"
                "## Requirements / Prerequisites\n"
                "## Risks and Contingencies\n"
                "## Approximate Timing\n"
                "## Pillar 1: [Technology Area]\n"
                "## Pillar 2: [Technology Area]\n"
                "## Pillar 3: [Technology Area]\n"
                "## Open Items — Required from Customer\n"
                "## Day-1 Support\n"
                "## Acceptance Criteria\n"
                "## Deliverables\n"
                "# Appendix A: Server Inventory\n"
                "# Appendix B: Common Risks Reference\n\n"
            )

        parts.append("Generate the complete TIP document now. Output markdown only — no preamble.\n")
        return "".join(parts)

    def refine_tip(self, instruction: str, current_content: str) -> str:
        """
        Refine or edit TIP section content based on a user instruction.
        Runs synchronously — call from a thread or sync context.
        Returns the revised content only.
        """
        content_snippet = current_content[:16000]
        prompt = (
            f"=== CURRENT SECTION CONTENT ===\n{content_snippet}\n\n"
            f"=== USER INSTRUCTION ===\n{instruction}\n\n"
            "Apply the instruction to rewrite or improve this section content. "
            "Return ONLY the revised section text with markdown formatting. "
            "Do not add a preamble, explanation, or commentary."
        )
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=[
                {
                    "type": "text",
                    "text": (
                        "You are a senior technical writer at Thrive Networks helping refine "
                        "a section of a Technical Implementation Plan (TIP). "
                        "Apply instructions precisely. Return ONLY revised content — no preamble."
                    ),
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    def _fix_revision_history(self, content: str, author_name: str, today_str: str) -> str:
        """
        Replace whatever revision history table Claude generated with a canonical
        1.0 / author / today row.  Works on both the full document and a section snippet.
        """
        import re

        canonical_table = (
            "| Rev # | Author(s) | Change | Date |\n"
            "|-------|-----------|--------|------|\n"
            f"| 1.0 | {author_name} | Initial Release | {today_str} |"
        )

        # Match any markdown table that follows a "Revision History" heading
        # and replace it wholesale with the canonical table
        pattern = re.compile(
            r'(#+\s*Revision History[^\n]*\n)'   # heading line
            r'(\n?(?:\|[^\n]+\n)+)',              # one or more table rows
            re.IGNORECASE
        )
        replaced, n = pattern.subn(lambda m: m.group(1) + "\n" + canonical_table + "\n", content)
        if n:
            return replaced

        # If no table found under the heading, just return as-is (Claude may not have
        # generated a table — the refine-guided endpoint will handle it)
        return content

    def _parse_sections(
        self,
        content: str,
        template_structure: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Parse generated content into a sections dict.
        Uses template section titles when available for accurate splitting.
        """
        sections: Dict[str, Any] = {}
        current_title: Optional[str] = None
        current_lines: List[str] = []

        for line in content.split("\n"):
            stripped = line.strip()
            # Detect markdown headings (# Title)
            if stripped.startswith("#"):
                if current_title:
                    sections[current_title] = "\n".join(current_lines).strip()
                current_title = stripped.lstrip("#").strip()
                current_lines = []
            else:
                current_lines.append(line)

        if current_title:
            sections[current_title] = "\n".join(current_lines).strip()

        return sections
