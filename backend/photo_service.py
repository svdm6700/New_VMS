"""
VMS - High-Precision Voter Photo Retrieval & Caching Service
Resolves voter photos from local storage with 100% spatial bounding box containment,
caching from uploaded PDFs when available, and handling missing photographs gracefully.
"""

import os
from typing import Optional, Union, List
from pathlib import Path

# Paths
STORAGE_BASE = Path(__file__).resolve().parent.parent / "storage"
PHOTOS_DIR = STORAGE_BASE / "photos"
UPLOADS_DIR = STORAGE_BASE / "uploads"

# Ensure directories exist
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

def save_voter_photo(
    image_bytes: bytes,
    photo_filename: str,
    unique_key: Optional[str] = None
) -> str:
    """Save extracted voter photo to persistent storage and optionally link unique_key."""
    out_file = PHOTOS_DIR / photo_filename
    with open(out_file, "wb") as f:
        f.write(image_bytes)
        
    if unique_key:
        ukey_file = PHOTOS_DIR / f"{unique_key}.jpg"
        if not ukey_file.exists():
            try:
                with open(ukey_file, "wb") as f:
                    f.write(image_bytes)
            except Exception:
                pass
                
    return str(out_file.resolve())

def get_voter_photo_path(
    unique_key: Optional[str] = None,
    voter_id: Optional[str] = None,
    document_id: Optional[str] = None,
    source_page: Optional[int] = None,
    serial_no: Optional[str] = None,
    photo_path: Optional[str] = None,
    block_bbox: Optional[Union[str, List[float]]] = None,
    photo_bbox: Optional[Union[str, List[float]]] = None,
    voter_idx_on_page: Optional[int] = None # Deprecated legacy parameter kept for signature compatibility
) -> Optional[str]:
    """
    Returns the absolute path to a voter's photo file if available, or None.
    Uses spatial bounding box containment and persistent disk references.
    NEVER relies on sequential extraction index.
    """
    # 1. Direct photo_path if provided and exists
    if photo_path and os.path.exists(photo_path) and os.path.getsize(photo_path) > 0:
        return str(Path(photo_path).resolve())

    # 2. Check by unique_key (e.g. 5-character permanent code)
    if unique_key:
        candidate = PHOTOS_DIR / f"{unique_key}.jpg"
        if candidate.exists() and candidate.stat().st_size > 0:
            return str(candidate.resolve())

    # 3. Check by voter_id (EPIC Number)
    if voter_id and voter_id != "Not Available":
        candidate = PHOTOS_DIR / f"{voter_id}.jpg"
        if candidate.exists() and candidate.stat().st_size > 0:
            return str(candidate.resolve())

    # 4. Check standard naming: {document_id}_p{source_page}_s{serial_no}_{voter_id}.jpg
    if document_id and source_page is not None and serial_no:
        vid_slug = voter_id if voter_id and voter_id != "Not Available" else "no_epic"
        candidate = PHOTOS_DIR / f"{document_id}_p{source_page}_s{serial_no}_{vid_slug}.jpg"
        if candidate.exists() and candidate.stat().st_size > 0:
            return str(candidate.resolve())

    # 5. Dynamic fallback: If source document exists and page info is available
    if document_id and source_page is not None:
        doc_pdf = UPLOADS_DIR / f"{document_id}.pdf"
        if not doc_pdf.exists():
            # Check root storage or data
            alt = STORAGE_BASE / f"{document_id}.pdf"
            if alt.exists():
                doc_pdf = alt

        if doc_pdf.exists():
            try:
                import pymupdf as fitz
                src_doc = fitz.open(str(doc_pdf))
                pno = max(0, source_page - 1)
                if pno < len(src_doc):
                    page = src_doc[pno]
                    
                    # Parse target bounding box if available
                    target_rect = None
                    if photo_bbox:
                        if isinstance(photo_bbox, str):
                            import json
                            try:
                                coords = json.loads(photo_bbox)
                            except Exception:
                                coords = [float(x.strip()) for x in photo_bbox.strip("[]()").split(",")]
                        else:
                            coords = photo_bbox
                        if len(coords) == 4:
                            target_rect = fitz.Rect(coords)

                    # If no photo_bbox, check if block_bbox is available
                    if not target_rect and block_bbox:
                        if isinstance(block_bbox, str):
                            import json
                            try:
                                coords = json.loads(block_bbox)
                            except Exception:
                                coords = [float(x.strip()) for x in block_bbox.strip("[]()").split(",")]
                        else:
                            coords = block_bbox
                        if len(coords) == 4:
                            target_rect = fitz.Rect(coords)

                    img_infos = page.get_image_info(xrefs=True)
                    matched_img = None

                    if target_rect and img_infos:
                        for info in img_infos:
                            ibox = fitz.Rect(info["bbox"])
                            if target_rect.contains(ibox) or (ibox.intersects(target_rect) and ibox.intersect(target_rect).get_area() > 0.4 * ibox.get_area()):
                                matched_img = info
                                break

                    if matched_img:
                        xref = matched_img["xref"]
                        extracted = src_doc.extract_image(xref)
                        if extracted and "image" in extracted:
                            save_name = unique_key or f"{document_id}_p{source_page}_s{serial_no or '0'}_{voter_id or 'photo'}"
                            cached_file = PHOTOS_DIR / f"{save_name}.jpg"
                            with open(cached_file, "wb") as f:
                                f.write(extracted["image"])
                            src_doc.close()
                            return str(cached_file.resolve())
                            
                    # If target_rect was available but no embedded image xref matched, render high-res clip
                    if target_rect:
                        pix = page.get_pixmap(clip=target_rect, matrix=fitz.Matrix(2, 2))
                        save_name = unique_key or f"{document_id}_p{source_page}_s{serial_no or '0'}_{voter_id or 'clip'}"
                        cached_file = PHOTOS_DIR / f"{save_name}.jpg"
                        pix.save(str(cached_file))
                        src_doc.close()
                        return str(cached_file.resolve())
                        
                src_doc.close()
            except Exception:
                pass

    return None
