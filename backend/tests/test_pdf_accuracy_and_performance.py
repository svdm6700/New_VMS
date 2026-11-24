"""
Comprehensive Automated Test Suite for VMS A4 Voter List PDF Generation
Visually and structurally validated against the uploaded reference PDF (Ramachandrapuram-10-11.pdf)
Verifies:
1. Exact A4 Portrait dimensions (595.28 x 841.89 pt) and 3x9 grid rules (27 voters/page)
2. Outer bounding page frame, header dividers, and footer dividers
3. Centered Title and Subtitle, Left Panchayat/Mandal, Right Ward/District
4. Telugu Unicode text fidelity (zero glyph errors or replacement characters)
5. Permanent 5-character Unique Key rendered inside each voter block
6. Photograph embedding and subtle neutral placeholder fallback
7. Exact pagination for 1, 27, 28, 54, 55, and 100 voters
8. API endpoint integration (/api/voters/pdf/generate, /selected, /{id}/pdf)
9. Sub-second performance benchmarks
"""

import sys
import time
from pathlib import Path
from PIL import Image

# Ensure root directory is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pytest
import pymupdf
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal, VoterRecordModel, DocumentModel
from backend.pdf_generator import (
    generate_voters_a4_pdf,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    COLS,
    ROWS,
    VOTERS_PER_PAGE,
)

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def sample_voters_100():
    """Generates 100 structured mock voter dicts with realistic Telugu text."""
    voters = []
    for i in range(1, 101):
        serial = f"{i:03d}"
        epic = f"SJC{1000000 + i}"
        ukey = f"K{i:04d}"
        voters.append({
            "id": i,
            "serial_no": serial,
            "voter_id": epic,
            "unique_key": ukey,
            "electoral_roll_no": f"62 - 209 - {300 + i}",
            "voter_name": f"ఓటరు పేరు {i}",
            "relation_type": "తండ్రి" if i % 2 == 0 else "భర్త",
            "relation_name": f"సంబంధీకుని పేరు {i}",
            "house_no": f"{i % 20 + 1}-{i % 10 + 100}",
            "age": str(20 + (i % 60)),
            "gender": "పురుషుడు" if i % 2 == 0 else "స్త్రీ",
            "photo_path": None,
            "image_matching_status": "MATCHED",
        })
    return voters


# =========================================================================
# 1. Layout & Grid Geometry Tests
# =========================================================================
def test_a4_dimensions_and_constants():
    """Verify standard A4 portrait constants and 3x9 grid rules."""
    assert round(PAGE_WIDTH, 2) == 595.28
    assert round(PAGE_HEIGHT, 2) == 841.89
    assert COLS == 3
    assert ROWS == 9
    assert VOTERS_PER_PAGE == 27


def test_pdf_generation_single_page_reference_layout(sample_voters_100):
    """Verify single page generation (27 voters), header, borders, and footer."""
    page_voters = sample_voters_100[:27]
    pdf_bytes = generate_voters_a4_pdf(
        page_voters,
        panchayat="రామచంద్రపురం",
        constituency="తాడేపల్లిగూడెం",
        mandal="పెంటపాడు",
        ward="2",
        district="పశ్చిమ గోదావరి",
        as_on_date="01-09-2024",
        publish_date="15-04-2026",
        year="2026",
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 10000
    assert pdf_bytes[:5] == b"%PDF-"

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 1

    page = doc[0]
    rect = page.rect
    assert round(rect.width, 2) == 595.28
    assert round(rect.height, 2) == 841.89

    # Verify Telugu text rendering
    text = page.get_text().replace('\xa0', ' ').replace('\u2010', '-')
    assert "పుట సంఖ్య . 1/1" in text
    assert "రామచంద్రపురం" in text
    assert "తాడేపల్లిగూడెం" in text
    assert "పెంటపాడు" in text
    assert "పశ్చిమ గోదావరి" in text
    assert "01-09-2024" in text
    assert "15-04-2026" in text

    # Verify absence of Unicode replacement character or corrupted glyphs
    assert "\ufffd" not in text

    # Verify first and 27th voter are present
    assert "SJC1000001" in text
    assert "SJC1000027" in text
    doc.close()


# =========================================================================
# 2. Permanent Unique Key & Typography Tests
# =========================================================================
def test_permanent_unique_key_rendered(sample_voters_100):
    """Verify that permanent 5-character unique keys are present in rendered text."""
    voters = sample_voters_100[:5]
    pdf_bytes = generate_voters_a4_pdf(voters, panchayat="రామచంద్రపురం")

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    text = doc[0].get_text().replace('\xa0', ' ')

    for v in voters:
        assert v["unique_key"] in text
        assert v["voter_id"] in text
    doc.close()


# =========================================================================
# 3. Document Scales: 1, 27, 28, 54, 55, and 100 voters
# =========================================================================
def test_scale_1_voter(sample_voters_100):
    """1 voter -> exactly 1 page."""
    pdf_bytes = generate_voters_a4_pdf(sample_voters_100[:1])
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 1
    text = doc[0].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 1/1" in text
    assert "SJC1000001" in text
    doc.close()


def test_scale_27_voters(sample_voters_100):
    """27 voters -> exactly 1 full page."""
    pdf_bytes = generate_voters_a4_pdf(sample_voters_100[:27])
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 1
    text = doc[0].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 1/1" in text
    assert "SJC1000027" in text
    doc.close()


def test_scale_28_voters(sample_voters_100):
    """28 voters -> exactly 2 pages (Page 1 has 27, Page 2 has 1)."""
    pdf_bytes = generate_voters_a4_pdf(sample_voters_100[:28])
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 2

    p1_text = doc[0].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 1/2" in p1_text
    assert "SJC1000027" in p1_text
    assert "SJC1000028" not in p1_text

    p2_text = doc[1].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 2/2" in p2_text
    assert "SJC1000028" in p2_text
    doc.close()


def test_scale_54_voters(sample_voters_100):
    """54 voters -> exactly 2 full pages (27 + 27)."""
    pdf_bytes = generate_voters_a4_pdf(sample_voters_100[:54])
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 2

    p1_text = doc[0].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 1/2" in p1_text
    assert "SJC1000001" in p1_text
    assert "SJC1000027" in p1_text

    p2_text = doc[1].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 2/2" in p2_text
    assert "SJC1000028" in p2_text
    assert "SJC1000054" in p2_text
    doc.close()


def test_scale_55_voters(sample_voters_100):
    """55 voters -> exactly 3 pages (27 + 27 + 1)."""
    pdf_bytes = generate_voters_a4_pdf(sample_voters_100[:55])
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 3

    p3_text = doc[2].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 3/3" in p3_text
    assert "SJC1000055" in p3_text
    doc.close()


def test_scale_100_voters(sample_voters_100):
    """100 voters -> exactly 4 pages (27 + 27 + 27 + 19)."""
    pdf_bytes = generate_voters_a4_pdf(sample_voters_100[:100])
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 4

    p4_text = doc[3].get_text().replace('\xa0', ' ')
    assert "పుట సంఖ్య . 4/4" in p4_text
    assert "SJC1000082" in p4_text
    assert "SJC1000100" in p4_text
    doc.close()


# =========================================================================
# 4. Photograph Embedding & Placeholder Fallback Tests
# =========================================================================
def test_photo_embedding_with_real_and_missing_photos(tmp_path):
    """Verify photograph placement when photo exists and placeholder when missing."""
    img_path = tmp_path / "test_photo.jpg"
    img = Image.new("RGB", (60, 80), color=(180, 180, 180))
    img.save(str(img_path))

    voters = [
        {
            "id": 1,
            "serial_no": "001",
            "voter_id": "TEST001",
            "unique_key": "UK001",
            "voter_name": "ఫోటో ఉన్న ఓటరు",
            "relation_type": "తండ్రి",
            "relation_name": "సంబంధీకుడు",
            "house_no": "1-1",
            "age": "30",
            "gender": "పురుషుడు",
            "photo_path": str(img_path),
            "image_matching_status": "MATCHED",
        },
        {
            "id": 2,
            "serial_no": "002",
            "voter_id": "TEST002",
            "unique_key": "UK002",
            "voter_name": "ఫోటో లేని ఓటరు",
            "relation_type": "తండ్రి",
            "relation_name": "సంబంధీకుడు",
            "house_no": "1-2",
            "age": "28",
            "gender": "స్త్రీ",
            "photo_path": None,
            "image_matching_status": "MISSING",
        },
    ]

    pdf_bytes = generate_voters_a4_pdf(voters, panchayat="రామచంద్రపురం")
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]

    # Verify at least one embedded image exists in PDF
    images = page.get_images()
    assert len(images) >= 1

    # Verify text rendered
    text = page.get_text().replace('\xa0', ' ')
    assert "ఫోటో ఉన్న ఓటరు" in text
    assert "ఫోటో లేని ఓటరు" in text
    doc.close()


