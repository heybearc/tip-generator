"""
Generation audit logging.
Writes structured events to generation_logs for e2e troubleshooting.
Safe to call — never raises; failures are printed and swallowed.
"""
from __future__ import annotations

from typing import Any, Dict, Optional


def log(
    db,
    draft_id: int,
    event: str,
    detail: Optional[Dict[str, Any]] = None,
    batch_index: Optional[int] = None,
    total_batches: Optional[int] = None,
) -> None:
    """
    Write one audit entry to generation_logs.
    Always commits immediately — audit entries are independent of surrounding transactions.
    """
    try:
        from models.generation_log import GenerationLog
        entry = GenerationLog(
            draft_id=draft_id,
            event=event,
            batch_index=batch_index,
            total_batches=total_batches,
            detail=detail or {},
        )
        db.add(entry)
        db.commit()
    except Exception as exc:
        print(f"[audit] WARN: failed to write log event={event} draft={draft_id}: {exc}")
