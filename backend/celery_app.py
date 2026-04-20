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

        discovery_doc = None
        service_order_doc = None
        if draft.discovery_document_id:
            discovery_doc = db.query(Document).filter(Document.id == draft.discovery_document_id).first()
        if draft.service_order_document_id:
            service_order_doc = db.query(Document).filter(Document.id == draft.service_order_document_id).first()

        template_structure = None
        if template_file_id:
            tmpl = db.query(TemplateFile).filter(TemplateFile.id == template_file_id).first()
            if tmpl and tmpl.template_structure:
                try:
                    template_structure = json.loads(tmpl.template_structure)
                except Exception:
                    pass

        claude = ClaudeService()
        updated_draft = asyncio.run(
            claude.generate_tip(
                draft=draft,
                discovery_doc=discovery_doc,
                service_order_doc=service_order_doc,
                db=db,
                template_structure=template_structure,
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
