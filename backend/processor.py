import io
import os
import re
import json
import uuid
import shutil
import requests
from pathlib import Path
from PIL import Image

try:
    import pymupdf as fitz
except ImportError:
    import fitz

import pdfplumber
import pytesseract

try:
    from app.core.config import settings
except ImportError:
    from backend.app.core.config import settings

try:
    from backend.excel import create_excel
except ImportError:
    from excel import create_excel

STORAGE_BASE = Path(__file__).resolve().parent.parent / "storage"
PHOTOS_DIR = STORAGE_BASE / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

# Automatically locate Tesseract via ENV, PATH, or standard Windows locations
_tess_env = os.getenv("TESSERACT_CMD") or os.getenv("TESSERACT_PATH") or getattr(settings, "TESSERACT_CMD", None)
if _tess_env and os.path.isfile(_tess_env):
    pytesseract.pytesseract.tesseract_cmd = _tess_env
elif not shutil.which("tesseract"):
    _possible_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
    ]
    for _path in _possible_paths:
        if os.path.isfile(_path):
            pytesseract.pytesseract.tesseract_cmd = _path
            break

def clean(s):
    s = (s or "").replace("\x00", " ").replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()

def paragraphs(s):
    return [x.strip() for x in re.split(r"\n\s*\n", clean(s)) if x.strip()]

def ocr(image):
    if not settings.OCR_ENABLED:
        return ""
    try:
        lang = settings.OCR_LANGUAGES or "tel+eng"
        return pytesseract.image_to_string(image, lang=lang, config="--oem 1 --psm 3")
    except pytesseract.TesseractNotFoundError:
        return ""
    except pytesseract.TesseractError:
        return ""
    except Exception:
        return ""

def ai_structure(text, page_no, url=None, model=None):
    if not settings.OLLAMA_ENABLED:
        return {}
    url = url or settings.OLLAMA_BASE_URL
    model = model or settings.OLLAMA_MODEL
    prompt = f'''
Read this Telugu document page and return valid JSON only:
{{"tables":[{{"table_name":"title","row_number":1,"telugu_cells":["..."],"english_cells":["..."]}}],
"paragraphs":[{{"heading_te":"","heading_en":"","text_te":"original Telugu paragraph","text_en":"English translation"}}]}}
Extract all meaningful content. Preserve names, dates, amounts, IDs and table row/column order. Do not invent or summarize. Include headings, bullets and paragraphs. Do not guess unreadable text.
Page {page_no}:
{text}
'''
    try:
        timeout = settings.OLLAMA_TIMEOUT or 120
        r = requests.post(url.rstrip("/") + "/api/generate", json={"model":model,"prompt":prompt,"stream":False,"format":"json"}, timeout=timeout)
        r.raise_for_status()
        raw = r.json().get("response", "{}").strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw)
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end != -1:
            return json.loads(raw[start:end+1])
        return json.loads(raw)
    except Exception as exc:
        raise RuntimeError(f"AI processing failed on page {page_no}: {exc}") from exc

def detect_voter_cells(page):
    """
    Detect individual voter block bounding boxes on an electoral roll page.
    Uses vector drawing analysis with text header and geometric fallbacks.
    """
    drawings = page.get_drawings()
    cell_rects = []
    page_rect = page.rect
    
    for d in drawings:
        r = d.get('rect')
        if not r:
            continue
        # Standard voter block dimensions in A4 electoral rolls
        # Width typically 130-240 pt, height typically 50-130 pt
        if 130 <= r.width <= 240 and 50 <= r.height <= 130:
            if r.width > 500 and r.height > 700:
                continue
            cell_rects.append(fitz.Rect(r))
            
    # Deduplicate overlapping rectangles
    unique_cells = []
    for r in cell_rects:
        is_dup = False
        for u in unique_cells:
            inter = fitz.Rect(r).intersect(u)
            if inter.is_valid and inter.get_area() > 0.80 * min(r.get_area(), u.get_area()):
                is_dup = True
                break
        if not is_dup:
            unique_cells.append(r)
            
    # Sort in standard reading order: Row-by-row (top to bottom), then column-by-column (left to right)
    if unique_cells:
        unique_cells.sort(key=lambda r: (round(r.y0 / 15) * 15, r.x0))
        return unique_cells

    # Fallback 1: Text-header anchored clustering
    blocks = page.get_text("blocks")
    headers = []
    for b in blocks:
        text = b[4]
        if re.search(r'(?:వ\.సం|గ్రా\.పం|వార్డు|క్ర\.సం|Sl\.?\s*No|S\.No)\s*[:\.]?\s*\d+', text, re.IGNORECASE):
            headers.append(fitz.Rect(b[:4]))
            
    if len(headers) >= 6:
        headers.sort(key=lambda r: (round(r.y0 / 15) * 15, r.x0))
        return headers

    # Fallback 2: Standard 3-column x 9-row or 3-column x 10-row grid for standard A4 voter rolls
    sample_text = page.get_text("text")
    if any(k in sample_text for k in ["వ.సం", "గ్రా.పం", "వార్డు", "ఓటరు", "ఓటర్", "లింగం", "లింగము"]):
        grid_cells = []
        margin_x = 32.0
        margin_top = 38.0
        content_w = page_rect.width - 2 * margin_x
        cols = 3
        col_w = content_w / cols
        rows = 9
        row_h = (page_rect.height - margin_top - 38.0) / rows
        for row in range(rows):
            for col in range(cols):
                c_rect = fitz.Rect(
                    margin_x + col * col_w,
                    margin_top + row * row_h,
                    margin_x + (col + 1) * col_w - 4,
                    margin_top + (row + 1) * row_h - 4
                )
                grid_cells.append(c_rect)
        return grid_cells

    return []

