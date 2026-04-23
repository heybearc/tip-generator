"""
Chunk retrieval service — BM25/TF-IDF keyword matching for library section chunks.
No external API required. Suitable for corpus sizes <500 documents.
The pgvector embedding_vec columns are reserved for future dense-vector upgrade.
"""
import re
import math
from collections import Counter
from typing import List
from sqlalchemy.orm import Session
from models.library import LibraryDocument, LibraryChunk


def _tokenize(text: str) -> List[str]:
    """Lowercase, strip punctuation, split on whitespace. Filter short tokens."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return [t for t in text.split() if len(t) > 2]


def _bm25_score(query_tokens: List[str], doc_tokens: List[str], avgdl: float, k1: float = 1.5, b: float = 0.75) -> float:
    """BM25 score for a single document given query tokens."""
    tf = Counter(doc_tokens)
    dl = len(doc_tokens)
    score = 0.0
    for term in query_tokens:
        if term not in tf:
            continue
        idf = math.log(1 + 1)  # simplified; with small corpus IDF=log(2)
        tf_norm = (tf[term] * (k1 + 1)) / (tf[term] + k1 * (1 - b + b * dl / max(avgdl, 1)))
        score += idf * tf_norm
    return score


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


def chunk_and_index_library_doc(doc: LibraryDocument, db: Session) -> int:
    """
    Split a library document into section chunks and store in library_chunks.
    No embedding API call — BM25 retrieval operates directly on stored content.
    Returns number of chunks created.
    """
    if not doc.extracted_text:
        return 0

    # Delete existing chunks (re-index on re-approval)
    db.query(LibraryChunk).filter(LibraryChunk.library_doc_id == doc.id).delete()
    db.commit()

    sections = _split_into_sections(doc.extracted_text)

    for section in sections:
        chunk = LibraryChunk(
            library_doc_id=doc.id,
            section_title=section["title"],
            section_level=section["level"],
            content=section["content"],
            embedding_vec=None,  # reserved for future dense-vector upgrade
            tech_tags=[doc.category] if doc.category else [],
        )
        db.add(chunk)

    db.commit()
    return len(sections)


# Keep old name as alias for backwards compat with any direct callers
chunk_and_embed_library_doc = chunk_and_index_library_doc


def retrieve_relevant_chunks(
    query: str,
    section_title: str,
    db: Session,
    top_k: int = 3,
    min_content_len: int = 100,
) -> List[LibraryChunk]:
    """
    Find top-k library chunks relevant to a query + section title using BM25.
    Loads all chunks from DB and scores in-process — fast for <500 chunks.
    """
    try:
        all_chunks = (
            db.query(LibraryChunk)
            .filter(LibraryChunk.content.isnot(None))
            .all()
        )
        if not all_chunks:
            return []

        query_tokens = _tokenize(f"{section_title} {query}")
        if not query_tokens:
            return []

        # Compute average document length for BM25 normalisation
        all_tokens = [_tokenize(c.content) for c in all_chunks]
        avgdl = sum(len(t) for t in all_tokens) / len(all_tokens)

        scored = [
            (chunk, _bm25_score(query_tokens, tokens, avgdl))
            for chunk, tokens in zip(all_chunks, all_tokens)
        ]
        scored.sort(key=lambda x: x[1], reverse=True)

        results = [
            c for c, score in scored
            if score > 0 and len(c.content or "") >= min_content_len
        ]
        return results[:top_k]
    except Exception as e:
        print(f"[embedding] BM25 retrieval failed: {e}")
        return []
