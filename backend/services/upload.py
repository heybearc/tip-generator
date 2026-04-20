"""
File upload service
"""
import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from sqlalchemy.orm import Session
from models.document import Document, DocumentType, DocumentStatus
import openpyxl
import fitz  # PyMuPDF
from docx import Document as DocxDocument

class UploadService:
    """Service for handling file uploads and processing"""
    
    def __init__(self, upload_dir: str = "/var/tmp/tip-generator/uploads"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        
    async def save_upload(
        self,
        file: UploadFile,
        document_type: DocumentType,
        user_id: int,
        db: Session
    ) -> Document:
        """
        Save uploaded file and create database record
        """
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = self.upload_dir / unique_filename
        
        # Save file to disk
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Create database record
        document = Document(
            user_id=user_id,
            filename=unique_filename,
            original_filename=file.filename,
            file_path=str(file_path),
            file_size=len(content),
            mime_type=file.content_type,
            document_type=document_type,
            status=DocumentStatus.UPLOADING
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Process file in background (for now, just mark as completed)
        try:
            extracted_text = await self.extract_text(file_path, file_ext)
            document.extracted_text = extracted_text
            document.status = DocumentStatus.COMPLETED
        except Exception as e:
            document.status = DocumentStatus.FAILED
            document.error_message = str(e)
        
        db.commit()
        db.refresh(document)
        
        return document
    
    async def extract_text(self, file_path: Path, file_ext: str) -> Optional[str]:
        """
        Extract text content from uploaded file
        """
        try:
            if file_ext.lower() in ['.xlsx', '.xls']:
                return self._extract_from_excel(file_path)
            elif file_ext.lower() == '.pdf':
                return self._extract_from_pdf(file_path)
            elif file_ext.lower() == '.docx':
                return self._extract_from_docx(file_path)
            else:
                return None
        except Exception as e:
            raise Exception(f"Failed to extract text: {str(e)}")
    
    def _extract_from_excel(self, file_path: Path) -> str:
        """Extract text from Excel file"""
        wb = openpyxl.load_workbook(file_path)
        text_parts = []
        
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            text_parts.append(f"=== Sheet: {sheet_name} ===\n")
            
            for row in sheet.iter_rows(values_only=True):
                row_text = "\t".join([str(cell) if cell is not None else "" for cell in row])
                if row_text.strip():
                    text_parts.append(row_text)
        
        return "\n".join(text_parts)
    
    def _extract_from_pdf(self, file_path: Path) -> str:
        """Extract text from PDF file"""
        doc = fitz.open(file_path)
        text_parts = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text_parts.append(f"=== Page {page_num + 1} ===\n")
            text_parts.append(page.get_text())
        
        doc.close()
        return "\n".join(text_parts)
    
    def _extract_from_docx(self, file_path: Path) -> str:
        """Extract text from Word document"""
        doc = DocxDocument(file_path)
        text_parts = []
        
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
        
        return "\n".join(text_parts)