def clean_extracted_text(val: str, default: str = "Not Available") -> str:
    """Strip photo watermarks, trailing punctuation, and extra whitespace from extracted text."""
    if not val or val == default:
        return default
    cleaned = re.sub(r'(?i)\b(?:Photo\s*(?:Not\s*)?Available|Available|Photo)\b', '', val)
    cleaned = re.sub(r'ఫోటో\s*అందుబాటులో\s*(?:ఉంది|లేదు|ఉన్నది)', '', cleaned)
    cleaned = re.sub(r'ఫోటో(?:\s*లేదు|\s*ఉంది)?', '', cleaned)
    cleaned = " ".join(cleaned.split()).strip(" :-.,;/")
    return cleaned if cleaned else default

def parse_voter_cell_text(raw_text, page_no=1):
    """Accurately parse all structured fields from a voter block text."""
    text = (raw_text or "").replace("\xa0", " ").strip()
    
    # 0. Clean photo watermarks/placeholders before field parsing
    text = re.sub(r'(?i)\bPhoto\s*(?:Not\s*)?Available\b', '', text)
    text = re.sub(r'(?i)\b(?:Available|Photo)\b', '', text)
    text = re.sub(r'ఫోటో\s*అందుబాటులో\s*(?:ఉంది|లేదు|ఉన్నది)', '', text)
    text = re.sub(r'ఫోటో(?:\s*లేదు|\s*ఉంది)?', '', text)

    # 1. Normalize line wraps inside words and labels
    text = re.sub(r'స్\s*\n\s*త్రీ', 'స్త్రీ', text)
    text = re.sub(r'గ్రా[ా-్]*\s*\n*\s*\.?\s*పం\.?\s*ఓ\.?\s*జా\.?\s*వ\.?\s*సం\.?', 'గ్రా.పం.ఓ.జా.వ.సం.', text)
    text = re.sub(r'[వ]?ార్డు[ా-్]*\s*\n*\s*\.?\s*ఓ\.?\s*జా\.?\s*వ\.?\s*సం\.?', 'వార్డు.ఓ.జా.వ.సం.', text)
    text = re.sub(r'అ[ా-్]*\s*\n*\s*\.?\s*ఓ\.?\s*జా\.?\s*వ\.?\s*సం\.?', 'అ.ఓ.జా.వ.సం.', text)
    text = re.sub(r'ఓటరు\s*\n*\s*పేరు\s*[:\.]?', 'ఓటరు పేరు:', text)
    text = re.sub(r'తండ్రి[ిీ్\s]*\n*\s*(?:పేరు)?\s*[:\.]?', 'తండ్రి పేరు:', text)
    text = re.sub(r'భర్త[్\s]*\n*\s*(?:పేరు)?\s*[:\.]?', 'భర్త పేరు:', text)
    text = re.sub(r'తల్లి[్\s]*\n*\s*(?:పేరు)?\s*[:\.]?', 'తల్లి పేరు:', text)
    text = re.sub(r'రక్షకుడు[్\s]*\n*\s*(?:పేరు)?\s*[:\.]?', 'రక్షకుడు పేరు:', text)
    text = re.sub(r'ఇంటి\s*\n*\s*సంఖ్య\s*[:\.]?', 'ఇంటి సంఖ్య:', text)
    text = re.sub(r'ఓటరు\s*ఐడి\.?\s*(?:కార్డు\s*నెం\.?)?\s*[:\.]?', 'ఓటరు ఐడి:', text)
    text = re.sub(r'వయస్సు\s*\n*\s*[:\.]?', 'వయస్సు:', text)

    # 1. Serial Number (Strictly treat వార్డు.ఓ.జా.వ.సం. / గ్రా.పం.ఓ.జా.వ.సం. as voter Serial Number)
    m_sno = re.search(r'(?:గ్రా\.పం\.ఓ\.జా\.వ\.సం\.|[వ]?ార్డు\.ఓ\.జా\.వ\.సం\.|వార్డు\.ఓ\.జా\.వ\.సం\.|ార్డు\.ఓ\.జా\.వ\.సం\.|వ\.సం|క్ర\.సం|వరుస సంఖ్య|Sl\.?\s*No|S\.No)[\s\.:]*(\d+)', text, re.IGNORECASE)
    if not m_sno:
        m_sno = re.search(r'(?:[వ]?ార్డు[^\d\n]*|గ్రా\.పం[^\d\n]*)[\s\.:]*(\d+)', text)
    if not m_sno:
        m_sno = re.search(r'(?:^|\n)\s*(\d+)\s*(?=\n|అ\.ఓ\.జా|ఓటరు)', text)
    serial_no = m_sno.group(1).strip() if m_sno else "Not Available"
    
    # 2. Roll No
    m_roll = re.search(r'(?:అ\.ఓ\.జా\.వ\.సం\.|రోల్\s*సంఖ్య|Roll\s*No)[\s\.:]*([A-Za-z0-9\s\-\/]+?)(?=\n|ఓటరు|పేరు|$)', text)
    roll = m_roll.group(1).strip() if m_roll else "Not Available"
    
    # 3. EPIC Number (Voter ID)
    m_epic = re.search(r'([A-Z]{2,4}\s*[0-9]{6,8})', text)
    if not m_epic:
        m_epic = re.search(r'(?:ఓటరు ఐడి|గుర్తింపు కార్డు|EPIC)[\s\.:\-]*([A-Za-z0-9]+)', text)
    if m_epic:
        voter_id = re.sub(r'[^A-Za-z0-9]', '', m_epic.group(1)).strip().upper()
    else:
        voter_id = "Not Available"

    # Section / Security code (often 5 characters below EPIC in Telugu rolls, e.g. RN7FF)
    sec_code = None
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for idx_l, line in enumerate(lines):
        if voter_id and voter_id in line and idx_l + 1 < len(lines):
            cand = lines[idx_l + 1].strip()
            if re.match(r'^[A-Z0-9]{4,6}$', cand):
                sec_code = cand
                break
    
    # 4. Voter Name
    m_name = re.search(r'ఓటరు\s*పేరు\s*[:\.]?\s*([\s\S]+?)(?=\n?\s*(?:తండ్రి|భర్త|తల్లి|రక్షకుడు|ఇంటి సంఖ్య|$))', text)
    if not m_name:
        m_name = re.search(r'(?:^|\n)\s*పేరు\s*[:\.]?\s*([\s\S]+?)(?=\n?\s*(?:తండ్రి|భర్త|తల్లి|రక్షకుడు|ఇంటి సంఖ్య|$))', text)
    if not m_name:
        m_name = re.search(r'(?:Name)\s*[:\.]?\s*([\s\S]+?)(?=\n?\s*(?:Father|Husband|Mother|House|Age|$))', text, re.IGNORECASE)
    voter_name = " ".join(m_name.group(1).split()).strip() if m_name else "Not Available"
    voter_name = clean_extracted_text(voter_name)
    
    # 5. Relation (Father / Husband / Mother / Guardian)
    rel_type = "Not Available"
    rel_name = "Not Available"
    m_rel = re.search(r'(తండ్రి|భర్త|తల్లి|రక్షకుడు)\s*(?:పేరు)?\s*[:\.]?\s*([\s\S]+?)(?=\n?\s*(?:ఇంటి సంఖ్య|ఓటరు ఐడి|గుర్తింపు కార్డు|వయస్సు|$))', text)
    if not m_rel:
        m_rel = re.search(r'(Father|Husband|Mother|Guardian)\'?s?\s*Name\s*[:\.]?\s*([\s\S]+?)(?=\n?\s*(?:House|EPIC|Age|$))', text, re.IGNORECASE)
    if m_rel:
        rel_type = m_rel.group(1).strip()
        rel_name = " ".join(m_rel.group(2).split()).strip()
        rel_name = clean_extracted_text(rel_name)
        
    # 6. House No
    m_house = re.search(r'ఇంటి\s*సంఖ్య\s*[:\.]?\s*([\s\S]+?)(?=\n?\s*(?:ఓటరు ఐడి|గుర్తింపు కార్డు|వయస్సు|లింగము|లింగం|Gender|$))', text)
    if not m_house:
        m_house = re.search(r'House\s*No\s*[:\.]?\s*([\s\S]+?)(?=\n?\s*(?:EPIC|Age|Gender|$))', text, re.IGNORECASE)
    house_no = " ".join(m_house.group(1).split()).strip() if m_house else "Not Available"
    house_no = clean_extracted_text(house_no)
    
    # 7. Age
    m_age = re.search(r'(?:వయస్సు|Age)[\s\.:]*(\d+)', text, re.IGNORECASE)
    age = m_age.group(1).strip() if m_age else "Not Available"
    
    # 8. Gender (strictly anchored to avoid matching 'లింగం' inside voter names)
    m_gen = re.search(r'(?:^|\n|\d+\s+)(?:లింగము|లింగం|Gender)[\s\.:\-]*([^\n\r]+)', text)
    gender = "Not Available"
    if m_gen:
        raw_gen = m_gen.group(1).strip()
        if any(w in raw_gen for w in ["స్త్రీ", "స్", "Female", "F"]):
            gender = "స్త్రీ"
        elif any(w in raw_gen for w in ["పురుషుడు", "పు", "Male", "M"]):
            gender = "పురుషుడు"
        elif any(w in raw_gen for w in ["ఇతర", "Third", "Transgender", "T", "O"]):
            gender = "ఇతర"
        else:
            gender = raw_gen
            
    sno_field_label = "వార్డు.ఓ.జా.వ.సం." if "వార్డు" in (raw_text or "") else "గ్రా.పం.ఓ.జా.వ.సం."
    fields = [
        {"field_name": sno_field_label, "value": serial_no},
        {"field_name": "అ.ఓ.జా.వ.సం.", "value": roll},
        {"field_name": "ఓటరు పేరు", "value": voter_name},
        {"field_name": f"{rel_type} పేరు" if rel_type != "Not Available" else "తండ్రి / భర్త పేరు", "value": rel_name},
        {"field_name": "ఇంటి సంఖ్య", "value": house_no},
        {"field_name": "ఓటరు ఐడి కార్డు నెం.", "value": voter_id},
        {"field_name": "వయస్సు", "value": age},
        {"field_name": "లింగము", "value": gender},
        {"field_name": "మూల PDF పుట", "value": str(page_no)},
    ]
    if sec_code:
        fields.append({"field_name": "సెక్షన్ కోడ్", "value": sec_code})

    return {
        "serial_no": serial_no,
        "electoral_roll_no": roll,
        "voter_id": voter_id,
        "voter_name": voter_name,
        "relation_type": rel_type,
        "relation_name": rel_name,
        "house_no": house_no,
        "age": age,
        "gender": gender,
        "security_code": sec_code,
        "fields": fields,
        "raw_text": text
    }

