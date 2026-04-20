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


class ClaudeService:
    """Service for interacting with Claude API"""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
        self.max_tokens = int(os.getenv("CLAUDE_MAX_TOKENS", "8000"))

        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = Anthropic(api_key=self.api_key)

    async def generate_tip(
        self,
        draft: Draft,
        discovery_doc: Optional[Document],
        service_order_doc: Optional[Document],
        db: Session,
        template_structure: Optional[Dict[str, Any]] = None
    ) -> Draft:
        """
        Generate TIP using Claude API, guided by the active template structure
        """
        draft.status = DraftStatus.GENERATING
        db.commit()

        try:
            prompt = self._build_prompt(
                draft, discovery_doc, service_order_doc, template_structure
            )

            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )

            generated_content = response.content[0].text

            draft.content = generated_content
            draft.status = DraftStatus.COMPLETED
            draft.claude_model = self.model
            draft.generation_prompt = prompt
            draft.generation_tokens = response.usage.output_tokens
            draft.sections = self._parse_sections(generated_content, template_structure)

            from datetime import datetime
            draft.generated_at = datetime.utcnow()

            db.commit()
            db.refresh(draft)
            return draft

        except Exception as e:
            draft.status = DraftStatus.FAILED
            draft.content = f"Error generating TIP: {str(e)}"
            db.commit()
            raise

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
            )

            parts.append("=== TEMPLATE SECTIONS TO POPULATE ===\n\n")

            for section in sections:
                level = section.get("level", 1)
                title = section.get("title", "").strip()
                content = section.get("content", "").strip()

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

    async def refine_tip(self, instruction: str, current_content: str) -> str:
        """
        Refine or edit TIP content based on a user instruction.
        Returns the revised full document content.
        """
        prompt = (
            "You are helping a technical writer refine a Technical Implementation Plan.\n\n"
            f"=== CURRENT TIP CONTENT ===\n{current_content[:20000]}\n\n"
            f"=== USER INSTRUCTION ===\n{instruction}\n\n"
            "Apply the instruction to improve the TIP. Return ONLY the revised content, "
            "preserving all sections and markdown headings. Do not add commentary or preamble."
        )
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

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
