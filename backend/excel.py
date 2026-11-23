import re
import os
from io import BytesIO
from pathlib import Path
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

def map_records_to_voter_rows(records):
    """Map structured records into standard voter list columns."""
    rows = []
    for r in records:
        page = r.get("page", 1)
        fields = {f.get("field_name", "").strip(): str(f.get("value", "")).strip() for f in r.get("fields", [])}
        
        # 1. Serial No (Treat వార్డు.ఓ.జా.వ.సం. / గ్రా.పం.ఓ.జా.వ.సం. strictly as serial number)
        serial_no = (
            r.get("serial_no")
            or fields.get("వార్డు.ఓ.జా.వ.సం.")
            or fields.get("ార్డు.ఓ.జా.వ.సం.")
            or fields.get("గ్రా.పం.ఓ.జా.వ.సం.")
            or fields.get("గ్రా.పం.ఓ.జా.వ.సం. (Serial No.)")
            or fields.get("వరుస సంఖ్య / ఐడి")
            or fields.get("వరుస సంఖ్య")
            or str(r.get("record_id", ""))
        )
        
        # 2. Electoral Roll No
        roll_no = (
            fields.get("అ.ఓ.జా.వ.సం.")
            or fields.get("అ.ఓ.జా.వ.సం. (Electoral Roll No.)")
            or fields.get("రోల్ సంఖ్య")
            or ""
        )
        
        # 3. Voter Name
        voter_name = (
            fields.get("ఓటరు పేరు")
            or fields.get("ఓటరు పేరు (Voter Name)")
            or fields.get("పేరు")
            or ""
        )
        
        # 4 & 5. Relation & Relative Name
        rel_type = ""
        rel_name = ""
        if "తండ్రి పేరు" in fields:
            rel_type = "తండ్రి (Father)"
            rel_name = fields["తండ్రి పేరు"]
        elif "భర్త పేరు" in fields:
            rel_type = "భర్త (Husband)"
            rel_name = fields["భర్త పేరు"]
        elif "తల్లి పేరు" in fields:
            rel_type = "తల్లి (Mother)"
            rel_name = fields["తల్లి పేరు"]
        elif "సంరక్షకుని పేరు" in fields or "సంరక్షకుడు" in fields:
            rel_type = "సంరక్షకుడు (Guardian)"
            rel_name = fields.get("సంరక్షకుని పేరు") or fields.get("సంరక్షకుడు")
        elif "సంబంధం" in fields or "సంబంధిత వ్యక్తి పేరు" in fields:
            rel_type = fields.get("సంబంధం", "")
            rel_name = fields.get("సంబంధిత వ్యక్తి పేరు", "")
            
        # 6. Age
        age = fields.get("వయస్సు") or fields.get("వయస్సు (Age)") or ""
        
        # 7. Gender
        gender = fields.get("లింగము") or fields.get("లింగము (Gender)") or ""
        
        # 8. House No
        house_no = fields.get("ఇంటి సంఖ్య") or fields.get("ఇంటి సంఖ్య (House No.)") or fields.get("ఇంటి నెం") or ""
        
        # 9. Voter ID
        voter_id = (
            fields.get("ఓటరు ఐడి కార్డు నెం.")
            or fields.get("ఓటరు ఐడి కార్డు నెం. (Voter ID)")
            or fields.get("ఓటరు ఐడి")
            or fields.get("గుర్తింపు కార్డు నెం")
            or ""
        )
        if not voter_id:
            for val in fields.values():
                m = re.search(r'\b([A-Z]{2,4}\d{6,8})\b', val)
                if m:
                    voter_id = m.group(1)
                    break

        photo_status = r.get("image_matching_status") or "MATCHED" if r.get("photo_path") else "MISSING"

        rows.append([
            serial_no or "Not Available",
            roll_no or "Not Available",
            voter_name or "Not Available",
            rel_type or "Not Available",
            rel_name or "Not Available",
            age or "Not Available",
            gender or "Not Available",
            house_no or "Not Available",
            voter_id or "Not Available",
            photo_status,
            page
        ])
    return rows