def match_and_extract_voter_photo(
    doc,
    page,
    cell_rect,
    page_no,
    serial_no,
    voter_id,
    doc_id,
    image_infos
):
    """
    Extract original photograph for a voter block using strict spatial containment.
    Never uses sequential index or nearest neighbor without block ownership verification.
    """
    cell = fitz.Rect(cell_rect)
    matching_images = []
    
    for img in image_infos:
        ibox = fitz.Rect(img['bbox'])
        center = fitz.Point((ibox.x0 + ibox.x1) / 2, (ibox.y0 + ibox.y1) / 2)
        if cell.contains(center) or (ibox.intersects(cell) and ibox.intersect(cell).get_area() > 0.45 * ibox.get_area()):
            matching_images.append(img)
            
    safe_epic = voter_id if voter_id and voter_id != "Not Available" else "no_epic"
    base_filename = f"{doc_id}_p{page_no}_s{serial_no}_{safe_epic}.jpg"
    out_path = PHOTOS_DIR / base_filename
    
    if len(matching_images) == 1:
        img_info = matching_images[0]
        xref = img_info.get("xref")
        saved = False
        
        # Method A: Extract high-fidelity original embedded image bytes
        if xref:
            try:
                extracted = doc.extract_image(xref)
                if extracted and "image" in extracted and len(extracted["image"]) > 100:
                    with open(out_path, "wb") as pf:
                        pf.write(extracted["image"])
                    saved = True
            except Exception:
                saved = False
                
        # Method B: High-res pixmap render from page clip (fallback)
        if not saved:
            try:
                ibox = fitz.Rect(img_info['bbox'])
                pix = page.get_pixmap(clip=ibox, matrix=fitz.Matrix(2, 2))
                pix.save(str(out_path))
                saved = True
            except Exception:
                saved = False
                
        if saved:
            return {
                "status": "MATCHED",
                "photo_path": str(out_path.resolve()),
                "photo_bbox": [round(x, 1) for x in img_info['bbox']]
            }
        else:
            return {
                "status": "EXTRACTION_FAILED",
                "photo_path": None,
                "photo_bbox": [round(x, 1) for x in img_info['bbox']]
            }

    elif len(matching_images) > 1:
        first_img = matching_images[0]
        try:
            xref = first_img.get("xref")
            extracted = doc.extract_image(xref) if xref else None
            if extracted and "image" in extracted:
                with open(out_path, "wb") as pf:
                    pf.write(extracted["image"])
            else:
                pix = page.get_pixmap(clip=fitz.Rect(first_img['bbox']), matrix=fitz.Matrix(2, 2))
                pix.save(str(out_path))
        except Exception:
            pass
        return {
            "status": "NEEDS_VERIFICATION",
            "photo_path": str(out_path.resolve()) if out_path.exists() else None,
            "photo_bbox": [round(x, 1) for x in first_img['bbox']]
        }

    else:
        # Scanned PDF check: Attempt high-res crop of the photo sub-region inside voter cell
        photo_sub_rect = fitz.Rect(
            cell.x0 + 0.65 * cell.width,
            cell.y0 + 0.12 * cell.height,
            cell.x1 - 2,
            cell.y1 - 4
        )
        try:
            pix = page.get_pixmap(clip=photo_sub_rect, matrix=fitz.Matrix(2, 2))
            img_pil = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
            stat = img_pil.getextrema()
            if stat[1] - stat[0] > 35:
                pix.save(str(out_path))
                return {
                    "status": "MATCHED",
                    "photo_path": str(out_path.resolve()),
                    "photo_bbox": [round(x, 1) for x in photo_sub_rect]
                }
        except Exception:
            pass

        return {
            "status": "MISSING",
            "photo_path": None,
            "photo_bbox": None
        }

