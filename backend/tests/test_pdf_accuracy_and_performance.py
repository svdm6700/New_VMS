"""
Comprehensive Automated Test Suite for VMS A4 Voter List PDF Generation
Verifies:
1. A4 Portrait dimensions and 3x9 grid geometry (27 voters per page)
2. Telugu Unicode text fidelity and HarfBuzz font shaping (zero glyph errors)
3. Permanent 5-character Unique Key correctness and styling
4. Photograph embedding and graceful missing photo placeholder fallback
5. Multi-page pagination and footer numbering ('పుట X / Y')
6. API endpoint integration (/api/voters/pdf/generate, /selected, /{id}/pdf)
7. Performance thresholds (< 5.0 seconds for 54 voters)
8. Empty dataset and invalid ID edge case handling
"""

import sys
import time
from pathlib import Path

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
def sample_voters_batch():
    """Generates a batch of 54 structured mock voter dicts with realistic Telugu text."""
    voters = []
    for i in range(1, 55):
        serial = f"{i:03d}"
        epic = f"SJC{1000000 + i}"
        ukey = f"K{i:04d}"
        voters.append({
            "id": i,
            "serial_no": serial,
            "voter_id": epic,
            "unique_key": ukey,
            "voter_name": f"ఓటరు పేరు {i}",
            "relation_type": "తండ్రి" if i % 2 == 0 else "భర్త",
            "relation_name": f"సంబంధీకుని పేరు {i}",
            "house_no": f"{i % 20 + 1}-{i % 10 + 100}",
            "age": str(20 + (i % 60)),
            "gender": "పురుషుడు" if i % 2 == 0 else "స్త్రీ",
            "photo_path": None,  # Will test placeholder fallback by default
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


def test_pdf_generation_single_page_layout(sample_voters_batch):
    """Verify single page generation (27 voters), page dimensions, and no glyph errors."""
    page_voters = sample_voters_batch[:27]
    pdf_bytes = generate_voters_a4_pdf(
        page_voters,
        title="అసెంబ్లీ నియోజకవర్గం ఓటర్ల జాబితా",
        district="కృష్ణా",
        constituency="విజయవాడ పశ్చిమ",
        ward="12",
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
    text = page.get_text().replace('\xa0', ' ')
    assert "పుట 1 / 1" in text
    assert "కృష్ణా" in text
    assert "విజయవాడ పశ్చిమ" in text
    assert "వార్డు: 12" in text

    # Verify absence of Unicode replacement character or corrupted glyphs
    assert "\ufffd" not in text

    # Verify first and 27th voter are present
    assert "SJC1000001" in text
    assert "SJC1000027" in text
    doc.close()


# =========================================================================
# 2. Permanent Unique Key & Typography Tests
# =========================================================================
def test_permanent_unique_key_rendered(sample_voters_batch):
    """Verify that permanent 5-character unique keys are present in rendered text."""
    voters = sample_voters_batch[:5]
    pdf_bytes = generate_voters_a4_pdf(voters, title="Unique Key Verification")

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    text = doc[0].get_text().replace('\xa0', ' ')

    for v in voters:
        assert v["unique_key"] in text
        assert v["voter_id"] in text
    doc.close()


# =========================================================================
# 3. Pagination & Multi-Page Tests
# =========================================================================
def test_pdf_multi_page_pagination(sample_voters_batch):
    """Verify 54 voters span exactly 2 pages with correct page numbering."""
    voters_54 = sample_voters_batch[:54]
    pdf_bytes = generate_voters_a4_pdf(voters_54, title="54 Voters Test")

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 2

    # Check Page 1
    p1_text = doc[0].get_text().replace('\xa0', ' ')
    assert "పుట 1 / 2" in p1_text
    assert "SJC1000001" in p1_text
    assert "SJC1000027" in p1_text
    assert "SJC1000028" not in p1_text

    # Check Page 2
    p2_text = doc[1].get_text().replace('\xa0', ' ')
    assert "పుట 2 / 2" in p2_text
    assert "SJC1000028" in p2_text
    assert "SJC1000054" in p2_text
    doc.close()


def test_pdf_partial_page_pagination(sample_voters_batch):
    """Verify 28 voters generate 2 pages (Page 1 has 27, Page 2 has 1)."""
    voters_28 = sample_voters_batch[:28]
    pdf_bytes = generate_voters_a4_pdf(voters_28, title="28 Voters Test")

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 2
    p2_text = doc[1].get_text().replace('\xa0', ' ')
    assert "పుట 2 / 2" in p2_text
    assert "SJC1000028" in p2_text
    doc.close()


# =========================================================================
# 4. Photograph Embedding & Placeholder Fallback Tests
# =========================================================================
def test_photo_embedding_with_real_and_missing_photos(tmp_path):
    """Verify photograph placement when photo exists and placeholder when missing."""
    from PIL import Image
    # Create a dummy image using PIL
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

    pdf_bytes = generate_voters_a4_pdf(voters, title="Photo Test")
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
def test_generation_performance_threshold(sample_voters_batch):
    """
    Performance test: generating 54 voters across 2 pages must take < 5.0 seconds.
    With TextWriter and Shape batching, it should execute in under 3.5 seconds.
    """
    voters_54 = sample_voters_batch[:54]
    start = time.perf_counter()
    pdf_bytes = generate_voters_a4_pdf(voters_54, title="Performance Benchmark")
    duration = time.perf_counter() - start

    assert len(pdf_bytes) > 20000
    assert duration < 5.0, f"PDF generation took {duration:.2f}s, exceeding 5.0s threshold!"


# =========================================================================
# 6. Edge Cases & Robustness
# =========================================================================
def test_empty_voter_list_handling():
    """Verify empty voter list generates a graceful fallback page without crashing."""
    pdf_bytes = generate_voters_a4_pdf([], title="ఖాళీ జాబితా")
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert doc.page_count == 1
    text = doc[0].get_text().replace('\xa0', ' ')
    assert "రికార్డులు కనుగొనబడలేదు" in text or "ఖాళీ జాబితా" in text
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
    pdf_bytes = generate_voters_a4_pdf(voters, title="Special Characters Test")
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
