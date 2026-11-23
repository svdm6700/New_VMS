"""
VMS - Exact Reference A4 Voter List PDF Generator (3 Columns × 9 Rows = 27 Voters per Page)
Visually and structurally reproduces the reference electoral roll PDF (Ramachandrapuram-10-11.pdf):
- Standard A4 portrait format (595.28 pt × 841.89 pt).
- Outer page bounding border with top header, 3x9 voter grid, and footer.
- Header:
  * Centered Title: '{panchayat} పంచాయతీ ఓటర్ల జాబితా - {year}' (Bold)
  * Centered Subtitle: '{constituency} శాసనసభ నియోజకవర్గము'
  * Left Box: 'పంచాయతీ : {panchayat}' and 'మండలము : {mandal}'
  * Right Box: 'వార్డు నెంబరు : {ward}' and 'జిల్లా : {district}'
- Exactly 27 voter blocks per full page in 3 columns × 9 rows.
- Each Voter Block:
  * Header: 'గ్రా.పం.ఓ.జా.వ.సం. [S.No]' on left, 'అ.ఓ.జా.వ.సం. {roll_no}' in center, permanent 5-char unique key on right.
  * Details (Left):
    - ఓటరు పేరు : {voter_name}
    - తండ్రి/భర్త పేరు : {relation_name}
    - వయస్సు : {age}   లింగము : {gender}
    - ఇంటి సంఖ్య : {house_no}
    - ఓటరు ఐడి. కార్డు నెం. : {epic_id}
  * Photograph (Right): 39pt × 41pt proportional fit with border and fallback placeholder.
- Footer:
  * Left: 'వయస్సు లెక్కింపు తేదీ : {as_on_date}'
  * Center: 'ప్రచురణ తేదీ : {publish_date}'
  * Right: 'పుట సంఖ్య . {page_no}/{total_pages}'
- Pure high-performance implementation using PyMuPDF TextWriter, Shape batching, and stream compression.
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

# Exact Geometry Extracted from Reference PDF (Ramachandrapuram-10-11.pdf)
PAGE_FRAME_X0 = 33.7
PAGE_FRAME_Y0 = 35.0
PAGE_FRAME_X1 = 567.3
PAGE_FRAME_Y1 = 800.8

HEADER_SEP_Y = 100.5
FOOTER_SEP_Y = 786.5

COL_WIDTH = 173.8
COL_GAP = 3.6
GRID_X0 = 36.2

BOX_HEIGHT = 74.3
ROW_GAP = 1.92
GRID_Y0 = 102.0

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

# In-Memory Font Cache & Pre-instantiated PyMuPDF Fonts
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


def _clean_str(val: Any, default: str = "") -> str:
    if val is None:
        return default
    s = str(val).strip()
    return default if s in ("", "None", "null", "Not Available", "undefined") else s


def _format_gender(g: Any) -> str:
    s = _clean_str(g, "-").lower()
    if "పు" in s or "male" in s or "m" == s:
        return "పు"
    if "స్త్రీ" in s or "female" in s or "f" == s or "స్" in s:
        return "స్త్రీ"
    return _clean_str(g, "-")


def generate_voters_a4_pdf(
    voters: List[Any],
    title: Optional[str] = None,
    title_header: Optional[str] = None,
    district: Optional[str] = None,
    constituency: Optional[str] = None,
    ward: Optional[str] = None,
    area: Optional[str] = None,
    panchayat: Optional[str] = None,
    mandal: Optional[str] = None,
    as_on_date: Optional[str] = None,
    publish_date: Optional[str] = None,
    year: Optional[str] = None,
    **kwargs: Any
) -> bytes:
    """
    Generate an A4 PDF strictly matching the uploaded reference electoral roll PDF
    (Ramachandrapuram-10-11.pdf) with 27 voter blocks per page (3 columns x 9 rows).
    """
    global REGULAR_FONT, BOLD_FONT

    # Lazy-init fonts if needed
    if REGULAR_FONT is None and REGULAR_FONT_BYTES:
        REGULAR_FONT = pymupdf.Font(fontbuffer=REGULAR_FONT_BYTES)
    if BOLD_FONT is None and BOLD_FONT_BYTES:
        BOLD_FONT = pymupdf.Font(fontbuffer=BOLD_FONT_BYTES)

    # Derive metadata from voters if not provided directly
    first_voter = voters[0] if (voters and len(voters) > 0) else None
    doc_obj = getattr(first_voter, "document", None) if first_voter else None

    eff_panchayat = _clean_str(panchayat or getattr(doc_obj, "area", None) or area, "రామచంద్రపురం")
    # Clean up panchayat if it contains English parenthesis like "రామచంద్రపురం (Ramachandrapuram)"
    if "(" in eff_panchayat:
        eff_panchayat = eff_panchayat.split("(")[0].strip()

    eff_constituency = _clean_str(constituency or getattr(doc_obj, "constituency", None), "తాడేపల్లిగూడెం")
    if "(" in eff_constituency:
        eff_constituency = eff_constituency.split("(")[0].strip()

    eff_district = _clean_str(district or getattr(doc_obj, "district", None), "పశ్చిమ గోదావరి")
    if "(" in eff_district:
        eff_district = eff_district.split("(")[0].strip()

    eff_ward = _clean_str(ward or getattr(doc_obj, "ward_number", None), "2")
    if "ward" in eff_ward.lower():
        eff_ward = "".join(ch for ch in eff_ward if ch.isdigit()) or eff_ward

    eff_mandal = _clean_str(mandal, "పెంటపాడు")
    eff_as_on_date = _clean_str(as_on_date, "01-09-2024")
    eff_publish_date = _clean_str(publish_date, "15-04-2026")
    eff_year = _clean_str(year, "2026")

    if not voters:
        # Generate an empty single page cleanly matching page frame
        doc = pymupdf.open()
        page = doc.new_page(width=A4_WIDTH, height=A4_HEIGHT)
        s_page = page.new_shape()
        s_page.draw_rect(pymupdf.Rect(PAGE_FRAME_X0, PAGE_FRAME_Y0, PAGE_FRAME_X1, PAGE_FRAME_Y1))
        s_page.finish(color=(0.15, 0.15, 0.15), width=0.6)
        s_page.commit()

        tw = pymupdf.TextWriter(page.rect)
        tw.append((PAGE_FRAME_X0 + 20, 160), "ఓటర్ల రికార్డులు కనుగొనబడలేదు (No voter records found)", font=BOLD_FONT or REGULAR_FONT, fontsize=11.0)
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

            # Batched vector primitives
            s_frame = page.new_shape()
            s_cells = page.new_shape()
            s_badges = page.new_shape()
            s_photos = page.new_shape()

            # Batched text writers
            tw_main = pymupdf.TextWriter(page.rect)
            tw_bold = pymupdf.TextWriter(page.rect)
            tw_blue = pymupdf.TextWriter(page.rect)

            # 1. Page Frame and Dividers
            s_frame.draw_rect(pymupdf.Rect(PAGE_FRAME_X0, PAGE_FRAME_Y0, PAGE_FRAME_X1, PAGE_FRAME_Y1))
            # Header bottom separator line
            s_frame.draw_line(pymupdf.Point(PAGE_FRAME_X0, HEADER_SEP_Y), pymupdf.Point(PAGE_FRAME_X1, HEADER_SEP_Y))
            # Footer top separator line
            s_frame.draw_line(pymupdf.Point(PAGE_FRAME_X0, FOOTER_SEP_Y), pymupdf.Point(PAGE_FRAME_X1, FOOTER_SEP_Y))

            # 2. Header Content
            # Dynamically calculate exact centering for header titles
            center_x = (PAGE_FRAME_X0 + PAGE_FRAME_X1) / 2.0

            # Line 1: Centered Title '{panchayat} పంచాయతీ ఓటర్ల జాబితా - {year}'
            header_l1 = f"{eff_panchayat} పంచాయతీ ఓటర్ల జాబితా - {eff_year}"
            title_font = BOLD_FONT or REGULAR_FONT
            w1 = title_font.text_length(header_l1, fontsize=9.8) if title_font else 200.0
            x_title1 = max(PAGE_FRAME_X0 + 10, center_x - w1 / 2.0)
            tw_bold.append((x_title1, 52.0), header_l1, font=title_font, fontsize=9.8)

            # Line 2: Centered Subtitle '{constituency} శాసనసభ నియోజకవర్గము'
            header_l2 = f"{eff_constituency} శాసనసభ నియోజకవర్గము"
            sub_font = REGULAR_FONT or BOLD_FONT
            w2 = sub_font.text_length(header_l2, fontsize=9.8) if sub_font else 180.0
            x_title2 = max(PAGE_FRAME_X0 + 10, center_x - w2 / 2.0)
            tw_main.append((x_title2, 66.0), header_l2, font=sub_font, fontsize=9.8)

            # Left Info Box: Panchayat & Mandal
            tw_main.append((36.2, 83.0), "పంచాయతీ", font=REGULAR_FONT, fontsize=9.0)
            tw_bold.append((88.0, 83.0), f":  {eff_panchayat}", font=BOLD_FONT or REGULAR_FONT, fontsize=9.0)

            tw_main.append((36.2, 96.0), "మండలము", font=REGULAR_FONT, fontsize=9.0)
            tw_bold.append((88.0, 96.0), f":  {eff_mandal}", font=BOLD_FONT or REGULAR_FONT, fontsize=9.0)

            # Right Info Box: Ward & District (comfortably inside right border)
            tw_main.append((430.0, 83.0), "వార్డు నెంబరు", font=REGULAR_FONT, fontsize=9.0)
            tw_bold.append((492.0, 83.0), f":  {eff_ward}", font=BOLD_FONT or REGULAR_FONT, fontsize=9.0)

            tw_main.append((430.0, 96.0), "జిల్లా", font=REGULAR_FONT, fontsize=9.0)
            tw_bold.append((492.0, 96.0), f":  {eff_district}", font=BOLD_FONT or REGULAR_FONT, fontsize=8.6)

            # 3. 27 Voter Blocks Grid
            start_voter_idx = page_idx * VOTERS_PER_PAGE
            end_voter_idx = min(start_voter_idx + VOTERS_PER_PAGE, total_voters)
            page_voters = voters[start_voter_idx:end_voter_idx]

            photos_to_draw = []

            for cell_idx, v in enumerate(page_voters):
                col = cell_idx % COLS
                row = cell_idx // COLS

                x0 = GRID_X0 + col * (COL_WIDTH + COL_GAP)
                y0 = GRID_Y0 + row * (BOX_HEIGHT + ROW_GAP)
                x1 = x0 + COL_WIDTH
                y1 = y0 + BOX_HEIGHT

                # Cell outer border
                s_cells.draw_rect(pymupdf.Rect(x0, y0, x1, y1))

                # Field values
                serial_no = _clean_str(
                    getattr(v, "serial_no", None) or (v.get("serial_no") if isinstance(v, dict) else ""),
                    str(start_voter_idx + cell_idx + 1)
                )
                epic_id = _clean_str(
                    getattr(v, "voter_id", None) or (v.get("voter_id") if isinstance(v, dict) else ""),
                    "SJC0000000"
                )
                unique_key = _clean_str(
                    getattr(v, "unique_key", None) or (v.get("unique_key") if isinstance(v, dict) else ""),
                    "A7K2P"
                )
                roll_no = _clean_str(
                    getattr(v, "electoral_roll_no", None) or (v.get("electoral_roll_no") if isinstance(v, dict) else ""),
                    f"62 - 209 - {serial_no}"
                )
                voter_name = _clean_str(
                    getattr(v, "voter_name", None) or (v.get("voter_name") if isinstance(v, dict) else ""),
                    "లభ్యం కాలేదు"
                )
                rel_type = _clean_str(
                    getattr(v, "relation_type", None) or (v.get("relation_type") if isinstance(v, dict) else ""),
                    "తండ్రి"
                )
                rel_name = _clean_str(
                    getattr(v, "relation_name", None) or (v.get("relation_name") if isinstance(v, dict) else ""),
                    "లభ్యం కాలేదు"
                )
                age = _clean_str(
                    getattr(v, "age", None) or (v.get("age") if isinstance(v, dict) else ""),
                    "-"
                )
                gender = _format_gender(
                    getattr(v, "gender", None) or (v.get("gender") if isinstance(v, dict) else "")
                )
                house_no = _clean_str(
                    getattr(v, "house_no", None) or (v.get("house_no") if isinstance(v, dict) else ""),
                    "-"
                )

                doc_id = getattr(v, "document_id", None) or (v.get("document_id") if isinstance(v, dict) else None)
                source_p = getattr(v, "source_page", None) or (v.get("source_page") if isinstance(v, dict) else None)
                photo_p_val = getattr(v, "photo_path", None) or (v.get("photo_path") if isinstance(v, dict) else None)
                b_bbox = getattr(v, "block_bbox", None) or (v.get("block_bbox") if isinstance(v, dict) else None)
                p_bbox = getattr(v, "photo_bbox", None) or (v.get("photo_bbox") if isinstance(v, dict) else None)

                # --- Block Header Line ---
                # Left: గ్రా.పం.ఓ.జా.వ.సం.
                tw_main.append((x0 + 2.5, y0 + 9.2), "గ్రా.పం.ఓ.జా.వ.సం.", font=REGULAR_FONT, fontsize=6.0)

                # Serial Number Box
                sno_box_x0 = x0 + 51.5
                sno_box_x1 = x0 + 69.5
                s_badges.draw_rect(pymupdf.Rect(sno_box_x0, y0 + 2.0, sno_box_x1, y0 + 10.2))
                tw_bold.append((sno_box_x0 + 2.0, y0 + 9.2), str(serial_no)[:5], font=BOLD_FONT or REGULAR_FONT, fontsize=6.2)

                # Electoral roll reference: అ.ఓ.జా.వ.సం. 62 - 209 - 339 (full display)
                roll_display = f"అ.ఓ.జా.వ.సం. {roll_no}"
                tw_main.append((x0 + 72.0, y0 + 9.2), roll_display, font=REGULAR_FONT, fontsize=5.8)

                # Permanent 5-character Unique Key badge placed neatly above the photograph frame
                key_box_x0 = x1 - 41.5
                key_box_x1 = x1 - 2.5
                s_badges.draw_rect(pymupdf.Rect(key_box_x0, y0 + 12.5, key_box_x1, y0 + 24.5))
                tw_blue.append((key_box_x0 + 7.5, y0 + 21.0), str(unique_key)[:5].upper(), font=BOLD_FONT or REGULAR_FONT, fontsize=7.0)

                # --- Voter Details (Left Side, max width ~125 pt) ---
                max_w = 124.0
                def fit_line(txt: str) -> str:
                    if not REGULAR_FONT:
                        return txt[:32]
                    if REGULAR_FONT.text_length(txt, fontsize=6.1) <= max_w:
                        return txt
                    cur = txt
                    while len(cur) > 5 and REGULAR_FONT.text_length(cur + "..", fontsize=6.1) > max_w:
                        cur = cur[:-1]
                    return cur + ".."

                # Line 1: ఓటరు పేరు : {name}
                tw_main.append((x0 + 2.5, y0 + 21.0), fit_line(f"ఓటరు పేరు : {voter_name}"), font=REGULAR_FONT, fontsize=6.1)

                # Line 2: {rel_type} పేరు : {rel_name}
                rel_label = f"{rel_type} పేరు" if "పేరు" not in rel_type else rel_type
                tw_main.append((x0 + 2.5, y0 + 32.5), fit_line(f"{rel_label} : {rel_name}"), font=REGULAR_FONT, fontsize=6.1)

                # Line 3: వయస్సు : {age}    లింగము : {gender}
                demog_str = f"వయస్సు : {age}    లింగము : {gender}"
                tw_main.append((x0 + 2.5, y0 + 44.5), demog_str, font=REGULAR_FONT, fontsize=6.1)

                # Line 4: ఇంటి సంఖ్య : {house_no}
                tw_main.append((x0 + 2.5, y0 + 56.5), fit_line(f"ఇంటి సంఖ్య : {house_no}"), font=REGULAR_FONT, fontsize=6.1)

                # Line 5: ఓటరు ఐడి. కార్డు నెం. : {epic_id}
                tw_main.append((x0 + 2.5, y0 + 68.5), "ఓటరు ఐడి. కార్డు నెం. :", font=REGULAR_FONT, fontsize=6.1)
                tw_bold.append((x0 + 70.0, y0 + 68.5), str(epic_id).strip(), font=BOLD_FONT or REGULAR_FONT, fontsize=6.2)

                # --- Photograph Box (Right Side) ---
                photo_rect = pymupdf.Rect(x1 - 41.5, y0 + 26.5, x1 - 2.5, y0 + 68.5)
                s_photos.draw_rect(photo_rect)

                # Resolve voter photo
                photo_path = get_voter_photo_path(
                    unique_key=unique_key,
                    voter_id=epic_id,
                    document_id=doc_id,
                    source_page=source_p,
                    serial_no=serial_no,
                    photo_path=photo_p_val,
                    block_bbox=b_bbox,
                    photo_bbox=p_bbox,
                    voter_idx_on_page=cell_idx,
                    doc_cache=doc_cache
                )
                photos_to_draw.append((photo_rect, photo_path))

            # 4. Footer Content
            footer_y = 796.0
            tw_main.append((36.2, footer_y), f"వయస్సు లెక్కింపు తేదీ : {eff_as_on_date}", font=REGULAR_FONT, fontsize=8.6)
            tw_main.append((250.0, footer_y), f"ప్రచురణ తేదీ : {eff_publish_date}", font=REGULAR_FONT, fontsize=8.6)
            tw_main.append((485.0, footer_y), f"పుట సంఖ్య . {page_idx + 1}/{total_pages}", font=BOLD_FONT or REGULAR_FONT, fontsize=8.6)

            # 5. Commit Vector Layers
            # Outer page frame & dividers
            s_frame.finish(color=(0.10, 0.10, 0.10), width=0.61)
            s_frame.commit()

            # Voter block cells
            s_cells.finish(color=(0.15, 0.15, 0.15), width=0.55)
            s_cells.commit()

            # Small serial number & unique key badges
            s_badges.finish(color=(0.25, 0.25, 0.25), width=0.45)
            s_badges.commit()

            # Photo frames
            s_photos.finish(color=(0.35, 0.35, 0.35), fill=(0.98, 0.98, 0.99), width=0.5)
            s_photos.commit()

            # 6. Render Unicode Text Writers
            tw_main.write_text(page, color=(0.05, 0.05, 0.05))
            tw_bold.write_text(page, color=(0.0, 0.0, 0.0))
            tw_blue.write_text(page, color=(0.04, 0.28, 0.75))

            # 7. Embed Photographs
            for prect, ppath in photos_to_draw:
                photo_inserted = False
                if ppath and os.path.exists(ppath):
                    try:
                        page.insert_image(prect, filename=ppath, keep_proportion=True)
                        photo_inserted = True
                    except Exception:
                        photo_inserted = False

                if not photo_inserted:
                    # Subtle neutral photo placeholder matching electoral roll
                    tw_ph = pymupdf.TextWriter(page.rect)
                    tw_ph.append((prect.x0 + 10.0, prect.y0 + 23.0), "ఫోటో", font=REGULAR_FONT, fontsize=6.8)
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