def parse_voter_blocks(text, page_no):
    """Legacy voter block text parser maintained for backward compatibility."""
    records = []
    text = (text or "").replace("\xa0", " ")
    text = re.sub(r'(?i)\bPhoto\s*(?:Not\s*)?Available\b', '', text)
    text = re.sub(r'(?i)\b(?:Available|Photo)\b', '', text)
    text = re.sub(r'ఫోటో\s*అందుబాటులో\s*(?:ఉంది|లేదు|ఉన్నది)', '', text)
    text = re.sub(r'ఫోటో(?:\s*లేదు|\s*ఉంది)?', '', text)
    text = re.sub(r'(\n|^)([\u0C00-\u0C7F\w\.\s]+?)\n\s*:\s*', r'\1\2 : ', text)
    text = re.sub(r'గ్రా[ా-్]?\s*\n\s*\.పం', 'గ్రా.పం', text)
    text = re.sub(r'[వ]?ార్డు[ా-్]*\s*\n*\s*\.?\s*ఓ\.?\s*జా\.?\s*వ\.?\s*సం\.?', 'వార్డు.ఓ.జా.వ.సం.', text)
    text = re.sub(r'స్\s*\n\s*త్రీ', 'స్త్రీ', text)
    text = re.sub(r'తండ్రి[ి-్]?\s*\n\s*పేరు', 'తండ్రి పేరు', text)
    text = re.sub(r'భర్త[ా-్]?\s*\n\s*పేరు', 'భర్త పేరు', text)
    text = re.sub(r'ఇంటి\s*\n\s*సంఖ్య', 'ఇంటి సంఖ్య', text)
    text = re.sub(r'ఓటరు\s*ఐడి[\.\s]*\n\s*కార్డు', 'ఓటరు ఐడి కార్డు', text)

    parts = re.split(r'(?=(?:గ్రా\.పం\.ఓ\.జా\.వ\.సం\.|[వ]?ార్డు\.ఓ\.జా\.వ\.సం\.|వార్డు\.ఓ\.జా\.వ\.సం\.|ార్డు\.ఓ\.జా\.వ\.సం\.|వ\.సం\s*:))', text)
    for p in parts:
        if not p.strip() or not any(k in p for k in ['గ్రా.పం.ఓ.జా.వ.సం.', 'వార్డు.ఓ.జా.వ.సం.', 'ార్డు.ఓ.జా.వ.సం.', 'వ.సం']):
            continue
        parsed = parse_voter_cell_text(p, page_no)
        records.append({
            "record_id": int(parsed["serial_no"]) if parsed["serial_no"].isdigit() else len(records) + 1,
            "page": page_no,
            "serial_no": parsed["serial_no"],
            "electoral_roll_no": parsed["electoral_roll_no"],
            "voter_name": parsed["voter_name"],
            "relation_type": parsed["relation_type"],
            "relation_name": parsed["relation_name"],
            "house_no": parsed["house_no"],
            "age": parsed["age"],
            "gender": parsed["gender"],
            "voter_id": parsed["voter_id"],
            "block_bbox": None,
            "photo_bbox": None,
            "photo_path": None,
            "image_matching_status": "MISSING",
            "title": f"ఓటరు రికార్డు {parsed['serial_no']} (పుట {page_no})",
            "fields": parsed["fields"]
        })
    return records

