"""
Embedding service — generates and stores pgvector embeddings for library chunks.
Uses OpenAI text-embedding-3-small (1536 dimensions).
"""
import os
import re
from typing import Optional, List
from openai import OpenAI
from sqlalchemy.orm import Session
from models.library import LibraryDocument, LibraryChunk

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set — required for RAG embeddings")
    return OpenAI(api_key=api_key)


def embed_text(text: str) -> List[float]:
    """Embed a single text string. Returns list of 1536 floats."""
    client = _get_client()
    text = text.replace("\n", " ").strip()
    response = client.embeddings.create(input=[text], model=EMBEDDING_MODEL)
    return response.data[0].embedding


def _split_into_sections(text: str) -> List[dict]:
    """
    Split extracted text into sections by markdown heading pattern.
    Returns list of {title, level, content} dicts.
    Falls back to fixed-size chunks if no headings found.
    """
    heading_re = re.compile(r'^(#{1,3})\s+(.+)$', re.MULTILINE)
    matches = list(heading_re.finditer(text))

    if not matches:
        # No headings — split into ~1000-char chunks
        chunks = []
        for i in range(0, len(text), 1000):
            chunk = text[i:i + 1000].strip()
            if chunk:
                chunks.append({"title": f"Chunk {i // 1000 + 1}", "level": 1, "content": chunk})
        return chunks

    sections = []
    for i, match in enumerate(matches):
        level = len(match.group(1))
        title = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if content:
            sections.append({"title": title, "level": level, "content": content})

    return sections


def chunk_and_embed_library_doc(doc: LibraryDocument, db: Session) -> int:
    """
    Split a library document into section chunks, embed each, store in library_chunks.
    Also embeds the whole doc and stores in library_documents.embedding_vec.
    Returns number of chunks created.
    """
    if not doc.extracted_text:
        return 0

    # Delete existing chunks for this doc (re-embedding on re-approval)
    db.query(LibraryChunk).filter(LibraryChunk.library_doc_id == doc.id).delete()
    db.commit()

    sections = _split_into_sections(doc.extracted_text)

    for section in sections:
        embed_input = f"{section['title']}\n\n{section['content']}"
        try:
            vec = embed_text(embed_input)
        except Exception as e:
            print(f"[embedding] skipped chunk '{section['title']}': {e}")
            vec = None

        chunk = LibraryChunk(
            library_doc_id=doc.id,
            section_title=section["title"],
            section_level=section["level"],
            content=section["content"],
            embedding_vec=vec,
            tech_tags=[doc.category] if doc.category else [],
        )
        db.add(chunk)

    # Whole-doc embedding (first 8000 chars to stay within token limits)
    try:
        doc_embed_input = f"{doc.title} {doc.category}\n\n{doc.extracted_text[:8000]}"
        doc.embedding_vec = embed_text(doc_embed_input)
    except Exception as e:
        print(f"[embedding] whole-doc embed failed for doc {doc.id}: {e}")

    db.commit()
    return len(sections)


def retrieve_relevant_chunks(
    query: str,
    section_title: str,
    db: Session,
    top_k: int = 3,
    min_content_len: int = 100,
) -> List[LibraryChunk]:
    """
    Find top-k library chunks most relevant to a query + section title.
    Uses cosine similarity via pgvector <=> operator.
    Falls back to empty list if embeddings unavailable.
    """
    try:
        query_vec = embed_text(f"{section_title}\n\n{query}")
    except Exception as e:
        print(f"[embedding] query embed failed: {e}")
        return []

    try:
        results = (
            db.query(LibraryChunk)
            .filter(
                LibraryChunk.embedding_vec.isnot(None),
                LibraryChunk.content.isnot(None),
            )
            .order_by(LibraryChunk.embedding_vec.op("<=>")(query_vec))
            .limit(top_k)
            .all()
        )
        return [c for c in results if len(c.content or "") >= min_content_len]
    except Exception as e:
        print(f"[embedding] chunk retrieval failed: {e}")
        return []