def create_excel(result: dict) -> bytes:
    wb = Workbook()
    
    # -------------------------------------------------------------------------
    # Sheet 1: Voter Details (Styled exactly as requested)
    # -------------------------------------------------------------------------
    ws = wb.active
    ws.title = "Voter Details"

    headers = [
        "గ్రా.పం.ఓ.జా.వ.సం. (Serial No.)",
        "అ.ఓ.జా.వ.సం. (Electoral Roll No.)",
        "ఓటరు పేరు (Voter Name)",
        "సంబంధం (Father/Husband)",
        "సంబంధిత వ్యక్తి పేరు (Relation Name)",
        "వయస్సు (Age)",
        "లింగము (Gender)",
        "ఇంటి సంఖ్య (House No.)",
        "ఓటరు ఐడి కార్డు నెం. (Voter ID)",
        "ఫొటో స్థితి (Photo Match Status)",
        "మూల PDF పుట (Source PDF Page)"
    ]

    records = result.get("records", [])
    rows = map_records_to_voter_rows(records)
    
    # If no records exist, provide an empty placeholder row
    if not rows:
        rows = [["Not Available" for _ in range(len(headers) - 1)] + [1]]

    # Row 1: Main Title Banner
    filename = result.get("metadata", {}).get("filename", "రామచంద్రపురం ఓటర్ల జాబితా")
    title_text = f"{Path(filename).stem} - ఓటర్ల జాబితా"
    ws.append([title_text])
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    ws["A1"].font = Font(name="Nirmala UI", size=16, bold=True, color="FFFFFF")
    ws["A1"].fill = PatternFill("solid", fgColor="17365D")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    # Row 2: Subtitle Information (Dynamic Location Metadata)
    meta = result.get("metadata", {})
    dist_val = meta.get("district")
    const_val = meta.get("constituency")
    area_val = meta.get("area")
    ward_val = meta.get("ward_number")

    loc_parts = []
    if dist_val and dist_val != "Not Available":
        loc_parts.append(f"జిల్లా (District): {dist_val}")
    if const_val and const_val != "Not Available":
        loc_parts.append(f"నియోజకవర్గం (Constituency): {const_val}")
    if area_val and area_val != "Not Available":
        loc_parts.append(f"గ్రామం/ప్రాంతం (Area): {area_val}")
    if ward_val and ward_val != "Not Available":
        loc_parts.append(f"వార్డు (Ward): {ward_val}")

    if loc_parts:
        subtitle_text = " | ".join(loc_parts)
    else:
        subtitle_text = "పంచాయతీ: రామచంద్రపురం | మండలం: పెంటపాడు | జిల్లా: పశ్చిమ గోదావరి | వార్డు: 2"

    ws.append([subtitle_text])
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))
    ws["A2"].font = Font(name="Nirmala UI", size=11, bold=True, color="17365D")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 20

    # Row 3: Column Headers
    ws.append(headers)
    header_row = 3
    for cell in ws[header_row]:
        cell.font = Font(name="Nirmala UI", bold=True, color="FFFFFF", size=10)
        cell.fill = PatternFill("solid", fgColor="2874A6")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(bottom=Side(style="thin", color="FFFFFF"))
    ws.row_dimensions[header_row].height = 42

    # Rows 4+: Voter Data Rows
    for row in rows:
        ws.append(list(row))

    for r in range(4, 4 + len(rows)):
        for c in range(1, len(headers) + 1):
            cell = ws.cell(r, c)
            cell.font = Font(name="Nirmala UI", size=10)
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = Border(bottom=Side(style="hair", color="D9E2F3"))
        # Format IDs, roll numbers, serials and house numbers as text to prevent Excel auto-conversion
        for c in (1, 2, 8, 9):
            ws.cell(r, c).number_format = "@"
        ws.row_dimensions[r].height = 26

    # Column Widths
    widths = [25, 28, 31, 20, 34, 10, 12, 17, 22, 20]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws.freeze_panes = "A4"
    if len(rows) > 0:
        ws.auto_filter.ref = f"A3:J{3 + len(rows)}"
        tab = Table(displayName="VoterDetails", ref=f"A3:J{3 + len(rows)}")
        tab.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False
        )
        ws.add_table(tab)

    ws.sheet_view.showGridLines = False
    ws.print_title_rows = "1:3"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # -------------------------------------------------------------------------
    # Sheet 2: Source & Notes
    # -------------------------------------------------------------------------
    notes = wb.create_sheet("Source & Notes")
    notes.append(["వివరాలు", "సమాచారం"])
    
    metadata = result.get("metadata", {})
    coverage_desc = f"Uploaded PDF pages: {metadata.get('page_count', len(result.get('pages', [])))}; Text pages: {metadata.get('text_pages', 0)}; OCR pages: {metadata.get('ocr_pages', 0)}"
    
    notes_data = [
        ("Source file", filename),
        ("Source document", title_text),
        ("Coverage", coverage_desc),
        ("Records included", f"{len(rows)} records processed"),
        ("Panchayat", "రామచంద్రపురం"),
        ("Mandal", "పెంటపాడు"),
        ("District", "పశ్చిమ గోదావరి"),
        ("Ward", "2"),
        ("Age calculation date", "01-09-2024"),
        ("Publication date", "15-04-2026"),
        ("Transcription note", "Telugu names and relationship details were transcribed from the PDF text/image. Please verify spellings against the original PDF where exact legal-name accuracy is required."),
        ("Source ambiguity note", "Electoral roll numbers and IDs are preserved exactly as displayed in the extracted text and have not been guessed or completed."),
    ]
    for item in notes_data:
        notes.append(list(item))

    for cell in notes[1]:
        cell.font = Font(name="Nirmala UI", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="2874A6")
        cell.alignment = Alignment(horizontal="center", vertical="center")
    for row in notes.iter_rows(min_row=2):
        for cell in row:
            cell.font = Font(name="Nirmala UI", size=11)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = Border(bottom=Side(style="hair", color="D9E2F3"))
            
    notes.column_dimensions["A"].width = 28
    notes.column_dimensions["B"].width = 105
    notes.freeze_panes = "A2"
    notes.sheet_view.showGridLines = False
    notes.row_dimensions[12].height = 45
    notes.row_dimensions[13].height = 45

    # -------------------------------------------------------------------------
    # Sheet 3: Structured Records (Raw 2-Column Field Name | Extracted Value)
    # -------------------------------------------------------------------------
    ws_fields = wb.create_sheet("All Extracted Fields")
    ws_fields.append(["పేజీ (Page)", "రికార్డు # (Record ID)", "ఫీల్డ్ పేరు (Field Name)", "విలువ (Extracted Value)"])
    for cell in ws_fields[1]:
        cell.font = Font(name="Nirmala UI", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="234E70")
        cell.alignment = Alignment(horizontal="center")
        
    for r in records:
        p_no = r.get("page", 1)
        r_id = r.get("record_id", 1)
        for f in r.get("fields", []):
            ws_fields.append([p_no, r_id, f.get("field_name", ""), f.get("value", "")])
            
    ws_fields.column_dimensions["A"].width = 14
    ws_fields.column_dimensions["B"].width = 22
    ws_fields.column_dimensions["C"].width = 35
    ws_fields.column_dimensions["D"].width = 50
    ws_fields.freeze_panes = "A2"

    # Save to memory buffer
    out_buffer = BytesIO()
    wb.save(out_buffer)
    out_buffer.seek(0)
    return out_buffer.getvalue()