def extract_structured_records(pages, tables, doc=None, doc_id=None):
    """
    Extract all structured key-value records (e.g. voter records, tabular data, forms)
    from pages while strictly preserving original Telugu Unicode text, numbers, and photos.
    """
    records = []
    doc_id = doc_id or "doc_" + uuid.uuid4().hex[:12]
    
    # Priority 1: High-Precision Spatial Voter Block & Photo Extraction
    if doc is not None:
        for p_idx in range(len(doc)):
            page = doc[p_idx]
            page_no = p_idx + 1
            text = page.get_text("text") or ""
            
            is_voter_page = any(kw in text for kw in ["వ.సం", "గ్రా.పం", "వార్డు", "ఓటరు", "ఓటర్", "లింగం", "లింగము", "ఇంటి సంఖ్య", "Sl.No", "S.No", "EPIC", "Voter", "voter"])
            if is_voter_page:
                cells = detect_voter_cells(page)
                if cells:
                    img_infos = page.get_image_info(xrefs=True)
                    for c_idx, cell in enumerate(cells):
                        raw_cell_text = page.get_text("text", clip=cell)
                        parsed = parse_voter_cell_text(raw_cell_text, page_no)
                        
                        sno_val = parsed["serial_no"]
                        rec_id = int(sno_val) if sno_val.isdigit() else (len(records) + 1)
                        
                        photo_meta = match_and_extract_voter_photo(
                            doc, page, cell, page_no, sno_val, parsed["voter_id"], doc_id, img_infos
                        )
                        
                        rec_dict = {
                            "record_id": rec_id,
                            "page": page_no,
                            "serial_no": sno_val,
                            "electoral_roll_no": parsed["electoral_roll_no"],
                            "voter_name": parsed["voter_name"],
                            "relation_type": parsed["relation_type"],
                            "relation_name": parsed["relation_name"],
                            "house_no": parsed["house_no"],
                            "age": parsed["age"],
                            "gender": parsed["gender"],
                            "voter_id": parsed["voter_id"],
                            "block_bbox": f"[{cell.x0:.1f},{cell.y0:.1f},{cell.x1:.1f},{cell.y1:.1f}]",
                            "photo_bbox": f"[{photo_meta['photo_bbox'][0]:.1f},{photo_meta['photo_bbox'][1]:.1f},{photo_meta['photo_bbox'][2]:.1f},{photo_meta['photo_bbox'][3]:.1f}]" if photo_meta.get("photo_bbox") else None,
                            "photo_path": photo_meta.get("photo_path"),
                            "image_matching_status": photo_meta.get("status", "MISSING"),
                            "title": f"ఓటరు రికార్డు {sno_val} (పుట {page_no})",
                            "fields": parsed["fields"]
                        }
                        records.append(rec_dict)
                        
        if records:
            return records

    # Priority 2: Text-only voter block parsing fallback
    for p in pages:
        page_no = p.get("page", 1)
        text = p.get("text", "")
        if any(kw in text for kw in ["వ.సం", "గ్రా.పం", "వార్డు", "ఓటరు"]):
            v_recs = parse_voter_blocks(text, page_no)
            records.extend(v_recs)
            
    if records:
        return records

    # Priority 3: General key-value and paragraph block parser for other documents
    rec_counter = 1
    pattern = r'(?:^|\s+)([A-Za-z\u0C00-\u0C7F\.\s\(\)\/]+?)\s*[:\-]\s*([^:\n]+?)(?=(?:\s+[A-Za-z\u0C00-\u0C7F\.\s\(\)\/]+?\s*[:\-])|$)'
    
    for p in pages:
        page_no = p.get("page", 1)
        text = p.get("text", "")
        if not text:
            continue
            
        blocks = re.split(r'\n\s*\n', text.strip())
        for block in blocks:
            lines = [l.strip() for l in block.split('\n') if l.strip()]
            if not lines:
                continue
            fields = []
            first_num = None
            
            for line in lines:
                if line.isdigit() and not fields and not first_num:
                    first_num = line
                    continue
                    
                pairs = list(re.finditer(pattern, line))
                if pairs:
                    for m in pairs:
                        k = m.group(1).strip()
                        v = m.group(2).strip()
                        if k and len(k) > 1:
                            fields.append({"field_name": k, "value": v if v else "Not Available"})
                elif ':' in line or '-' in line:
                    sep = ':' if ':' in line else '-'
                    k, v = line.split(sep, 1)
                    k, v = k.strip(), v.strip()
                    if k:
                        fields.append({"field_name": k, "value": v if v else "Not Available"})
                else:
                    voter_id_match = re.search(r'\b([A-Z]{2,4}\d{6,8})\b', line)
                    if voter_id_match:
                        fields.append({"field_name": "గుర్తింపు కార్డు నెం.", "value": voter_id_match.group(1)})

            if first_num:
                has_serial = any("సం" in f["field_name"] for f in fields)
                if not has_serial:
                    fields.insert(0, {"field_name": "వరుస సంఖ్య", "value": first_num})
                    
            if fields:
                s_val = next((f["value"] for f in fields if any(k in f["field_name"] for k in ["సంఖ్య", "సం", "Sl", "S.No"])), str(rec_counter))
                v_val = next((f["value"] for f in fields if any(k in f["field_name"] for k in ["కార్డు", "గుర్తింపు", "ఐడి", "EPIC", "ID"])), "Not Available")
                records.append({
                    "record_id": rec_counter,
                    "page": page_no,
                    "serial_no": s_val,
                    "voter_id": v_val,
                    "image_matching_status": "MISSING",
                    "title": f"రికార్డు {rec_counter} (పేజీ {page_no})",
                    "fields": fields
                })
                rec_counter += 1

    # Fallback to tables if no key-value records were identified
    if not records and tables:
        for t in tables:
            page_no = t.get("Page", 1)
            raw = t.get("Telugu / Original", "")
            if raw and " | " in raw:
                cells = [c.strip() for c in raw.split(" | ")]
                fields = [{"field_name": f"స్తంభం {idx+1}", "value": c if c else "Not Available"} for idx, c in enumerate(cells)]
                records.append({
                    "record_id": rec_counter,
                    "page": page_no,
                    "serial_no": str(rec_counter),
                    "voter_id": "Not Available",
                    "image_matching_status": "MISSING",
                    "title": f"టేబుల్ రికార్డు {rec_counter} (పేజీ {page_no})",
                    "fields": fields
                })
                rec_counter += 1
                
    return records


