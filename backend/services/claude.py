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


class ClaudeService:
    """Service for interacting with Claude API"""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
        self.max_tokens = int(os.getenv("CLAUDE_MAX_TOKENS", "8000"))

        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = Anthropic(api_key=self.api_key)

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
        template_structure: Optional[Dict[str, Any]] = None
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
                sections_count = len(template_structure.get("sections", []))
                chunks_count = (sections_count + SECTION_CHUNK_SIZE - 1) // SECTION_CHUNK_SIZE
                draft.generation_prompt = json.dumps({
                    "mode": "chunked",
                    "chunk": 0,
                    "total_chunks": chunks_count,
                    "sections": sections_count,
                })
                db.commit()
                generated_content, total_tokens = await self._generate_chunked(
                    draft, discovery_doc, service_order_doc, template_structure, db
                )
            else:
                prompt = self._build_prompt(
                    draft, discovery_doc, service_order_doc, template_structure
                )
                draft.generation_prompt = f"[SINGLE PASS: {doc_size} chars]"
                db.commit()
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
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
        db: Optional[Session] = None
    ) -> tuple:
        """
        Generate TIP section by section when documents are large.
        Splits template sections into chunks of SECTION_CHUNK_SIZE and calls
        Claude once per chunk, passing the full document text each time but
        asking only for a subset of sections. Assembles results into one document.
        Writes chunk progress to draft.generation_prompt after each call.
        """
        sections = template_structure.get("sections", [])
        instructions = template_structure.get("instructions", [])

        # Build instruction lookup by section title
        instruction_map: Dict[str, List[str]] = {}
        for inst in instructions:
            sec = inst.get("section", "")
            instruction_map.setdefault(sec, []).append(inst["text"])

        # Prepare document text — full text, no truncation per chunk
        discovery_text = self._doc_text(discovery_doc)
        service_order_text = self._doc_text(service_order_doc)

        # Split sections into chunks
        chunks = [
            sections[i:i + SECTION_CHUNK_SIZE]
            for i in range(0, len(sections), SECTION_CHUNK_SIZE)
        ]
        total_chunks = len(chunks)

        all_content_parts: List[str] = []
        total_tokens = 0

        for chunk_idx, chunk in enumerate(chunks):
            # Write progress before each call so the UI can show it
            if db:
                draft.generation_prompt = json.dumps({
                    "mode": "chunked",
                    "chunk": chunk_idx + 1,
                    "total_chunks": total_chunks,
                    "sections": len(sections),
                })
                db.commit()

            prompt = self._build_chunk_prompt(
                draft=draft,
                discovery_text=discovery_text,
                service_order_text=service_order_text,
                sections_chunk=chunk,
                instruction_map=instruction_map,
                chunk_index=chunk_idx,
                total_chunks=total_chunks
            )

            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )

            all_content_parts.append(response.content[0].text.strip())
            total_tokens += response.usage.output_tokens

        return "\n\n".join(all_content_parts), total_tokens

    def _build_chunk_prompt(
        self,
        draft: Draft,
        discovery_text: str,
        service_order_text: str,
        sections_chunk: List[Dict],
        instruction_map: Dict[str, List[str]],
        chunk_index: int,
        total_chunks: int
    ) -> str:
        """
        Build a prompt for a single chunk of template sections.
        Includes full document context but asks only for the given sections.
        """
        parts = []

        parts.append(
            "You are an expert technical writer creating a Technical Implementation Plan (TIP) "
            "for a Managed Service Provider. Use ONLY facts from the source documents below. "
            "Where data is missing write [DATA NEEDED: description]. "
            f"This is part {chunk_index + 1} of {total_chunks} — generate ONLY the sections listed.\n\n"
            "CRITICAL RULES:\n"
            "- Do NOT generate a 'Risk Register' section — it is not part of this template.\n"
            "- Do NOT include a Service Order callout block (no **Service Order:**, **Prepared by:**, **Date:** lines).\n"
            "- Do NOT use 'Option A' / 'Option B' sub-sections or 'Step N — ...' numbered sub-headings inside Implementation Details. "
            "Write Implementation Details as flowing prose and/or bullet lists only.\n"
            "- Risks and Contingencies sections MUST be a 4-column markdown table: "
            "| Risk | Likelihood | Mitigation Strategy | Rollback Plan | — one row per risk, concise cells.\n"
            "- Acceptance Criteria MUST be a 3-column markdown table: | # | Acceptance Criterion | Verification Method |\n"
            "- Deliverables MUST be a 4-column markdown table: | # | Deliverable | Description | Expected Date |\n"
            "- Template Usage Guide: SKIP entirely — do not output it.\n"
            "- Appendix A: Write only 'Not Applicable — This is a Migration/Project TIP.' unless source docs indicate a SIP.\n"
            "- Appendix B: Populate with technology-specific risk reference content. Author reference only.\n\n"
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

        if draft.description:
            parts.append(f"=== ADDITIONAL CONTEXT ===\n{draft.description}\n\n")

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

    def _build_prompt(
        self,
        draft: Draft,
        discovery_doc: Optional[Document],
        service_order_doc: Optional[Document],
        template_structure: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build a template-aware prompt for Claude.

        When a parsed template structure is available, the prompt instructs Claude
        to populate each section using the template instructions and the extracted
        document content. When no template is available it falls back to a generic
        TIP structure so the endpoint never fails.
        """
        parts = []

        # ── System preamble ──────────────────────────────────────────────────
        parts.append(
            "You are an expert technical writer who creates Technical Implementation "
            "Plans (TIPs) for a Managed Service Provider. Your writing is professional, "
            "precise, and thorough. You ONLY use information extracted from the provided "
            "source documents — never invent facts, names, or details.\n\n"
        )

        # ── Source documents ─────────────────────────────────────────────────
        if discovery_doc and discovery_doc.extracted_text:
            parts.append("=== DISCOVERY WORKSHEET ===\n")
            parts.append(discovery_doc.extracted_text[:12000])
            parts.append("\n\n")

        if service_order_doc and service_order_doc.extracted_text:
            parts.append("=== SERVICE ORDER ===\n")
            parts.append(service_order_doc.extracted_text[:12000])
            parts.append("\n\n")

        if draft.description:
            parts.append(f"=== ADDITIONAL CONTEXT ===\n{draft.description}\n\n")

        if not discovery_doc and not service_order_doc:
            parts.append(
                "NOTE: No source documents were provided. Generate a TIP structure "
                "with placeholder text indicating where real data should be inserted.\n\n"
            )

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
                "Where data is missing, write a clearly-marked placeholder such as "
                "[DATA NEEDED: description].\n\n"
                "Format output as a clean Word-ready document: use the heading names "
                "exactly as given, write in full paragraphs or bullet lists as "
                "appropriate, and do not add extra commentary outside the sections.\n\n"
                "CRITICAL RULES:\n"
                "- Do NOT generate a 'Risk Register' section — it is not part of this template.\n"
                "- Do NOT include a Service Order callout block (no **Service Order:**, **Prepared by:**, **Date:** lines at the top).\n"
                "- Do NOT use 'Option A' / 'Option B' sub-sections or 'Step N — ...' numbered sub-headings inside Implementation Details. "
                "Write Implementation Details as flowing prose and/or bullet lists only.\n"
                "- Risks and Contingencies sections MUST be a 4-column markdown table: "
                "| Risk | Likelihood | Mitigation Strategy | Rollback Plan | — one row per risk, concise cells.\n"
                "- Acceptance Criteria MUST be a 3-column markdown table: "
                "| # | Acceptance Criterion | Verification Method |\n"
                "- Deliverables MUST be a 4-column markdown table: "
                "| # | Deliverable | Description | Expected Date |\n"
                "- Template Usage Guide: DO NOT include this section in output — it is author instructions only.\n"
                "- Appendix A: If this is a Migration/Project TIP (not a SIP), write only: "
                "'Not Applicable — This is a Migration/Project TIP. This appendix applies only to Support Implementation Plans.'\n"
                "- Appendix B: Populate with relevant risk reference content from the source documents. "
                "This section is for author reference only and will be removed before customer delivery.\n\n"
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
                "No template structure is available. Generate a comprehensive TIP "
                "using this standard structure. Populate each section from the source "
                "documents above.\n\n"
                "# Executive Summary\n"
                "# Project Overview\n"
                "# Customer Environment\n"
                "# Technical Requirements\n"
                "# Implementation Phases\n"
                "# Timeline and Milestones\n"
                "# Resource Requirements\n"
                "# Risks and Contingencies\n"
                "# Success Criteria\n"
                "# Post-Implementation Support\n\n"
            )

        parts.append("Generate the TIP document now:\n")
        return "".join(parts)

    def refine_tip(self, instruction: str, current_content: str) -> str:
        """
        Refine or edit TIP section content based on a user instruction.
        Runs synchronously — call from a thread or sync context.
        Returns the revised content only.
        """
        # Limit content to avoid exceeding context — section content, not full doc
        content_snippet = current_content[:16000]
        prompt = (
            "You are helping a technical writer refine a section of a Technical Implementation Plan (TIP).\n\n"
            f"=== CURRENT SECTION CONTENT ===\n{content_snippet}\n\n"
            f"=== USER INSTRUCTION ===\n{instruction}\n\n"
            "Apply the instruction to rewrite or improve this section content. "
            "Return ONLY the revised section text with markdown formatting. "
            "Do not add a preamble, explanation, or commentary."
        )
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
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
