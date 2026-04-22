"""
Celery application instance and task definitions.
Worker is run as a separate systemd service (tip-generator-worker).
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

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
    worker_prefetch_multiplier=1,        # One task at a time per worker
    task_acks_late=True,                 # Ack only after task completes (safe retry on crash)
    task_reject_on_worker_lost=True,     # Re-queue if worker dies mid-task
    broker_connection_retry_on_startup=True,
)


@celery.on_after_configure.connect
def recover_orphaned_drafts(sender, **kwargs):
    """
    On worker startup, find any drafts stuck in 'generating' state and re-queue them.
    This handles the case where the worker was restarted mid-generation.
    Runs once per worker process startup.
    """
    try:
        from database import SessionLocal
        from models.draft import Draft, DraftStatus
        db = SessionLocal()
        try:
            orphans = db.query(Draft).filter(Draft.status == DraftStatus.GENERATING).all()
            if orphans:
                print(f"[startup] Found {len(orphans)} orphaned generating draft(s) — re-queuing...")
                for draft in orphans:
                    draft.status = DraftStatus.GENERATING  # keep status, reset progress
                    draft.generation_prompt = None
                    db.commit()
                    generate_tip_task.delay(draft.id, draft.template_file_id)
                    print(f"[startup] Re-queued draft {draft.id}: {draft.title}")
        finally:
            db.close()
    except Exception as e:
        print(f"[startup] Orphan recovery failed: {e}")


@celery.task(bind=True, name="generate_tip", max_retries=1)
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
        draft = db.query(Draft).filter(Draft.id == draft_id).first()
        if not draft:
            return {"error": f"Draft {draft_id} not found"}

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

        # Fetch approved library examples for few-shot injection (max 2, prefer same category)
        library_examples = []
        try:
            from models.library import LibraryDocument, LibraryStatus
            query = (
                db.query(LibraryDocument)
                .filter(
                    LibraryDocument.status == LibraryStatus.APPROVED,
                    LibraryDocument.extracted_text != None,
                )
            )
            # Prefer examples matching the draft title keywords (rough category hint)
            approved_docs = query.order_by(LibraryDocument.approved_at.desc()).limit(10).all()
            selected = approved_docs[:2]  # Cap at 2 examples
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

        return {"draft_id": draft_id, "status": "completed"}

    except Exception as exc:
        try:
            draft = db.query(Draft).filter(Draft.id == draft_id).first()
            if draft:
                draft.status = DraftStatus.FAILED
                draft.content = f"Generation failed: {str(exc)}"
                db.commit()
        except Exception:
            pass
        raise self.retry(exc=exc, countdown=0, max_retries=0)
    finally:
        db.close()