def extract_single_page_records(doc, page_no: int, doc_id: str):
    """
    Extract structured voter records with photos strictly for a single page (1-based index).
    Returns a list of voter record dictionaries.
    """
    p_idx = page_no - 1
    if p_idx < 0 or p_idx >= len(doc):
        return []

    page = doc[p_idx]
    text = page.get_text("text") or ""
    records = []

    is_voter_page = any(kw in text for kw in [
        "వ.సం", "గ్రా.పం", "వార్డు", "ఓటరు", "ఓటర్", "లింగం", "లింగము", "ఇంటి సంఖ్య",
        "Sl.No", "S.No", "EPIC", "Voter", "voter"
    ])

    if is_voter_page:
        cells = detect_voter_cells(page)
        if cells:
            img_infos = page.get_image_info(xrefs=True)
            for c_idx, cell in enumerate(cells):
                raw_cell_text = page.get_text("text", clip=cell)
                parsed = parse_voter_cell_text(raw_cell_text, page_no)

                sno_val = parsed["serial_no"]
                rec_id = int(sno_val) if sno_val.isdigit() else (c_idx + 1)

                photo_meta = match_and_extract_voter_photo(
                    doc, page, cell, page_no, sno_val, parsed["voter_id"], doc_id, img_infos
                )

                rec_dict = {
                    "record_id": rec_id,
                    "page": page_no,
                    "serial_no": sno_val,
                    "electoral_roll_no": parsed["electoral_roll_no"],
                    "voter_name": parsed["voter_name"],
                    "relation_type": parsed["relation_type"],
                    "relation_name": parsed["relation_name"],
                    "house_no": parsed["house_no"],
                    "age": parsed["age"],
                    "gender": parsed["gender"],
                    "voter_id": parsed["voter_id"],
                    "block_bbox": f"[{cell.x0:.1f},{cell.y0:.1f},{cell.x1:.1f},{cell.y1:.1f}]",
                    "photo_bbox": f"[{photo_meta['photo_bbox'][0]:.1f},{photo_meta['photo_bbox'][1]:.1f},{photo_meta['photo_bbox'][2]:.1f},{photo_meta['photo_bbox'][3]:.1f}]" if photo_meta.get("photo_bbox") else None,
                    "photo_path": photo_meta.get("photo_path"),
                    "image_matching_status": photo_meta.get("status", "MISSING"),
                    "title": f"ఓటరు రికార్డు {sno_val} (పుట {page_no})",
                    "fields": parsed["fields"]
                }
                records.append(rec_dict)

    if not records and any(kw in text for kw in ["వ.సం", "గ్రా.పం", "వార్డు", "ఓటరు"]):
        records = parse_voter_blocks(text, page_no)

    return records


