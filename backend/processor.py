import io
import os
import re
import json
import shutil
import requests
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

# Automatically locate Tesseract on Windows if not already in PATH
if not shutil.which("tesseract"):
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

def parse_voter_blocks(text, page_no):
    """Accurately parse Andhra Pradesh / Telangana Telugu electoral roll voter blocks."""
    records = []
    text = (text or "").replace("\xa0", " ")
    # Fix broken label lines where colon or label was split across newlines
    text = re.sub(r'(\n|^)([\u0C00-\u0C7F\w\.\s]+?)\n\s*:\s*', r'\1\2 : ', text)
    text = re.sub(r'గ్రా[ా-్]?\s*\n\s*\.పం', 'గ్రా.పం', text)
    text = re.sub(r'స్\s*\n\s*త్రీ', 'స్త్రీ', text)
    text = re.sub(r'తండ్రి[ి-్]?\s*\n\s*పేరు', 'తండ్రి పేరు', text)
    text = re.sub(r'భర్త[ా-్]?\s*\n\s*పేరు', 'భర్త పేరు', text)
    text = re.sub(r'ఇంటి\s*\n\s*సంఖ్య', 'ఇంటి సంఖ్య', text)
    text = re.sub(r'ఓటరు\s*ఐడి[\.\s]*\n\s*కార్డు', 'ఓటరు ఐడి కార్డు', text)

    parts = re.split(r'(?=గ్రా\.పం\.ఓ\.జా\.వ\.సం\.)', text)
    for p in parts:
        if not p.strip() or 'గ్రా.పం.ఓ.జా.వ.సం.' not in p:
            continue
        fields = []
        
        # 1. Serial No
        m_sno = re.search(r'గ్రా\.పం\.ఓ\.జా\.వ\.సం\.\s*(\d+)', p)
        sno = m_sno.group(1).strip() if m_sno else "Not Available"
        fields.append({"field_name": "గ్రా.పం.ఓ.జా.వ.సం.", "value": sno})
        
        # 2. Roll No
        m_roll = re.search(r'అ\.ఓ\.జా\.వ\.సం\.\s*([0-9\s\-]+)', p)
        roll = m_roll.group(1).strip() if m_roll else "Not Available"
        fields.append({"field_name": "అ.ఓ.జా.వ.సం.", "value": roll})
        
        # 3. Voter Name
        m_name = re.search(r'ఓటరు పేరు\s*:\s*([^\n\r]+)', p)
        name = m_name.group(1).strip() if m_name else "Not Available"
        fields.append({"field_name": "ఓటరు పేరు", "value": name})
        
        # 4 & 5. Relation Name
        m_father = re.search(r'తండ్రి\s*పేరు\s*:\s*([^\n\r]+)', p)
        m_husband = re.search(r'భర్త\s*పేరు\s*:\s*([^\n\r]+)', p)
        if m_father:
            fields.append({"field_name": "తండ్రి పేరు", "value": m_father.group(1).strip()})
        elif m_husband:
            fields.append({"field_name": "భర్త పేరు", "value": m_husband.group(1).strip()})
        else:
            fields.append({"field_name": "తండ్రి / భర్త పేరు", "value": "Not Available"})
            
        # 6. House No
        m_house = re.search(r'ఇంటి సంఖ్య\s*:\s*([^\n\r]+)', p)
        house = m_house.group(1).strip() if m_house else "Not Available"
        fields.append({"field_name": "ఇంటి సంఖ్య", "value": house})
        
        # 7. Voter ID
        m_vid = re.search(r'ఓటరు ఐడి[\.\s]*కార్డు నెం\.[\s:]*([A-Za-z0-9]+)', p)
        if not m_vid:
            m_vid = re.search(r'\b([A-Z]{2,4}\d{6,8})\b', p)
        vid = m_vid.group(1).strip() if m_vid else "Not Available"
        fields.append({"field_name": "ఓటరు ఐడి కార్డు నెం.", "value": vid})
        
        # 8. Age
        m_age = re.search(r'వయస్సు\s*:\s*(\d+)', p)
        age = m_age.group(1).strip() if m_age else "Not Available"
        fields.append({"field_name": "వయస్సు", "value": age})
        
        # 9. Gender
        m_gen = re.search(r'లింగము\s*:\s*([^\n\r]+)', p)
        gen = m_gen.group(1).strip() if m_gen else "Not Available"
        if "స్" in gen or "స్త్రీ" in gen:
            gen = "స్త్రీ"
        elif "పు" in gen or "పురుషుడు" in gen:
            gen = "పురుషుడు"
        fields.append({"field_name": "లింగము", "value": gen})
        
        # 10. Source Page
        fields.append({"field_name": "మూల PDF పుట", "value": str(page_no)})
        
        records.append({
            "record_id": int(sno) if sno.isdigit() else len(records) + 1,
            "page": page_no,
            "title": f"ఓటరు రికార్డు {sno} (పుట {page_no})",
            "fields": fields
        })
    return records

