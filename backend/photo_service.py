"""
VMS - Voter Photo Retrieval & Caching Service
Resolves voter photos from local storage, caching from uploaded PDFs when available,
and handling missing photographs gracefully.
"""

import os
from typing import Optional
from pathlib import Path

STORAGE_BASE = Path(__file__).resolve().parent.parent / "storage"
PHOTOS_DIR = STORAGE_BASE / "photos"
UPLOADS_DIR = STORAGE_BASE / "uploads"

# Ensure photos directory exists
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

def get_voter_photo_path(unique_key: Optional[str], voter_id: Optional[str] = None, document_id: Optional[str] = None, source_page: Optional[int] = None, voter_idx_on_page: Optional[int] = None) -> Optional[str]:
    """
    Returns the absolute path to a voter's photo file if available, or None.
    Attempts resolution by unique_key, voter_id, or dynamically extracts from source PDF.
    """
    if unique_key:
        candidate = PHOTOS_DIR / f"{unique_key}.jpg"
        if candidate.exists() and candidate.stat().st_size > 0:
            return str(candidate)

    if voter_id and voter_id != "Not Available":
        candidate = PHOTOS_DIR / f"{voter_id}.jpg"
        if candidate.exists() and candidate.stat().st_size > 0:
            return str(candidate)

    # Dynamic fallback: If source document exists and page info is available
    if document_id and source_page is not None:
        doc_pdf = UPLOADS_DIR / f"{document_id}.pdf"
        if doc_pdf.exists():
            try:
                import pymupdf
                src_doc = pymupdf.open(str(doc_pdf))
                pno = max(0, source_page - 1)
                if pno < len(src_doc):
                    page = src_doc[pno]
                    img_list = page.get_images()
                    if img_list:
                        # Pick image matching index or first image
                        idx = voter_idx_on_page if voter_idx_on_page is not None and voter_idx_on_page < len(img_list) else 0
                        xref = img_list[idx][0]
                        extracted = src_doc.extract_image(xref)
                        if extracted and "image" in extracted:
                            save_name = unique_key or f"temp_{document_id}_{source_page}_{idx}"
                            cached_file = PHOTOS_DIR / f"{save_name}.jpg"
                            with open(cached_file, "wb") as f:
                                f.write(extracted["image"])
                            src_doc.close()
                            return str(cached_file)
                src_doc.close()
            except Exception as e:
                # Graceful degradation on extraction error
                pass

    return None
