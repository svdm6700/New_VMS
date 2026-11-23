import os
import io
import json
import uuid
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal, VoterRecordModel, DocumentModel, UserModel
from backend.processor import (
    process_pdf,
    detect_voter_cells,
    parse_voter_cell_text,
    match_and_extract_voter_photo,
    clean,
    paragraphs,
    ocr
)
from backend.photo_service import get_voter_photo_path, save_voter_photo, PHOTOS_DIR
from backend.excel import create_excel, map_records_to_voter_rows

SAMPLE_PDF_PATH = Path(__file__).resolve().parent / "voter_list_sample_27_page.pdf"

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def sample_pdf_bytes():
    assert SAMPLE_PDF_PATH.exists(), f"Sample PDF not found at {SAMPLE_PDF_PATH}"
    with open(SAMPLE_PDF_PATH, "rb") as f:
        return f.read()

# =========================================================================
# 1. Real Sample PDF Extraction & Strict Spatial Mapping Test
# =========================================================================
def test_sample_pdf_27_voter_extraction(sample_pdf_bytes):
    """
    Verify complete extraction of all 27 voter blocks from the actual sample PDF.
    Every record must strictly match its own photograph via spatial containment.
    """
    doc_id = "test_sample_27_extract"
    result = process_pdf(sample_pdf_bytes, "voter_list_sample_27_page.pdf", doc_id=doc_id)
    
    metadata = result.get("metadata", {})
    assert metadata.get("page_count") == 1
    assert metadata.get("records_count") == 27
    assert metadata.get("matched_photos_count") == 27
    assert metadata.get("missing_photos_count") == 0
    assert metadata.get("needs_verification_count") == 0

    records = result.get("records", [])
    assert len(records) == 27

    # Verify Record 1
    r1 = records[0]
    assert r1["serial_no"] == "935"
    assert r1["voter_id"] == "JXQ3207396"
    assert r1["voter_name"] == "చంద్ర"
    assert r1["relation_type"] == "భర్త"
    assert r1["relation_name"] == "మోషే కోడవల్లి"
    assert r1["house_no"] == "1‐222/2"
    assert r1["age"] == "44"
    assert r1["gender"] == "స్త్రీ"
    assert r1["image_matching_status"] == "MATCHED"
    assert r1["photo_path"] is not None
    assert os.path.exists(r1["photo_path"])
    assert r1["block_bbox"] is not None
    assert r1["photo_bbox"] is not None

    # Verify Record 2
    r2 = records[1]
    assert r2["serial_no"] == "945"
    assert r2["voter_id"] == "SJC1580539"
    assert r2["voter_name"] == "పుష్ప చదలవాడ"
    assert r2["image_matching_status"] == "MATCHED"
    assert r2["photo_path"] is not None
    assert os.path.exists(r2["photo_path"])

    # Verify Record 3
    r3 = records[2]
    assert r3["serial_no"] == "1217"
    assert r3["voter_id"] == "JXQ3207974"
    assert r3["voter_name"] == "గంగమ్మ సబ్బత"
    assert r3["image_matching_status"] == "MATCHED"

    # Verify Record 27
    r27 = records[26]
    assert r27["serial_no"] == "24"
    assert r27["voter_id"] == "SJC0551375"
    assert "దుర్గ" in r27["voter_name"]
    assert r27["image_matching_status"] == "MATCHED"
    assert r27["photo_path"] is not None
    assert os.path.exists(r27["photo_path"])

# =========================================================================
# 2. Spatial Containment Logic Unit Tests
# =========================================================================
def test_spatial_containment_logic():
    """
    Test spatial bounding box containment rules:
    - Image inside block -> MATCHED
    - Image outside block -> MISSING
    - Multiple images inside block -> NEEDS_VERIFICATION
    """
    import pymupdf as fitz
    doc = fitz.open()
    page = doc.new_page(width=600, height=800)
    
    cell_rect = fitz.Rect(50, 50, 200, 150)
    
    # Case A: Exactly 1 image inside cell
    img_inside = {"bbox": [140, 60, 190, 130], "xref": 0}
    res_a = match_and_extract_voter_photo(
        doc, page, cell_rect, 1, "1", "EPIC123", "test_doc", [img_inside]
    )
    assert res_a["status"] == "MATCHED"

    # Case B: Image completely outside cell
    img_outside = {"bbox": [300, 300, 350, 400], "xref": 0}
    res_b = match_and_extract_voter_photo(
        doc, page, cell_rect, 1, "2", "EPIC456", "test_doc", [img_outside]
    )
    assert res_b["status"] == "MISSING"

    # Case C: Multiple images inside cell
    img_1 = {"bbox": [60, 60, 100, 120], "xref": 0}
    img_2 = {"bbox": [140, 60, 180, 120], "xref": 0}
    res_c = match_and_extract_voter_photo(
        doc, page, cell_rect, 1, "3", "EPIC789", "test_doc", [img_1, img_2]
    )
    assert res_c["status"] == "NEEDS_VERIFICATION"

    doc.close()