def extract_structured_records(pages, tables):
    """Extract all structured key-value records (e.g. voter records, tabular data, forms)
    from pages while strictly preserving original Telugu Unicode text and numbers."""
    records = []
    
    # Check for voter list structure first
    for p in pages:
        page_no = p.get("page", 1)
        text = p.get("text", "")
        if "గ్రా" in text and "పం" in text and "ఓ" in text:
            v_recs = parse_voter_blocks(text, page_no)
            records.extend(v_recs)
            
    if records:
        return records

    # General key-value and paragraph block parser for other documents
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
                records.append({
                    "record_id": rec_counter,
                    "page": page_no,
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
                    "title": f"టేబుల్ రికార్డు {rec_counter} (పేజీ {page_no})",
                    "fields": fields
                })
                rec_counter += 1
                
    return records

def process_pdf(data, filename, ollama_url=None, model_name=None, use_ai=None):
    doc = fitz.open(stream=data, filetype="pdf")
    if doc.is_encrypted or not len(doc):
        raise ValueError("PDF is encrypted or contains no pages.")
        
    pages, tables, paras = [], [], []
    text_pages = ocr_pages = 0
    review_notes = [
        "All Telugu Unicode text, names, numbers and voter IDs strictly preserved.",
        "Check extracted fields against source pages."
    ]

    ollama_url = ollama_url or settings.OLLAMA_BASE_URL
    model_name = model_name or settings.OLLAMA_MODEL
    # If OLLAMA_ENABLED is false in settings, disable AI structuring completely
    if not settings.OLLAMA_ENABLED:
        use_ai = False
    elif use_ai is None:
        use_ai = settings.OLLAMA_ENABLED

    # Pre-check Ollama connectivity once to prevent repeated hangs
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

    # Detect if PDF has voter records to skip redundant table analysis
    has_voter_structure = False

    # Open pdfplumber once for fast table extraction (only if not a pure voter list)
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

                # Check if page is an electoral roll page
                is_voter_page = ("గ్రా" in text and "పం" in text and "ఓ" in text)
                if is_voter_page:
                    has_voter_structure = True

                # Only extract digital tables if it is not a voter list page
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
                # OCR for scanned pages
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                text = clean(ocr(Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")))
                method = "Telugu + English OCR"
                ocr_pages += 1
                if not text:
                    text = f"[పేజీ {i+1}: స్కాన్ చేసిన చిత్రం లేదా గ్రాఫిక్స్]"
                    
            pages.append({"page": i + 1, "method": method, "text": text})

            # AI translation if Ollama is online
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
    records = extract_structured_records(pages, tables)

    return {
        "metadata": {
            "filename": filename,
            "page_count": len(pages),
            "text_pages": text_pages,
            "ocr_pages": ocr_pages,
            "records_count": len(records)
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
