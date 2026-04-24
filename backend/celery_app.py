"""
Celery application instance and task definitions.
Worker is run as a separate systemd service (tip-generator-worker).
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# CELERY_QUEUE isolates blue/green workers — set to "celery-green" on STANDBY container
CELERY_QUEUE = os.getenv("CELERY_QUEUE", "celery")

celery = Celery(
    "tip_generator",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_prefetch_multiplier=1,        # One task queued per thread slot — no over-fetching
    task_acks_late=True,                 # Ack only after task completes (safe retry on crash)
    # task_reject_on_worker_lost omitted — incompatible with SIGKILL termination
    broker_connection_retry_on_startup=True,
    task_default_queue=CELERY_QUEUE,
)


@celery.on_after_configure.connect
def recover_orphaned_drafts(sender, **kwargs):
    """
    On worker startup, find any drafts stuck in 'generating' state and re-queue them.
    This handles the case where the worker was restarted mid-generation.
    Runs once per worker process startup.

    Grace window: skip drafts updated within the last 10 minutes — those belong to a
    task that is still alive (e.g. a rolling deployment restarted the worker while a
    thread-pool task was mid-flight on another thread/process).
    """
    try:
        from datetime import datetime, timezone, timedelta
        from database import SessionLocal
        from models.draft import Draft, DraftStatus
        db = SessionLocal()
        GRACE = timedelta(minutes=10)
        now = datetime.now(timezone.utc)
        try:
            candidates = db.query(Draft).filter(
                Draft.status == DraftStatus.GENERATING,
                Draft.celery_task_id != None,  # noqa: E711 — skip already-cleared cancellations
            ).all()
            orphans = [
                d for d in candidates
                if d.updated_at is None or (now - d.updated_at.replace(tzinfo=timezone.utc)) > GRACE
            ]
            skipped = len(candidates) - len(orphans)
            if skipped:
                print(f"[startup] Skipping {skipped} recently-active generating draft(s) — likely still running")
            if orphans:
                print(f"[startup] Found {len(orphans)} orphaned generating draft(s) — re-queuing...")
                for draft in orphans:
                    # Revoke the old task to prevent duplicate runs if it somehow survived
                    try:
                        celery.control.revoke(draft.celery_task_id, terminate=True, signal="SIGKILL", reply=False)
                    except Exception:
                        pass
                    draft.generation_prompt = None
                    draft.celery_task_id = None
                    db.commit()
                    task = generate_tip_task.delay(draft.id, draft.template_file_id)
                    draft.celery_task_id = task.id
                    db.commit()
                    print(f"[startup] Re-queued draft {draft.id}: {draft.title}")
        finally:
            db.close()
    except Exception as e:
        print(f"[startup] Orphan recovery failed: {e}")


TRANSIENT_STATUS_CODES = {429, 529}
MAX_RETRIES = 3
RETRY_BACKOFF = [30, 60, 120]  # seconds between attempts 1→2, 2→3, 3→4


def _is_transient(exc: Exception) -> bool:
    """Return True if the exception is a transient API error worth retrying."""
    msg = str(exc).lower()
    return (
        "overloaded" in msg
        or "rate_limit" in msg
        or "529" in msg
        or "429" in msg
        or "connection" in msg
        or "timeout" in msg
    )


@celery.task(bind=True, name="generate_tip", max_retries=MAX_RETRIES)
def generate_tip_task(self, draft_id: int, template_file_id: int | None):
    """
    Run Claude TIP generation in an isolated worker process.
    Updates draft.status to completed/failed when done.
    """
    import asyncio
    import json
    from database import SessionLocal
    from models.draft import Draft, DraftStatus
    from models.document import Document
    from models.template_file import TemplateFile
    from services.claude import ClaudeService

    db = SessionLocal()
    try:
        from services.audit import log as audit_log
        draft = db.query(Draft).filter(Draft.id == draft_id).first()
        if not draft:
            return {"error": f"Draft {draft_id} not found"}

        audit_log(db, draft_id, "task_start", {
            "title": draft.title,
            "scrub_pii": draft.scrub_pii,
            "template_file_id": template_file_id,
        })

        from models.user import User as UserModel
        user = db.query(UserModel).filter(UserModel.id == draft.user_id).first()
        if not user or not user.claude_api_key:
            draft.status = DraftStatus.FAILED
            draft.content = "Generation failed: No Claude API key configured. Add your Anthropic API key in your profile settings."
            db.commit()
            return {"error": "No Claude API key configured"}

        discovery_doc = None
        service_order_doc = None
        supplemental_docs = []
        if draft.discovery_document_id:
            discovery_doc = db.query(Document).filter(Document.id == draft.discovery_document_id).first()
        if draft.service_order_document_id:
            service_order_doc = db.query(Document).filter(Document.id == draft.service_order_document_id).first()
        # Load supplemental docs from junction table (role='supplemental'), ordered by position
        try:
            from models.draft import DraftDocument
            sup_rows = (
                db.query(DraftDocument)
                .filter(DraftDocument.draft_id == draft.id, DraftDocument.role == "supplemental")
                .order_by(DraftDocument.position)
                .all()
            )
            supplemental_docs = [
                db.query(Document).filter(Document.id == row.document_id).first()
                for row in sup_rows
            ]
            supplemental_docs = [d for d in supplemental_docs if d and d.extracted_text]
        except Exception as e:
            print(f"[generate_tip_task] supplemental doc load skipped: {e}")

        template_structure = None
        # Use passed template_file_id or fall back to active template
        tmpl = None
        if template_file_id:
            tmpl = db.query(TemplateFile).filter(TemplateFile.id == template_file_id).first()
        if not tmpl:
            tmpl = db.query(TemplateFile).filter(TemplateFile.is_active == True).first()
        if tmpl and tmpl.template_structure:
            try:
                template_structure = json.loads(tmpl.template_structure)
                template_file_id = tmpl.id
            except Exception:
                pass

        # Fetch approved library examples for few-shot injection (max 2, scored by relevance)
        library_examples = []
        try:
            from models.library import LibraryDocument, LibraryStatus
            approved_docs = (
                db.query(LibraryDocument)
                .filter(
                    LibraryDocument.status == LibraryStatus.APPROVED,
                    LibraryDocument.extracted_text != None,
                )
                .order_by(LibraryDocument.approved_at.desc())
                .limit(20)
                .all()
            )

            # Score each doc by keyword overlap with draft title + discovery doc filename
            query_tokens = set(
                w.lower()
                for w in (draft.title + " " + (discovery_doc.original_filename if discovery_doc else "")).split()
                if len(w) > 2
            )

            def _score(lib_doc):
                candidate_tokens = set(
                    w.lower()
                    for w in (lib_doc.title + " " + (lib_doc.category or "")).split()
                    if len(w) > 2
                )
                return len(query_tokens & candidate_tokens)

            scored = sorted(approved_docs, key=_score, reverse=True)
            selected = scored[:2]
            print(f"[generate_tip_task] few-shot scores: {[(d.title, _score(d)) for d in approved_docs[:5]]}")
            library_examples = [
                {"title": d.title, "category": d.category, "text": d.extracted_text or ""}
                for d in selected
                if d.extracted_text
            ]
        except Exception as e:
            print(f"[generate_tip_task] library fetch skipped: {e}")

        print(f"[generate_tip_task] library_examples injected: {len(library_examples)} (titles: {[e['title'] for e in library_examples]})")

        # Persist which examples were injected for UI display
        if library_examples:
            draft.library_examples_used = [{"title": e["title"], "category": e["category"]} for e in library_examples]
            db.commit()

        # --- PII Scrubbing (opt-in per draft) ---
        # Creates shallow Document-like objects with scrubbed text so originals are untouched.
        if draft.scrub_pii:
            try:
                from services.pii import scrub as pii_scrub
                import types

                def _scrubbed_doc(doc):
                    if doc is None:
                        return None
                    # Eagerly read all attributes before pii_scrub touches the session,
                    # preventing lazy-load failures on a mid-transaction session.
                    doc_id = doc.id
                    doc_filename = getattr(doc, "original_filename", None)
                    doc_text = doc.extracted_text or ""
                    return types.SimpleNamespace(
                        id=doc_id,
                        original_filename=doc_filename,
                        extracted_text=pii_scrub(doc_text, draft.id, db),
                    )

                discovery_doc = _scrubbed_doc(discovery_doc)
                service_order_doc = _scrubbed_doc(service_order_doc)
                supplemental_docs = [_scrubbed_doc(d) for d in (supplemental_docs or [])]
                from models.draft import DraftPIIMap
                pii_row = db.query(DraftPIIMap).filter(DraftPIIMap.draft_id == draft.id).first()
                token_count = len(pii_row.pii_map) if pii_row else 0
                print(f"[generate_tip_task] PII scrubbing applied for draft {draft.id}")
                audit_log(db, draft.id, "pii_scrub", {"tokens_replaced": token_count})
            except Exception as e:
                print(f"[generate_tip_task] PII scrub failed, continuing without scrub: {e}")
                db.rollback()
                audit_log(db, draft.id, "pii_scrub", {"error": str(e), "skipped": True})

        claude = ClaudeService(api_key=user.claude_api_key, model=user.claude_model or None)
        updated_draft = asyncio.run(
            claude.generate_tip(
                draft=draft,
                discovery_doc=discovery_doc,
                service_order_doc=service_order_doc,
                supplemental_docs=supplemental_docs or None,
                db=db,
                template_structure=template_structure,
                library_examples=library_examples or None,
            )
        )

        if template_file_id:
            updated_draft.template_file_id = template_file_id
            db.commit()

        # --- PII Restore ---
        # Re-substitute tokens back into the generated content before storing.
        if draft.scrub_pii and updated_draft.content:
            try:
                from services.pii import restore as pii_restore
                updated_draft.content = pii_restore(updated_draft.content, draft.id, db)
                db.commit()
                print(f"[generate_tip_task] PII restored for draft {draft.id}")
                audit_log(db, draft.id, "pii_restore", {"status": "ok"})
            except Exception as e:
                print(f"[generate_tip_task] PII restore failed: {e}")
                audit_log(db, draft.id, "pii_restore", {"error": str(e)})

        audit_log(db, draft_id, "task_complete", {
            "tokens": updated_draft.generation_tokens,
            "model": updated_draft.claude_model,
        })
        return {"draft_id": draft_id, "status": "completed"}

    except Exception as exc:
        attempt = self.request.retries  # 0-based: 0 = first attempt
        retryable = _is_transient(exc) and attempt < MAX_RETRIES
        countdown = RETRY_BACKOFF[attempt] if attempt < len(RETRY_BACKOFF) else RETRY_BACKOFF[-1]

        try:
            db.rollback()
            draft = db.query(Draft).filter(Draft.id == draft_id).first()
            if draft:
                if retryable:
                    # Keep draft in generating state so UI shows it still working
                    draft.status = DraftStatus.GENERATING
                    draft.generation_prompt = None
                else:
                    draft.status = DraftStatus.FAILED
                    draft.content = f"Generation failed: {str(exc)}"
                db.commit()
            audit_log(db, draft_id, "task_failed", {
                "error": str(exc),
                "attempt": attempt + 1,
                "retrying": retryable,
                "retry_in_seconds": countdown if retryable else None,
            })
        except Exception:
            pass

        if retryable:
            raise self.retry(exc=exc, countdown=countdown)
        # Hard failure — do not retry
        return {"draft_id": draft_id, "status": "failed", "error": str(exc)}
    finally:
        db.close()