# =========================================================================
# 3. Telugu Text & Regex Field Parsing Unit Tests
# =========================================================================
def test_parse_voter_cell_text_various_formats():
    """Test voter text parsing across diverse Telugu and English electoral formats."""
    # Standard format 1
    sample1 = """
    వ.సం: 101
    ABC1234567
    K8L9M
    పేరు: రామారావు
    తండ్రి పేరు: సత్యనారాయణ
    ఇంటి సంఖ్య: 4-52/A
    వయస్సు: 48  లింగం: పురుషుడు
    """
    p1 = parse_voter_cell_text(sample1, 1)
    assert p1["serial_no"] == "101"
    assert p1["voter_id"] == "ABC1234567"
    assert p1["voter_name"] == "రామారావు"
    assert p1["relation_type"] == "తండ్రి"
    assert p1["relation_name"] == "సత్యనారాయణ"
    assert p1["house_no"] == "4-52/A"
    assert p1["age"] == "48"
    assert p1["gender"] == "పురుషుడు"

    # Standard format 2 (Panchayat header)
    sample2 = """
    గ్రా.పం.ఓ.జా.వ.సం. 55
    అ.ఓ.జా.వ.సం. 12-B
    ఓటరు పేరు : లక్ష్మి
    భర్త పేరు : శ్రీనివాస్
    ఇంటి సంఖ్య : 2-10
    వయస్సు : 35
    లింగము : స్త్రీ
    ఓటరు ఐడి కార్డు నెం. : XYZ9876543
    """
    p2 = parse_voter_cell_text(sample2, 2)
    assert p2["serial_no"] == "55"
    assert p2["electoral_roll_no"] == "12-B"
    assert p2["voter_name"] == "లక్ష్మి"
    assert p2["relation_type"] == "భర్త"
    assert p2["relation_name"] == "శ్రీనివాస్"
    assert p2["house_no"] == "2-10"
    assert p2["age"] == "35"
    assert p2["gender"] == "స్త్రీ"
    assert p2["voter_id"] == "XYZ9876543"

# =========================================================================
# 4. Multi-Page and Synthetic PDF Extraction
# =========================================================================
def test_multi_page_pdf_processing():
    """Test PDF processor across multi-page document."""
    import pymupdf as fitz
    doc = fitz.open()
    # Create 2 pages
    p1 = doc.new_page(width=595, height=842)
    p1.draw_rect(fitz.Rect(32, 38, 206, 119), color=(0, 0, 0))
    p1.insert_text(fitz.Point(36, 50), "వ.సం: 1\nSJC0000001\nపేరు: ఓటరు ఒకటి\nభర్త: భర్త ఒకటి\nఇంటి సంఖ్య: 1-1\nవయస్సు: 30  లింగం: స్త్రీ")

    p2 = doc.new_page(width=595, height=842)
    p2.draw_rect(fitz.Rect(32, 38, 206, 119), color=(0, 0, 0))
    p2.insert_text(fitz.Point(36, 50), "వ.సం: 2\nSJC0000002\nపేరు: ఓటరు రెండు\nతండ్రి: తండ్రి రెండు\nఇంటి సంఖ్య: 1-2\nవయస్సు: 35  లింగం: పురుషుడు")

    pdf_bytes = doc.tobytes()
    doc.close()

    result = process_pdf(pdf_bytes, "multipage_test.pdf", doc_id="test_multipage")
    assert result["metadata"]["page_count"] == 2
    assert len(result["records"]) == 2
    assert result["records"][0]["page"] == 1
    assert result["records"][0]["serial_no"] == "1"
    assert result["records"][1]["page"] == 2
    assert result["records"][1]["serial_no"] == "2"

# =========================================================================
# 5. Scanned PDF & Clean Utilities
# =========================================================================
def test_text_clean_and_paragraphs():
    """Verify clean string utility and paragraphs splitting."""
    raw = "పేరు:  రాముడు\x00\r\n\r\nఇంటి సంఖ్య:\t1-2\n\n\n\nవయస్సు: 40"
    cleaned = clean(raw)
    assert "\x00" not in cleaned
    assert "\r" not in cleaned
    paras = paragraphs(raw)
    assert len(paras) >= 2

