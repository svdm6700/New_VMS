"""
VMS - A4 Voter List PDF Generator (3 Columns × 9 Rows = 27 Voters per Page)
Generates print-ready A4 Portrait PDFs strictly following reference layout:
- 27 voter records per page in a 3-column x 9-row grid.
- Prominent 5-character alphanumeric Unique Key inside each block (code only, no label).
- Genuine voter details (Serial No, EPIC ID, Name, Relation, House No, Age, Gender).
- Actual voter photographs (embedded when available, graceful fallback).
- Strictly NO VMS logo, watermark, branding, or app name.
- Unicode Telugu fonts embedded with 100% fidelity.
"""

import os
from pathlib import Path
from typing import List, Union, Any, Optional
import pymupdf

from backend.photo_service import get_voter_photo_path

# Standard A4 Dimensions in points (72 pt/inch): 210mm x 297mm
A4_WIDTH = 595.28
A4_HEIGHT = 841.89

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

def _truncate_text(text: str, max_chars: int) -> str:
    text = (text or "").strip()
    if len(text) > max_chars:
        return text[:max_chars - 2] + ".."
    return text

def generate_voters_a4_pdf(voters: List[Any], title_header: Optional[str] = None) -> bytes:
    """
    Generate an A4 PDF containing voter records arranged exactly 27 voters per page
    (3 columns x 9 rows), matching the reference electoral roll layout.
    
    Returns raw PDF bytes.
    """
    if not voters:
        # Generate an empty single page cleanly
        doc = pymupdf.open()
        page = doc.new_page(width=A4_WIDTH, height=A4_HEIGHT)
        page.insert_font(fontname="Nirmala", fontfile=str(REGULAR_FONT_PATH))
        page.insert_text((LEFT_MARGIN, TOP_MARGIN + 20), "ఓటర్ల రికార్డులు కనుగొనబడలేదు (No voter records found)", fontname="Nirmala", fontsize=10)
        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes

    doc = pymupdf.open()
    total_voters = len(voters)
    total_pages = (total_voters + VOTERS_PER_PAGE - 1) // VOTERS_PER_PAGE

    for page_idx in range(total_pages):
        page = doc.new_page(width=A4_WIDTH, height=A4_HEIGHT)

        # Register Unicode Telugu Fonts
        page.insert_font(fontname="Nirmala", fontfile=str(REGULAR_FONT_PATH))
        page.insert_font(fontname="NirmalaB", fontfile=str(BOLD_FONT_PATH))

        start_voter_idx = page_idx * VOTERS_PER_PAGE
        end_voter_idx = min(start_voter_idx + VOTERS_PER_PAGE, total_voters)
        page_voters = voters[start_voter_idx:end_voter_idx]

        for cell_idx, v in enumerate(page_voters):
            col = cell_idx % COLS
            row = cell_idx // COLS

            x0 = LEFT_MARGIN + col * (COL_WIDTH + COL_GAP)
            y0 = TOP_MARGIN + row * (BOX_HEIGHT + ROW_GAP)
            x1 = x0 + COL_WIDTH
            y1 = y0 + BOX_HEIGHT

            # Extract voter field values (handles SQLAlchemy model or dict)
            serial_no = getattr(v, "serial_no", None) or (v.get("serial_no") if isinstance(v, dict) else "") or str(start_voter_idx + cell_idx + 1)
            electoral_roll_no = getattr(v, "electoral_roll_no", None) or (v.get("electoral_roll_no") if isinstance(v, dict) else "")
            voter_name = getattr(v, "voter_name", None) or (v.get("voter_name") if isinstance(v, dict) else "") or "Not Available"
            relation_type = getattr(v, "relation_type", None) or (v.get("relation_type") if isinstance(v, dict) else "") or "సంబంధం"
            relation_name = getattr(v, "relation_name", None) or (v.get("relation_name") if isinstance(v, dict) else "") or "Not Available"
            age = getattr(v, "age", None) or (v.get("age") if isinstance(v, dict) else "") or "-"
            gender = getattr(v, "gender", None) or (v.get("gender") if isinstance(v, dict) else "") or "-"
            house_no = getattr(v, "house_no", None) or (v.get("house_no") if isinstance(v, dict) else "") or "-"
            epic_id = getattr(v, "voter_id", None) or (v.get("voter_id") if isinstance(v, dict) else "") or ""
            unique_key = getattr(v, "unique_key", None) or (v.get("unique_key") if isinstance(v, dict) else "") or "A7K2P"
            document_id = getattr(v, "document_id", None) or (v.get("document_id") if isinstance(v, dict) else None)
            source_page = getattr(v, "source_page", None) or (v.get("source_page") if isinstance(v, dict) else None)

            # -------------------------------------------------------------
            # 1. Outer Voter Box Border
            # -------------------------------------------------------------
            box_rect = pymupdf.Rect(x0, y0, x1, y1)
            page.draw_rect(box_rect, color=(0.20, 0.20, 0.20), width=0.6)

            # -------------------------------------------------------------
            # 2. Header Strip (Serial No, EPIC ID, Permanent Unique Key)
            # -------------------------------------------------------------
            hdr_height = 16.5
            hdr_rect = pymupdf.Rect(x0, y0, x1, y0 + hdr_height)
            page.draw_rect(hdr_rect, color=(0.65, 0.65, 0.65), fill=(0.95, 0.95, 0.96), width=0.5)

            # Left: Serial Number
            sno_display = f"వ.సం: {serial_no}" if not serial_no.startswith("వ.") else serial_no
            page.insert_text((x0 + 4, y0 + 11.5), sno_display, fontname="NirmalaB", fontsize=7.5, color=(0.1, 0.1, 0.1))

            # Middle: EPIC Number
            if epic_id and epic_id != "Not Available":
                page.insert_text((x0 + 58, y0 + 11.5), epic_id, fontname="NirmalaB", fontsize=7.5, color=(0.15, 0.15, 0.15))

            # Right: Permanent 5-Character Alphanumeric Unique Key (PROMINENT, CODE ONLY!)
            # Background badge for high visual prominence
            key_x0 = x1 - 39
            key_y0 = y0 + 1.5
            key_badge = pymupdf.Rect(key_x0 - 2, key_y0, x1 - 2, key_y0 + 13.5)
            page.draw_rect(key_badge, color=(0.7, 0.8, 0.95), fill=(0.90, 0.94, 1.0), width=0.5)
            page.insert_text((key_x0, y0 + 11.5), unique_key, fontname="NirmalaB", fontsize=8.5, color=(0.04, 0.28, 0.75))

            # -------------------------------------------------------------
            # 3. Voter Details (Left Side, ~122 pt wide)
            # -------------------------------------------------------------
            text_x = x0 + 4
            text_max_chars = 23

            # Name
            name_text = f"పేరు: {voter_name}"
            page.insert_text((text_x, y0 + 28), _truncate_text(name_text, text_max_chars), fontname="NirmalaB", fontsize=7.0, color=(0.08, 0.08, 0.08))

            # Relation (Father/Husband)
            rel_label = f"{relation_type}: " if (relation_type and relation_type != "Not Available") else "సంబంధం: "
            rel_text = f"{rel_label}{relation_name}"
            page.insert_text((text_x, y0 + 41), _truncate_text(rel_text, text_max_chars), fontname="Nirmala", fontsize=6.8, color=(0.20, 0.20, 0.20))

            # House Number
            house_text = f"ఇంటి సంఖ్య: {house_no}"
            page.insert_text((text_x, y0 + 54), _truncate_text(house_text, text_max_chars), fontname="Nirmala", fontsize=6.8, color=(0.20, 0.20, 0.20))

            # Age and Gender
            demog_text = f"వయస్సు: {age}  లింగం: {gender}"
            page.insert_text((text_x, y0 + 67), demog_text, fontname="Nirmala", fontsize=6.8, color=(0.20, 0.20, 0.20))

            # -------------------------------------------------------------
            # 4. Voter Photograph (Right Side, ~41 pt wide x ~58 pt high)
            # -------------------------------------------------------------
            photo_rect = pymupdf.Rect(x1 - 45, y0 + 18.5, x1 - 4, y1 - 3.5)
            page.draw_rect(photo_rect, color=(0.70, 0.70, 0.70), fill=(0.98, 0.98, 0.99), width=0.5)

            photo_path = get_voter_photo_path(
                unique_key=unique_key,
                voter_id=epic_id,
                document_id=document_id,
                source_page=source_page,
                voter_idx_on_page=cell_idx
            )

            photo_inserted = False
            if photo_path and os.path.exists(photo_path):
                try:
                    page.insert_image(photo_rect, filename=photo_path, keep_proportion=True)
                    photo_inserted = True
                except Exception:
                    photo_inserted = False

            if not photo_inserted:
                # Elegant neutral photo frame placeholder
                page.insert_text((x1 - 35, y0 + 50), "ఫోటో", fontname="Nirmala", fontsize=7.0, color=(0.55, 0.55, 0.55))

        # -------------------------------------------------------------
        # 5. Page Footer (Centered at bottom, subtle)
        # -------------------------------------------------------------
        footer_text = f"పుట {page_idx + 1} / {total_pages}"
        page.insert_text((A4_WIDTH / 2.0 - 18, A4_HEIGHT - 16), footer_text, fontname="Nirmala", fontsize=7.0, color=(0.40, 0.40, 0.40))

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes
