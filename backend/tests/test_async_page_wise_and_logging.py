import os
import json
import pytest
from pathlib import Path
from datetime import datetime, timezone
from backend.database import SessionLocal, DocumentModel, DocumentPageModel, VoterRecordModel, PaymentModel, UserModel
from backend.logger import (
    log_event, backend_logger, doc_proc_logger, pdf_export_logger,
    frontend_logger, errors_logger, LOGS_DIR, get_current_day_folder, redact_sensitive_data
)
from backend.processor import extract_single_page_data
import fitz

def test_sensitive_data_redaction():
    payload = {
        "user": "test_user",
        "password": "secret_password_123",
        "access_token": "bearer eyJhbGciOi...",
        "nested": {
            "token": "nested_secret",
            "normal_field": "visible_value"
        }
    }
    redacted = redact_sensitive_data(payload)
    assert redacted["password"] == "[REDACTED]"
    assert redacted["access_token"] == "[REDACTED]"
    assert redacted["nested"]["token"] == "[REDACTED]"
    assert redacted["nested"]["normal_field"] == "visible_value"
    assert redacted["user"] == "test_user"

def test_structured_log_files_written():
    test_msg = f"Test log message {datetime.now(timezone.utc).isoformat()}"
    log_event(backend_logger, "INFO", test_msg, test_field="value_123")
    log_event(doc_proc_logger, "INFO", f"Doc proc: {test_msg}", document_id="doc_test_1")
    log_event(pdf_export_logger, "INFO", f"PDF export: {test_msg}", pages=93, records=2500)
    log_event(frontend_logger, "INFO", f"Frontend event: {test_msg}", user_agent="Mozilla")
    log_event(errors_logger, "ERROR", f"Error event: {test_msg}", code=500)

    day_folder = get_current_day_folder()
    assert day_folder.exists(), f"Day-wise log folder {day_folder} does not exist"
    for filename in ["backend.log", "document_processing.log", "pdf_export.log", "frontend.log", "errors.log"]:
        file_path = day_folder / filename
        assert file_path.exists(), f"Log file {filename} does not exist in day folder {day_folder}"
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            assert len(lines) > 0, f"Log file {filename} is empty"

def test_document_page_model_lifecycle():
    db = SessionLocal()
    test_doc_id = "test_doc_lifecycle_001"
    try:
        # Clean up any prior test artifacts
        db.query(DocumentPageModel).filter(DocumentPageModel.document_id == test_doc_id).delete()
        db.query(DocumentModel).filter(DocumentModel.id == test_doc_id).delete()
        db.commit()

        doc = DocumentModel(
            id=test_doc_id,
            original_filename="test_lifecycle.pdf",
            stored_file_path="storage/uploads/test_lifecycle.pdf",
            file_size=1024,
            total_pages=3,
            processing_status="processing",
            uploaded_at=datetime.now(timezone.utc)
        )
        db.add(doc)
        db.commit()

        # Create pages
        for p_num in range(1, 4):
            page = DocumentPageModel(
                document_id=test_doc_id,
                page_number=p_num,
                status="pending",
                voter_count=0
            )
            db.add(page)
        db.commit()

        # Update page 1 to completed
        p1 = db.query(DocumentPageModel).filter(
            DocumentPageModel.document_id == test_doc_id,
            DocumentPageModel.page_number == 1
        ).first()
        assert p1 is not None
        p1.status = "completed"
        p1.voter_count = 30
        p1.raw_text = "Sample Telugu raw text for page 1"
        p1.structured_json = [{"sno": "1", "name": "Test Voter"}]
        p1.completed_at = datetime.now(timezone.utc)

        # Update page 2 to failed
        p2 = db.query(DocumentPageModel).filter(
            DocumentPageModel.document_id == test_doc_id,
            DocumentPageModel.page_number == 2
        ).first()
        assert p2 is not None
        p2.status = "failed"
        p2.error_details = "Sample simulated OCR timeout"
        p2.completed_at = datetime.now(timezone.utc)

        db.commit()

        # Verify page details via query
        pages = db.query(DocumentPageModel).filter(
            DocumentPageModel.document_id == test_doc_id
        ).order_by(DocumentPageModel.page_number).all()

        assert len(pages) == 3
        assert pages[0].status == "completed"
        assert pages[0].voter_count == 30
        assert pages[1].status == "failed"
        assert "OCR timeout" in pages[1].error_details
        assert pages[2].status == "pending"

        # Verify to_dict output
        p1_dict = pages[0].to_dict()
        assert p1_dict["page_number"] == 1
        assert p1_dict["status"] == "completed"
        assert p1_dict["voter_count"] == 30

    finally:
        db.query(DocumentPageModel).filter(DocumentPageModel.document_id == test_doc_id).delete()
        db.query(DocumentModel).filter(DocumentModel.id == test_doc_id).delete()
        db.commit()
        db.close()

def test_wallet_tables_completely_removed():
    db = SessionLocal()
    try:
        from sqlalchemy import text
        # Attempting to query wallets or wallet_transactions should confirm tables do not exist
        res_wallets = db.execute(text("SELECT to_regclass('public.wallets');")).scalar()
        res_txs = db.execute(text("SELECT to_regclass('public.wallet_transactions');")).scalar()
        assert res_wallets is None, "Table 'wallets' should have been dropped by migration"
        assert res_txs is None, "Table 'wallet_transactions' should have been dropped by migration"
    finally:
        db.close()
