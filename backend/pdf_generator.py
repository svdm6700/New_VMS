"""
VMS - High-Performance A4 Voter List PDF Generator (3 Columns × 9 Rows = 27 Voters per Page)
Generates print-ready A4 Portrait PDFs strictly following reference electoral roll layout:
- 27 voter records per page in an exact 3-column x 9-row grid.
- Prominent 5-character alphanumeric Unique Key inside each block (code only, no label).
- Genuine voter details (Serial No, EPIC ID, Name, Relation, House No, Age, Gender).
- Actual voter photographs (embedded with proportional fit, graceful fallback).
- Strictly NO VMS logo, watermark, branding, or app name.
- Unicode Telugu fonts embedded with 100% fidelity.
- Sub-second generation speed with TextWriter batching, Shape vector batching, and stream compression.
"""

import os
from pathlib import Path
from typing import List, Union, Any, Optional
import pymupdf

from backend.photo_service import get_voter_photo_path

# Standard A4 Dimensions in points (72 pt/inch): 210mm x 297mm
A4_WIDTH = 595.28
A4_HEIGHT = 841.89
PAGE_WIDTH = A4_WIDTH
PAGE_HEIGHT = A4_HEIGHT

# Grid Specifications (3 cols x 9 rows = 27 voters/page)
VOTERS_PER_PAGE = 27
COLS = 3
ROWS = 9

LEFT_MARGIN = 32.0
RIGHT_MARGIN = 32.0
TOP_MARGIN = 38.0
BOTTOM_MARGIN = 38.0

COL_GAP = 4.0
ROW_GAP = 4.0

AVAILABLE_WIDTH = A4_WIDTH - LEFT_MARGIN - RIGHT_MARGIN
COL_WIDTH = (AVAILABLE_WIDTH - (COLS - 1) * COL_GAP) / COLS  # ~174.4 pt

AVAILABLE_HEIGHT = A4_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN
BOX_HEIGHT = (AVAILABLE_HEIGHT - (ROWS - 1) * ROW_GAP) / ROWS  # ~81.5 pt

# Font Paths
FONTS_DIR = Path(__file__).resolve().parent / "fonts"
REGULAR_FONT_PATH = FONTS_DIR / "Nirmala.ttf"
BOLD_FONT_PATH = FONTS_DIR / "NirmalaB.ttf"

# Fallback to system fonts if not found locally
if not REGULAR_FONT_PATH.exists():
    sys_regular = Path("C:/Windows/Fonts/Nirmala.ttf")
    if sys_regular.exists():
        REGULAR_FONT_PATH = sys_regular

if not BOLD_FONT_PATH.exists():
    sys_bold = Path("C:/Windows/Fonts/NirmalaB.ttf")
    if sys_bold.exists():
        BOLD_FONT_PATH = sys_bold

# In-Memory Font Cache & Pre-instantiated PyMuPDF Fonts (Eliminates repeated font parsing)
REGULAR_FONT_BYTES = REGULAR_FONT_PATH.read_bytes() if REGULAR_FONT_PATH.exists() else None
BOLD_FONT_BYTES = BOLD_FONT_PATH.read_bytes() if BOLD_FONT_PATH.exists() else None

REGULAR_FONT = None
BOLD_FONT = None

try:
    if REGULAR_FONT_BYTES:
        REGULAR_FONT = pymupdf.Font(fontbuffer=REGULAR_FONT_BYTES)
    elif REGULAR_FONT_PATH.exists():
        REGULAR_FONT = pymupdf.Font(fontfile=str(REGULAR_FONT_PATH))

    if BOLD_FONT_BYTES:
        BOLD_FONT = pymupdf.Font(fontbuffer=BOLD_FONT_BYTES)
    elif BOLD_FONT_PATH.exists():
        BOLD_FONT = pymupdf.Font(fontfile=str(BOLD_FONT_PATH))
except Exception:
    REGULAR_FONT = None
    BOLD_FONT = None


def _truncate_text(text: str, max_chars: int) -> str:
    text = (text or "").strip()
    if len(text) > max_chars:
        return text[:max_chars - 2] + ".."
    return text