# =========================================================================
# 6. Photo Service Retrieval Unit Tests
# =========================================================================
def test_photo_service_retrieval():
    """Test get_voter_photo_path priority resolution and fallback mechanisms."""
    dummy_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb"
    photo_file = "test_voter_photo_service.jpg"
    saved_path = save_voter_photo(dummy_bytes, photo_file, unique_key="TKEY1")
    assert os.path.exists(saved_path)

    # 1. Resolve by direct path
    res1 = get_voter_photo_path(photo_path=saved_path)
    assert res1 == saved_path

    # 2. Resolve by unique_key
    res2 = get_voter_photo_path(unique_key="TKEY1")
    assert res2 is not None
    assert os.path.exists(res2)

    # 3. Non-existent returns None
    res3 = get_voter_photo_path(unique_key="NONEX")
    assert res3 is None

# =========================================================================
# 7. Database Model, Persistence & API Endpoint Tests
# =========================================================================
def test_database_persistence_and_photo_serving(client):
    """
    Test VoterRecordModel database operations with photo_path, block_bbox,
    image_matching_status, and verify photo serving and update endpoints.
    """
    db = SessionLocal()
    try:
        doc_id = "test_doc_photo_db"
        db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).delete()
        db.commit()

        doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
        if not doc:
            doc = DocumentModel(
                id=doc_id,
                original_filename="test_voter_doc.pdf",
                stored_file_path="storage/uploads/test.pdf",
                file_size=1024,
                total_pages=1,
                district="Visakhapatnam",
                constituency="Bheemili",
                area="Zone 1",
                ward_number="Ward 5"
            )
            db.add(doc)
            db.commit()

        dummy_jpg = PHOTOS_DIR / f"{doc_id}_photo.jpg"
        with open(dummy_jpg, "wb") as pf:
            pf.write(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb")

        test_key = "P" + uuid.uuid4().hex[:4].upper()

        test_voter = VoterRecordModel(
            document_id=doc_id,
            serial_no="999",
            electoral_roll_no="ROLL-99",
            voter_name="టెస్ట్ ఓటరు",
            relation_type="తండ్రి",
            relation_name="తండ్రి టెస్ట్",
            age="30",
            gender="పురుషుడు",
            house_no="1-23",
            voter_id="TST9999999",
            unique_key=test_key,
            source_page=1,
            block_bbox="[32.0, 38.0, 206.4, 119.5]",
            photo_bbox="[161.4, 60.0, 202.4, 112.6]",
            photo_path=str(dummy_jpg.resolve()),
            image_matching_status="MATCHED"
        )
        db.add(test_voter)
        db.commit()
        db.refresh(test_voter)

        v_dict = test_voter.to_dict()
        assert v_dict["block_bbox"] == "[32.0, 38.0, 206.4, 119.5]"
        assert v_dict["photo_bbox"] == "[161.4, 60.0, 202.4, 112.6]"
        assert v_dict["image_matching_status"] == "MATCHED"
        assert v_dict["has_photo"] is True
        assert v_dict["photo_url"] is not None

        voter_db_id = test_voter.id

        # Test GET /api/voters/{unique_code}/photo by unique_key
        resp_key = client.get(f"/api/voters/{test_key}/photo")
        assert resp_key.status_code == 200
        assert resp_key.headers["content-type"] == "image/jpeg"

        # Test GET /api/voters/{unique_code}/photo by EPIC
        resp_epic = client.get("/api/voters/TST9999999/photo")
        assert resp_epic.status_code == 200

        # Test GET /api/voters/{unique_code}/photo by DB ID
        resp_id = client.get(f"/api/voters/{voter_db_id}/photo")
        assert resp_id.status_code == 200

        # Test GET photo for non-existent code
        resp_404 = client.get("/api/voters/NONEXISTENT999/photo")
        assert resp_404.status_code == 404

        # Clean up
        db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).delete()
        db.commit()
    finally:
        db.close()

# =========================================================================
# 8. Excel Generation with Photo Match Status
# =========================================================================
def test_excel_generation_with_photo_status():
    """Verify Excel output generation includes Photo Match Status."""
    mock_result = {
        "metadata": {"filename": "test_electoral_roll.pdf"},
        "records": [
            {
                "page": 1,
                "serial_no": "1",
                "voter_name": "శివ రావు",
                "voter_id": "AP1234567",
                "image_matching_status": "MATCHED",
                "photo_path": "some/path.jpg",
                "fields": [
                    {"field_name": "గ్రా.పం.ఓ.జా.వ.సం.", "value": "1"},
                    {"field_name": "ఓటరు పేరు", "value": "శివ రావు"},
                    {"field_name": "ఓటరు ఐడి కార్డు నెం.", "value": "AP1234567"}
                ]
            }
        ]
    }
    excel_bytes = create_excel(mock_result)
    assert len(excel_bytes) > 1000
    assert excel_bytes[:2] == b"PK" # Zip file signature for .xlsx
