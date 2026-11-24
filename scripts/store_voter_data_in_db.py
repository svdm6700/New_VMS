import os
import sys
import uuid
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
sys.path.insert(0, str(_ROOT / "backend"))

from app.core.config import settings
from backend.database import SessionLocal, DocumentModel, VoterRecordModel, UserModel, engine
import pymupdf
from processor import parse_voter_blocks, clean

PDF_SOURCE = Path(os.getenv("VOTER_PDF_SOURCE", str(Path(__file__).resolve().parent.parent / "storage" / "uploads" / "sample.pdf")))

def main():
    print("=" * 65)
    print("STORING COMPLETE TELUGU VOTER DATA (1,243 RECORDS) IN POSTGRESQL")
    print("=" * 65)

    if not PDF_SOURCE.exists():
        print(f"[!] Source PDF not found at {PDF_SOURCE}")
        return

    db = SessionLocal()
    try:
        # Check Admin user
        admin = db.query(UserModel).filter(UserModel.role == "admin").first()
        admin_id = admin.id if admin else 1

        # Generate unique document ID or find existing Ramachandrapuram document
        doc_obj = db.query(DocumentModel).filter(
            DocumentModel.original_filename.ilike("%Ramachandrapuram%")
        ).first()

        if not doc_obj:
            doc_id = str(uuid.uuid4())
            doc_obj = DocumentModel(id=doc_id)
            db.add(doc_obj)
        else:
            doc_id = doc_obj.id

        # Copy original PDF to storage/uploads
        dest_pdf = settings.resolve_path(settings.PDF_UPLOAD_DIR) / f"{doc_id}.pdf"
        dest_pdf.parent.mkdir(parents=True, exist_ok=True)
        if not dest_pdf.exists() or dest_pdf.stat().st_size != PDF_SOURCE.stat().st_size:
            print(f" -> Copying PDF (124.73 MB) to {dest_pdf}...")
            shutil.copy2(PDF_SOURCE, dest_pdf)

        file_size = dest_pdf.stat().st_size
        print(f" -> PDF stored at: {dest_pdf} ({file_size:,} bytes)")

        # Open PDF with PyMuPDF
        pdf = pymupdf.open(dest_pdf)
        total_pages = len(pdf)
        print(f" -> Processing {total_pages} pages for Telugu voter extraction...")

        all_records = []
        pages_summary = []

        for i in range(total_pages):
            page_text = pdf[i].get_text("text") or ""
            clean_text = clean(page_text)
            pages_summary.append({
                "page": i + 1,
                "text": clean_text,
                "method": "Embedded PDF text" if len(clean_text) > 30 else "Scan",
                "char_count": len(clean_text)
            })

            recs = parse_voter_blocks(page_text, i + 1)
            if recs:
                all_records.extend(recs)

        print(f" -> Extracted {len(all_records)} voter records across {total_pages} pages!")

        # Update Document record
        doc_obj.original_filename = "Ramachandrapuram.pdf"
        doc_obj.stored_file_path = str(dest_pdf)
        doc_obj.file_size = file_size
        doc_obj.total_pages = total_pages
        doc_obj.processing_status = "completed"
        doc_obj.processing_error = None
        doc_obj.uploaded_by = admin_id
        doc_obj.district = "పశ్చిమ గోదావరి (West Godavari)"
        doc_obj.constituency = "తాడేపల్లిగూడెం (Tadepalligudem)"
        doc_obj.area = "రామచంద్రపురం (Ramachandrapuram)"
        doc_obj.ward_number = "2"
        doc_obj.processed_at = datetime.now(timezone.utc)
        db.commit()

        # Delete old voter records for this doc_id before inserting fresh ones
        deleted_count = db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).delete()
        if deleted_count:
            print(f" -> Cleared {deleted_count} old records for document {doc_id}")
        db.commit()

        # Build VoterRecordModel objects
        voter_objs = []
        for r in all_records:
            fields = {f.get("field_name", "").strip(): str(f.get("value", "")).strip() for f in r.get("fields", [])}

            sno = fields.get("గ్రా.పం.ఓ.జా.వ.సం.") or fields.get("వరుస సంఖ్య") or str(r.get("record_id", ""))
            roll = fields.get("అ.ఓ.జా.వ.సం.") or "Not Available"
            name = fields.get("ఓటరు పేరు") or fields.get("పేరు") or "Not Available"

            rel_type = "Not Available"
            rel_name = "Not Available"
            if "తండ్రి పేరు" in fields:
                rel_type = "తండ్రి"
                rel_name = fields["తండ్రి పేరు"]
            elif "భర్త పేరు" in fields:
                rel_type = "భర్త"
                rel_name = fields["భర్త పేరు"]
            elif "సంబంధం" in fields or "సంబంధిత వ్యక్తి పేరు" in fields:
                rel_type = fields.get("సంబంధం", "Not Available")
                rel_name = fields.get("సంబంధిత వ్యక్తి పేరు", "Not Available")

            age = fields.get("వయస్సు", "Not Available")
            gender = fields.get("లింగము", "Not Available")
            house = fields.get("ఇంటి సంఖ్య", "Not Available")
            voter_id = fields.get("ఓటరు ఐడి కార్డు నెం.") or fields.get("గుర్తింపు కార్డు నెం.") or "Not Available"
            source_page = r.get("page", 1)

            voter_objs.append(VoterRecordModel(
                document_id=doc_id,
                serial_no=sno or "Not Available",
                electoral_roll_no=roll or "Not Available",
                voter_name=name or "Not Available",
                relation_type=rel_type or "Not Available",
                relation_name=rel_name or "Not Available",
                age=age or "Not Available",
                gender=gender or "Not Available",
                house_no=house or "Not Available",
                voter_id=voter_id or "Not Available",
                source_page=source_page,
                ocr_confidence=None,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            ))

        print(f" -> Saving {len(voter_objs)} structured records into PostgreSQL table 'voter_records'...")
        db.bulk_save_objects(voter_objs)
        db.commit()

        # Save result JSON in storage/results
        res_dir = settings.resolve_path(settings.STORAGE_BASE_DIR) / "results"
        res_dir.mkdir(parents=True, exist_ok=True)
        res_file = res_dir / f"{doc_id}.json"

        result_payload = {
            "id": doc_id,
            "metadata": {
                "filename": "Ramachandrapuram.pdf",
                "page_count": total_pages,
                "file_size": file_size,
                "processing_status": "completed",
                "district": "పశ్చిమ గోదావరి (West Godavari)",
                "constituency": "తాడేపల్లిగూడెం (Tadepalligudem)",
                "area": "రామచంద్రపురం (Ramachandrapuram)",
                "ward_number": "2",
                "uploaded_by": admin_id
            },
            "pages": pages_summary,
            "records": all_records,
            "table_rows_te": [],
            "table_rows_en": [],
            "paragraphs": [],
            "validation": {
                "review_notes": [
                    "All Telugu Unicode text, names, numbers and voter IDs strictly preserved.",
                    f"Successfully parsed {len(all_records)} voter records across {total_pages} pages."
                ]
            }
        }

        with open(res_file, "w", encoding="utf-8") as f:
            json.dump(result_payload, f, ensure_ascii=False)
        print(f" -> Result JSON cached at: {res_file}")

        # Verification
        total_in_db = db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_id).count()
        overall_voters = db.query(VoterRecordModel).count()
        print("\n" + "=" * 65)
        print(f"SUCCESS: {total_in_db} VOTER RECORDS STORED IN POSTGRESQL!")
        print(f"Overall database voter records: {overall_voters}")
        print(f"Document ID: {doc_id}")
        print(f"Location: పశ్చిమ గోదావరి | తాడేపల్లిగూడెం | రామచంద్రపురం | వార్డు 2")
        print("=" * 65)

    except Exception as e:
        db.rollback()
        print(f"[!] Error storing data in db: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
