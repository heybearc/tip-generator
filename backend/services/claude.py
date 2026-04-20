"""
Claude API service for TIP generation
"""
import os
from typing import Optional, Dict, Any
from anthropic import Anthropic
from sqlalchemy.orm import Session
from models.draft import Draft, DraftStatus
from models.document import Document

class ClaudeService:
    """Service for interacting with Claude API"""
    
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
        self.max_tokens = int(os.getenv("CLAUDE_MAX_TOKENS", "4096"))
        
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        
        self.client = Anthropic(api_key=self.api_key)
    
    async def generate_tip(
        self,
        draft: Draft,
        discovery_doc: Optional[Document],
        service_order_doc: Optional[Document],
        db: Session
    ) -> Draft:
        """
        Generate TIP using Claude API
        """
        # Update draft status
        draft.status = DraftStatus.GENERATING
        db.commit()
        
        try:
            # Build prompt
            prompt = self._build_prompt(draft, discovery_doc, service_order_doc)
            
            # Call Claude API
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Extract generated content
            generated_content = response.content[0].text
            
            # Update draft with generated content
            draft.content = generated_content
            draft.status = DraftStatus.COMPLETED
            draft.claude_model = self.model
            draft.generation_prompt = prompt
            draft.generation_tokens = response.usage.output_tokens
            
            # Parse sections (basic implementation)
            draft.sections = self._parse_sections(generated_content)
            
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
        service_order_doc: Optional[Document]
    ) -> str:
        """
        Build the prompt for Claude based on uploaded documents
        """
        prompt_parts = []
        
        prompt_parts.append("""You are an expert technical writer specializing in creating Technical Implementation Plans (TIPs) for IT projects.

Your task is to generate a comprehensive, professional Technical Implementation Plan based on the provided discovery worksheet and service order documents.

The TIP should include the following sections:
1. Executive Summary
2. Project Overview
3. Technical Requirements
4. Implementation Approach
5. Timeline and Milestones
6. Resource Requirements
7. Risk Assessment
8. Success Criteria
9. Rollback Plan
10. Post-Implementation Support

Please analyze the provided documents and create a detailed, actionable TIP that follows industry best practices.
""")
        
        if discovery_doc and discovery_doc.extracted_text:
            prompt_parts.append("\n\n=== DISCOVERY WORKSHEET ===\n")
            prompt_parts.append(discovery_doc.extracted_text[:10000])  # Limit to 10k chars
        
        if service_order_doc and service_order_doc.extracted_text:
            prompt_parts.append("\n\n=== SERVICE ORDER ===\n")
            prompt_parts.append(service_order_doc.extracted_text[:10000])
        
        if draft.description:
            prompt_parts.append(f"\n\n=== ADDITIONAL CONTEXT ===\n{draft.description}")
        
        prompt_parts.append("\n\nPlease generate the Technical Implementation Plan now:")
        
        return "".join(prompt_parts)
    
    def _parse_sections(self, content: str) -> Dict[str, Any]:
        """
        Parse the generated content into sections
        Basic implementation - can be enhanced later
        """
        sections = {}
        current_section = None
        current_content = []
        
        for line in content.split('\n'):
            # Check if line is a section header (starts with number or ##)
            if line.strip().startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '##')):
                # Save previous section
                if current_section:
                    sections[current_section] = '\n'.join(current_content)
                
                # Start new section
                current_section = line.strip()
                current_content = []
            else:
                current_content.append(line)
        
        # Save last section
        if current_section:
            sections[current_section] = '\n'.join(current_content)
        
        return sections