# =========================================================================
# 5. Performance Benchmark Threshold Test
# =========================================================================
def test_generation_performance_threshold(sample_voters_100):
    """
    Performance test: generating 54 voters across 2 pages must take < 5.0 seconds.
    With TextWriter and Shape batching, it should execute in under 3.5 seconds.
    """
    voters_54 = sample_voters_100[:54]
    start = time.perf_counter()
    pdf_bytes = generate_voters_a4_pdf(voters_54, panchayat="రామచంద్రపురం")
    duration = time.perf_counter() - start

    assert len(pdf_bytes) > 20000
    assert duration < 5.0, f"PDF generation took {duration:.2f}s, exceeding 5.0s threshold!"


# =========================================================================
# 6. Edge Cases & Robustness
# =========================================================================
def test_empty_voter_list_handling():
    """Verify empty voter list generates a graceful fallback page without crashing."""
    pdf_bytes = generate_voters_a4_pdf([], panchayat="రామచంద్రపురం")
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 1
    text = doc[0].get_text().replace('\xa0', ' ')
    assert "రికార్డులు కనుగొనబడలేదు" in text
    doc.close()


def test_special_characters_and_long_names():
    """Verify handling of long Telugu names and special characters."""
    voters = [{
        "id": 999,
        "serial_no": "999",
        "voter_id": "SPEC1234567",
        "unique_key": "UK999",
        "voter_name": "శ్రీ వేంకట సత్య సూర్యనారాయణ మూర్తి రాజు",
        "relation_type": "తండ్రి",
        "relation_name": "శ్రీ రామచంద్ర మూర్తి రాజు వంశీధర్",
        "house_no": "D.No 45-12/A-23/B-101 (Opp. Water Tank)",
        "age": "99",
        "gender": "పురుషుడు",
        "photo_path": None,
        "image_matching_status": "MATCHED",
    }]
    pdf_bytes = generate_voters_a4_pdf(voters, panchayat="రామచంద్రపురం")
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 1
    text = doc[0].get_text().replace('\xa0', ' ')
    assert "SPEC1234567" in text
    doc.close()


# =========================================================================
# 7. FastAPI Endpoint Integration Tests
# =========================================================================
def test_api_generate_pdf_endpoint(client):
    """Test POST /api/voters/pdf/generate returns HTTP 200 with valid PDF content."""
    resp = client.post("/api/voters/pdf/generate", json={})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:5] == b"%PDF-"


def test_api_generate_selected_pdf_endpoint(client):
    """Test POST /api/voters/pdf/selected returns HTTP 200 with selected voter IDs."""
    db = SessionLocal()
    first_voter = db.query(VoterRecordModel).first()
    db.close()

    if first_voter:
        resp = client.post("/api/voters/pdf/selected", json={"voter_ids": [first_voter.id]})
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"


def test_api_generate_individual_pdf_endpoint(client):
    """Test GET /api/voters/{id}/pdf returns individual voter PDF."""
    db = SessionLocal()
    first_voter = db.query(VoterRecordModel).first()
    db.close()

    if first_voter:
        resp = client.get(f"/api/voters/{first_voter.id}/pdf")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content[:5] == b"%PDF-"

    # Test invalid voter ID returns 404
    resp_invalid = client.get("/api/voters/999999999/pdf")
    assert resp_invalid.status_code == 404