def generate_voters_a4_pdf(
    voters: List[Any],
    title: Optional[str] = None,
    title_header: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    ward: Optional[str] = None,
    area: Optional[str] = None,
    **kwargs: Any
) -> bytes:
    """
    Generate an A4 PDF containing voter records arranged exactly 27 voters per page
    (3 columns x 9 rows), matching the reference electoral roll layout.
    
    Returns raw PDF bytes.
    """
    global REGULAR_FONT, BOLD_FONT

    # Lazy-init fonts if needed
    if REGULAR_FONT is None and REGULAR_FONT_BYTES:
        REGULAR_FONT = pymupdf.Font(fontbuffer=REGULAR_FONT_BYTES)
    if BOLD_FONT is None and BOLD_FONT_BYTES:
        BOLD_FONT = pymupdf.Font(fontbuffer=BOLD_FONT_BYTES)

    effective_title = title or title_header or "ఓటర్ల జాబితా"
    loc_tokens = []
    if district and str(district).strip() != "all":
        loc_tokens.append(f"{str(district).strip()}")
    if constituency and str(constituency).strip() != "all":
        loc_tokens.append(f"{str(constituency).strip()}")
    if ward and str(ward).strip() != "all":
        loc_tokens.append(f"వార్డు: {str(ward).strip()}")
    if area and str(area).strip() != "all":
        loc_tokens.append(f"ప్రాంతం: {str(area).strip()}")
    loc_subtitle = " • ".join(loc_tokens)

    if not voters:
        # Generate an empty single page cleanly
        doc = pymupdf.open()
        page = doc.new_page(width=A4_WIDTH, height=A4_HEIGHT)
        tw = pymupdf.TextWriter(page.rect)
        tw.append((LEFT_MARGIN, TOP_MARGIN + 20), "ఓటర్ల రికార్డులు కనుగొనబడలేదు (No voter records found)", font=BOLD_FONT or REGULAR_FONT, fontsize=11.0)
        tw.write_text(page, color=(0.2, 0.2, 0.2))
        pdf_bytes = doc.tobytes(deflate=True, garbage=3)
        doc.close()
        return pdf_bytes

    doc = pymupdf.open()
    total_voters = len(voters)
    total_pages = max(1, (total_voters + VOTERS_PER_PAGE - 1) // VOTERS_PER_PAGE)
    doc_cache = {}

    try:
        for page_idx in range(total_pages):
            page = doc.new_page(width=A4_WIDTH, height=A4_HEIGHT)

            # Batched vector shapes for high-performance rendering
            s_outer = page.new_shape()
            s_hdr = page.new_shape()
            s_badge = page.new_shape()
            s_photo = page.new_shape()

            # Batched text writers for high-performance Telugu text shaping
            tw_dark = pymupdf.TextWriter(page.rect)
            tw_blue = pymupdf.TextWriter(page.rect)
            tw_muted = pymupdf.TextWriter(page.rect)

            # Top page header
            if effective_title:
                tw_dark.append((LEFT_MARGIN, 24), effective_title, font=BOLD_FONT or REGULAR_FONT, fontsize=8.5)
            if loc_subtitle:
                tw_muted.append((LEFT_MARGIN + 150, 24), loc_subtitle, font=REGULAR_FONT, fontsize=7.5)

            start_voter_idx = page_idx * VOTERS_PER_PAGE
            end_voter_idx = min(start_voter_idx + VOTERS_PER_PAGE, total_voters)
            page_voters = voters[start_voter_idx:end_voter_idx]

            photos_to_draw = []

            for cell_idx, v in enumerate(page_voters):
                col = cell_idx % COLS
                row = cell_idx // COLS

                x0 = LEFT_MARGIN + col * (COL_WIDTH + COL_GAP)
                y0 = TOP_MARGIN + row * (BOX_HEIGHT + ROW_GAP)
                x1 = x0 + COL_WIDTH
                y1 = y0 + BOX_HEIGHT

                # 1. Vector Rectangles
                # Outer border
                s_outer.draw_rect(pymupdf.Rect(x0, y0, x1, y1))
                # Header strip
                hdr_height = 16.5
                s_hdr.draw_rect(pymupdf.Rect(x0, y0, x1, y0 + hdr_height))
                # Unique Key Badge
                key_x0 = x1 - 39
                key_y0 = y0 + 1.5
                s_badge.draw_rect(pymupdf.Rect(key_x0 - 2, key_y0, x1 - 2, key_y0 + 13.5))
                # Photo frame
                photo_rect = pymupdf.Rect(x1 - 45, y0 + 18.5, x1 - 4, y1 - 3.5)
                s_photo.draw_rect(photo_rect)

                # Extract voter field values (handles SQLAlchemy model or dict)
                serial_no = (
                    getattr(v, "serial_no", None)
                    or (v.get("serial_no") if isinstance(v, dict) else "")
                    or str(start_voter_idx + cell_idx + 1)
                )
                epic_id = getattr(v, "voter_id", None) or (v.get("voter_id") if isinstance(v, dict) else "") or ""
                unique_key = getattr(v, "unique_key", None) or (v.get("unique_key") if isinstance(v, dict) else "") or "A7K2P"
                voter_name = getattr(v, "voter_name", None) or (v.get("voter_name") if isinstance(v, dict) else "") or "Not Available"
                relation_type = getattr(v, "relation_type", None) or (v.get("relation_type") if isinstance(v, dict) else "") or "సంబంధం"
                relation_name = getattr(v, "relation_name", None) or (v.get("relation_name") if isinstance(v, dict) else "") or "Not Available"
                age = getattr(v, "age", None) or (v.get("age") if isinstance(v, dict) else "") or "-"
                gender = getattr(v, "gender", None) or (v.get("gender") if isinstance(v, dict) else "") or "-"
                house_no = getattr(v, "house_no", None) or (v.get("house_no") if isinstance(v, dict) else "") or "-"
                document_id = getattr(v, "document_id", None) or (v.get("document_id") if isinstance(v, dict) else None)
                source_page = getattr(v, "source_page", None) or (v.get("source_page") if isinstance(v, dict) else None)
                photo_path_val = getattr(v, "photo_path", None) or (v.get("photo_path") if isinstance(v, dict) else None)
                block_bbox = getattr(v, "block_bbox", None) or (v.get("block_bbox") if isinstance(v, dict) else None)
                photo_bbox = getattr(v, "photo_bbox", None) or (v.get("photo_bbox") if isinstance(v, dict) else None)

                # 2. Header Text
                sno_str = str(serial_no).strip()
                sno_display = f"వ.సం: {sno_str}" if not sno_str.startswith("వ.") else sno_str
                tw_dark.append((x0 + 4, y0 + 11.5), sno_display, font=BOLD_FONT, fontsize=7.5)

                if epic_id and str(epic_id).strip() != "Not Available":
                    tw_dark.append((x0 + 58, y0 + 11.5), str(epic_id).strip(), font=BOLD_FONT, fontsize=7.5)

                # Unique Key (Prominent blue, code only)
                tw_blue.append((key_x0, y0 + 11.5), str(unique_key).strip(), font=BOLD_FONT, fontsize=8.5)

                # 3. Voter Details (Left Side, ~122 pt wide)
                text_x = x0 + 4
                text_max_chars = 23

                # Name
                name_text = f"పేరు: {voter_name}"
                tw_dark.append((text_x, y0 + 28), _truncate_text(name_text, text_max_chars), font=BOLD_FONT, fontsize=7.0)

                # Relation (Father/Husband)
                rel_label = f"{relation_type}: " if (relation_type and str(relation_type).strip() != "Not Available") else "సంబంధం: "
                rel_text = f"{rel_label}{relation_name}"
                tw_dark.append((text_x, y0 + 41), _truncate_text(rel_text, text_max_chars), font=REGULAR_FONT, fontsize=6.8)

                # House Number
                house_text = f"ఇంటి సంఖ్య: {house_no}"
                tw_dark.append((text_x, y0 + 54), _truncate_text(house_text, text_max_chars), font=REGULAR_FONT, fontsize=6.8)

                # Age and Gender
                demog_text = f"వయస్సు: {age}  లింగం: {gender}"
                tw_dark.append((text_x, y0 + 67), demog_text, font=REGULAR_FONT, fontsize=6.8)

                # 4. Voter Photo Resolution
                photo_path = get_voter_photo_path(
                    unique_key=unique_key,
                    voter_id=epic_id,
                    document_id=document_id,
                    source_page=source_page,
                    serial_no=serial_no,
                    photo_path=photo_path_val,
                    block_bbox=block_bbox,
                    photo_bbox=photo_bbox,
                    voter_idx_on_page=cell_idx,
                    doc_cache=doc_cache
                )
                photos_to_draw.append((photo_rect, photo_path))

            # Commit batched vector primitives
            s_outer.finish(color=(0.20, 0.20, 0.20), width=0.6)
            s_outer.commit()

            s_hdr.finish(color=(0.65, 0.65, 0.65), fill=(0.95, 0.95, 0.96), width=0.5)
            s_hdr.commit()

            s_badge.finish(color=(0.70, 0.80, 0.95), fill=(0.90, 0.94, 1.0), width=0.5)
            s_badge.commit()

            s_photo.finish(color=(0.70, 0.70, 0.70), fill=(0.98, 0.98, 0.99), width=0.5)
            s_photo.commit()

            # Render batched Unicode Telugu texts
            tw_dark.write_text(page, color=(0.10, 0.10, 0.10))
            tw_blue.write_text(page, color=(0.04, 0.28, 0.75))

            # Footer
            footer_text = f"పుట {page_idx + 1} / {total_pages}"
            tw_muted.append((A4_WIDTH / 2.0 - 18, A4_HEIGHT - 16), footer_text, font=REGULAR_FONT, fontsize=7.0)
            tw_muted.write_text(page, color=(0.40, 0.40, 0.40))

            # Render photographs
            for prect, ppath in photos_to_draw:
                photo_inserted = False
                if ppath and os.path.exists(ppath):
                    try:
                        page.insert_image(prect, filename=ppath, keep_proportion=True)
                        photo_inserted = True
                    except Exception:
                        photo_inserted = False

                if not photo_inserted:
                    # Neutral photo placeholder
                    tw_ph = pymupdf.TextWriter(page.rect)
                    tw_ph.append((prect.x0 + 10, prect.y0 + 31.5), "ఫోటో", font=REGULAR_FONT, fontsize=7.0)
                    tw_ph.write_text(page, color=(0.55, 0.55, 0.55))

        pdf_bytes = doc.tobytes(deflate=True, garbage=3)
        doc.close()
        return pdf_bytes
    finally:
        for cached_doc in doc_cache.values():
            try:
                cached_doc.close()
            except Exception:
                pass