def extract_single_page_data(doc, page_no: int, doc_id: str, ollama_url=None, model_name=None, use_ai=False):
    """
    Extract text, tables, paragraphs, and structured records for a single page.
    Handles exceptions per-page so failure on one page does not block others.
    """
    try:
        p_idx = page_no - 1
        if p_idx < 0 or p_idx >= len(doc):
            return {
                "page_number": page_no,
                "status": "failed",
                "error": f"Page index {page_no} out of bounds",
                "records": [],
                "voter_count": 0
            }

        page = doc[p_idx]
        embedded = page.get_text("text") or ""
        method = "Embedded PDF text"
        text = clean(embedded)

        if len(text) < 35:
            # Scanned page fallback
            try:
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                ocr_text = clean(ocr(Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")))
                if ocr_text:
                    text = ocr_text
                    method = "Telugu + English OCR"
                else:
                    text = f"[పేజీ {page_no}: స్కాన్ చేసిన చిత్రం లేదా గ్రాఫిక్స్]"
                    method = "Graphics / Image"
            except Exception as ocr_err:
                text = f"[పేజీ {page_no}: OCR లోపం - {ocr_err}]"
                method = "OCR Error"

        records = extract_single_page_records(doc, page_no, doc_id)
        page_tables = []
        page_paras = []

        for p in paragraphs(text):
            page_paras.append({
                "Page": page_no,
                "Heading (Telugu)": "",
                "Heading (English)": "",
                "Telugu paragraph": p,
                "English translation": ""
            })

        return {
            "page_number": page_no,
            "status": "completed",
            "method": method,
            "text": text,
            "records": records,
            "tables": page_tables,
            "paragraphs": page_paras,
            "voter_count": len(records),
            "error": None
        }
    except Exception as exc:
        return {
            "page_number": page_no,
            "status": "failed",
            "method": "Failed",
            "text": "",
            "records": [],
            "tables": [],
            "paragraphs": [],
            "voter_count": 0,
            "error": str(exc)
        }


def process_pdf(data, filename, ollama_url=None, model_name=None, use_ai=None, doc_id=None):
    doc = fitz.open(stream=data, filetype="pdf")
    if doc.is_encrypted or not len(doc):
        raise ValueError("PDF is encrypted or contains no pages.")
        
    doc_id = doc_id or "doc_" + uuid.uuid4().hex[:12]
    pages, tables, paras = [], [], []
    text_pages = ocr_pages = 0
    review_notes = [
        "All Telugu Unicode text, names, numbers and voter IDs strictly preserved.",
        "Check extracted fields and photograph spatial bounds against source pages."
    ]

    ollama_url = ollama_url or settings.OLLAMA_BASE_URL
    model_name = model_name or settings.OLLAMA_MODEL
    if not settings.OLLAMA_ENABLED:
        use_ai = False
    elif use_ai is None:
        use_ai = settings.OLLAMA_ENABLED

    ollama_online = False
    if use_ai:
        try:
            r = requests.get(ollama_url.rstrip("/") + "/api/tags", timeout=1.2)
            if r.status_code == 200:
                ollama_online = True
            else:
                review_notes.insert(0, f"Ollama returned HTTP {r.status_code}. Raw Telugu extracted without AI translation.")
        except Exception:
            review_notes.insert(0, f"Ollama is offline at {ollama_url}. Raw Telugu content extracted cleanly without AI.")

    pdf_plumber_doc = None

    try:
        for i in range(len(doc)):
            page = doc[i]
            embedded = page.get_text("text") or ""
            digital = []
            
            if len(clean(embedded)) >= 35:
                text = clean(embedded)
                method = "Embedded PDF text"
                text_pages += 1

                is_voter_page = any(kw in text for kw in ["వ.సం", "గ్రా.పం", "ఓటరు", "ఓటర్", "లింగం", "లింగము", "Sl.No", "S.No", "EPIC", "Voter", "voter"])

                if not is_voter_page:
                    if pdf_plumber_doc is None:
                        try:
                            pdf_plumber_doc = pdfplumber.open(io.BytesIO(data))
                        except Exception:
                            pdf_plumber_doc = False
                    if pdf_plumber_doc and i < len(pdf_plumber_doc.pages):
                        try:
                            extracted_tables = pdf_plumber_doc.pages[i].extract_tables() or []
                            for tn, table in enumerate(extracted_tables, 1):
                                for rn, row in enumerate(table, 1):
                                    cells = [clean(str(c or "")) for c in row]
                                    if any(cells):
                                        digital.append({
                                            "Page": i + 1,
                                            "Table": f"Table {tn}",
                                            "Row": rn,
                                            "Telugu / Original": " | ".join(cells),
                                            "English": ""
                                        })
                        except Exception:
                            pass
            else:
                # Scanned PDF processing
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                text = clean(ocr(Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")))
                method = "Telugu + English OCR"
                ocr_pages += 1
                if not text:
                    text = f"[పేజీ {i+1}: స్కాన్ చేసిన చిత్రం లేదా గ్రాఫిక్స్]"
                    
            pages.append({"page": i + 1, "method": method, "text": text})

            if text and ollama_online:
                try:
                    result = ai_structure(text, i + 1, ollama_url, model_name)
                    ai_tables = result.get("tables", [])
                    if not ai_tables:
                        tables.extend(digital)
                    for row in ai_tables:
                        tables.append({
                            "Page": i + 1,
                            "Table": row.get("table_name", "Table"),
                            "Row": row.get("row_number", 1),
                            "Telugu / Original": " | ".join(map(str, row.get("telugu_cells", []))),
                            "English": " | ".join(map(str, row.get("english_cells", [])))
                        })
                    for p in result.get("paragraphs", []):
                        paras.append({
                            "Page": i + 1,
                            "Heading (Telugu)": p.get("heading_te", ""),
                            "Heading (English)": p.get("heading_en", ""),
                            "Telugu paragraph": p.get("text_te", ""),
                            "English translation": p.get("text_en", "")
                        })
                except Exception:
                    tables.extend(digital)
                    for p in paragraphs(text):
                        paras.append({
                            "Page": i + 1,
                            "Heading (Telugu)": "",
                            "Heading (English)": "",
                            "Telugu paragraph": p,
                            "English translation": ""
                        })
            else:
                tables.extend(digital)
                for p in paragraphs(text):
                    paras.append({
                        "Page": i + 1,
                        "Heading (Telugu)": "",
                        "Heading (English)": "",
                        "Telugu paragraph": p,
                        "English translation": ""
                    })

        # Extract structured records using the live PyMuPDF document for spatial containment
        records = extract_structured_records(pages, tables, doc=doc, doc_id=doc_id)

    finally:
        if pdf_plumber_doc:
            try:
                pdf_plumber_doc.close()
            except Exception:
                pass
        doc.close()

    # Ensure all pages with text have paragraphs
    have = {p["Page"] for p in paras}
    for p in pages:
        if p["text"] and p["page"] not in have:
            paras.append({
                "Page": p["page"],
                "Heading (Telugu)": "",
                "Heading (English)": "",
                "Telugu paragraph": p["text"],
                "English translation": ""
            })

    en = [{"Page": r["Page"], "Table": r["Table"], "Row": r["Row"], "English / Translation": r["English"]} for r in tables]

    matched_photos = sum(1 for r in records if r.get("image_matching_status") == "MATCHED")
    missing_photos = sum(1 for r in records if r.get("image_matching_status") == "MISSING")
    verification_photos = sum(1 for r in records if r.get("image_matching_status") == "NEEDS_VERIFICATION")

    return {
        "metadata": {
            "filename": filename,
            "page_count": len(pages),
            "text_pages": text_pages,
            "ocr_pages": ocr_pages,
            "records_count": len(records),
            "matched_photos_count": matched_photos,
            "missing_photos_count": missing_photos,
            "needs_verification_count": verification_photos
        },
        "pages": pages,
        "table_rows_te": tables,
        "table_rows_en": en,
        "paragraphs": paras,
        "records": records,
        "validation": {
            "expected_pages": len(pages),
            "processed_pages": len(pages),
            "pages_without_text": [p["page"] for p in pages if not p["text"]],
            "review_notes": review_notes
        }
    }