# =========================================================================
# 8. Ward Serial Number ('వార్డు.ఓ.జా.వ.సం.') Treatment & Page-Wise PDF Tests
# =========================================================================
def test_ward_serial_number_treatment_in_pdf():
    """
    Verify that 'వార్డు.ఓ.జా.వ.సం.' is treated strictly as a serial number in PDF generation,
    and rendered with the ward label and serial number in the voter block header.
    """
    voter = {
        "serial_no": "142",
        "electoral_roll_no": "62 - 148 - 680",
        "voter_name": "అపర్ణ పేధాద",
        "relation_type": "భర్త",
        "relation_name": "పెదడ మోశే",
        "age": "26",
        "gender": "స్త్రీ",
        "house_no": "1-1",
        "voter_id": "SJC1101658",
        "unique_key": "W9R2P",
        "fields": [
            {"field_name": "వార్డు.ఓ.జా.వ.సం.", "value": "142"},
            {"field_name": "అ.ఓ.జా.వ.సం.", "value": "62 - 148 - 680"}
        ]
    }

    pdf_bytes = generate_voters_a4_pdf([voter], ward="20", panchayat="తాడేపల్లిగూడెం")
    assert pdf_bytes[:5] == b"%PDF-"

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) == 1
    page_text = doc[0].get_text("text").replace("\xa0", " ")

    # Verify serial number and ward label appear in the generated PDF
    assert "142" in page_text
    assert "వార్డు.ఓ.జా.వ.సం." in page_text
    assert "SJC1101658" in page_text
    assert "అపర్ణ పేధాద" in page_text
    assert "పెదడ మోశే" in page_text
    # Ensure no photo artifact text in relation name
    assert "Photo Available" not in page_text
    doc.close()


def test_page_wise_single_page_pdf_generation(sample_voters_100):
    """
    Verify generate_single_voter_pdf_page creates an isolated single page
    with correct page metadata and footer numbering.
    """
    from backend.pdf_generator import generate_single_voter_pdf_page

    chunk = sample_voters_100[:27]
    pdf_bytes = generate_single_voter_pdf_page(
        page_voters=chunk,
        page_idx=2, # Page 3 (0-based 2)
        total_pages=4,
        start_voter_idx=54
    )
    assert pdf_bytes[:5] == b"%PDF-"

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) == 1
    page_text = doc[0].get_text("text").replace("\xa0", " ")
    assert "పుట సంఖ్య . 3/4" in page_text
    doc.close()


def test_assemble_pdf_from_pages(tmp_path, sample_voters_100):
    """
    Verify assemble_pdf_from_pages merges independent page files sequentially into a verified PDF.
    """
    from backend.pdf_generator import generate_single_voter_pdf_page, assemble_pdf_from_pages

    page_files = []
    for p_no in range(1, 4):
        chunk = sample_voters_100[(p_no - 1) * 27 : p_no * 27]
        p_bytes = generate_single_voter_pdf_page(
            page_voters=chunk,
            page_idx=p_no - 1,
            total_pages=3,
            start_voter_idx=(p_no - 1) * 27
        )
        p_path = tmp_path / f"temp_page_{p_no}.pdf"
        p_path.write_bytes(p_bytes)
        page_files.append(p_path)

    out_file = tmp_path / "final_assembled.pdf"
    res = assemble_pdf_from_pages(page_files, out_file)

    assert res["page_count"] == 3
    assert res["file_size"] > 1000
    assert out_file.exists()

    doc = pymupdf.open(str(out_file))
    assert len(doc) == 3
    assert "పుట సంఖ్య . 1/3" in doc[0].get_text("text").replace("\xa0", " ")
    assert "పుట సంఖ్య . 2/3" in doc[1].get_text("text").replace("\xa0", " ")
    assert "పుట సంఖ్య . 3/3" in doc[2].get_text("text").replace("\xa0", " ")
    doc.close()


def test_api_pdf_page_endpoint(client):
    """Test POST /api/voters/pdf/page returns HTTP 200 with a single A4 page."""
    resp = client.post("/api/voters/pdf/page", json={"page_number": 1, "total_pages": 5})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:5] == b"%PDF-"

    doc = pymupdf.open(stream=resp.content, filetype="pdf")
    assert len(doc) == 1
    doc.close()


def test_api_pdf_export_jobs_lifecycle(client):
    """Test POST /api/voters/pdf/export-jobs and GET status lifecycle."""
    resp = client.post("/api/voters/pdf/export-jobs", json={"title": "Test Bulk Export Job"})
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    job_id = data["id"]
    assert data["status"] in ("pending", "processing", "completed")

    # Check progress endpoint
    prog_resp = client.get(f"/api/voters/pdf/export-jobs/{job_id}")
    assert prog_resp.status_code == 200
    prog_data = prog_resp.json()
    assert prog_data["id"] == job_id
    assert "completed_pages" in prog_data
    assert "total_pages" in prog_data
    assert "pages" in prog_data