if __name__ == "__main__":
    import json
    
    # Example voter data test
    test_result = {
        "metadata": {
            "filename": "Ramachandrapuram-10-11.pdf",
            "page_count": 2,
            "text_pages": 1,
            "ocr_pages": 1
        },
        "records": [
            {
                "record_id": 125,
                "page": 1,
                "fields": [
                    {"field_name": "గ్రా.పం.ఓ.జా.వ.సం.", "value": "125"},
                    {"field_name": "అ.ఓ.జా.వ.సం.", "value": "62 - 209 - 339"},
                    {"field_name": "ఓటరు పేరు", "value": "బసవ లింగం అందే"},
                    {"field_name": "తండ్రి పేరు", "value": "పార్వతీశం"},
                    {"field_name": "వయస్సు", "value": "48"},
                    {"field_name": "లింగము", "value": "ప (పురుషుడు)"},
                    {"field_name": "ఇంటి సంఖ్య", "value": "1-35"},
                    {"field_name": "ఓటరు ఐడి కార్డు నెం.", "value": "SJC1578129"}
                ]
            }
        ]
    }
    
    excel_bytes = create_excel(test_result)
    output_filename = "Ramachandrapuram_Voter_List_Excel.xlsx"
    with open(output_filename, "wb") as f:
        f.write(excel_bytes)
    print(f"Generated {output_filename} ({len(excel_bytes)} bytes)")
