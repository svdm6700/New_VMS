"""
Migration: Remove Wallet Module & Add Document Pages for Asynchronous Page-Wise Extraction
Safely updates PostgreSQL database schema:
1. Creates document_pages table with indexes and constraints.
2. Adds processed_pages, failed_pages, total_voters columns to documents table.
3. Drops foreign key constraint from voter_amount_allocations to wallet_transactions if exists.
4. Drops wallet_transactions and wallets tables safely.
5. Deletes wallet-related permissions and role mappings.
"""

import os
import sys
from pathlib import Path
from sqlalchemy import text

# Ensure project root directory is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import engine

def run_migration():
    print("[Migration] Starting migration: Remove Wallet & Add Document Pages...")
    with engine.begin() as conn:
        # 1. Add columns to documents table if they don't exist
        print("[Migration] Ensuring columns exist on 'documents' table...")
        conn.execute(text("""
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS processed_pages INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS failed_pages INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_voters INTEGER DEFAULT 0;
        """))

        # 2. Create document_pages table
        print("[Migration] Creating 'document_pages' table if not exists...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS document_pages (
                id SERIAL PRIMARY KEY,
                document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                page_number INTEGER NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                retry_count INTEGER NOT NULL DEFAULT 0,
                max_retries INTEGER NOT NULL DEFAULT 3,
                extracted_text TEXT,
                structured_json TEXT,
                voter_count INTEGER NOT NULL DEFAULT 0,
                error_details TEXT,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_document_page_number UNIQUE (document_id, page_number)
            );
            CREATE INDEX IF NOT EXISTS idx_doc_pages_doc_id ON document_pages(document_id);
            CREATE INDEX IF NOT EXISTS idx_doc_pages_status ON document_pages(document_id, status);
            CREATE INDEX IF NOT EXISTS idx_doc_pages_page_num ON document_pages(page_number);
        """))

        # 3. Check and drop FK constraint on voter_amount_allocations if it references wallet_transactions
        print("[Migration] Checking foreign keys on 'voter_amount_allocations'...")
        res = conn.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'voter_amount_allocations' 
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name LIKE '%wallet%';
        """)).fetchall()
        for row in res:
            c_name = row[0]
            print(f"[Migration] Dropping FK constraint '{c_name}' on voter_amount_allocations...")
            conn.execute(text(f"ALTER TABLE voter_amount_allocations DROP CONSTRAINT IF EXISTS {c_name};"))

        # Drop column wallet_transaction_id if present
        conn.execute(text("""
            ALTER TABLE voter_amount_allocations 
            DROP COLUMN IF EXISTS wallet_transaction_id;
        """))

        # 4. Drop wallet_transactions and wallets tables safely
        print("[Migration] Dropping wallet tables safely...")
        conn.execute(text("DROP TABLE IF EXISTS wallet_transactions CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS wallets CASCADE;"))

        # 5. Remove wallet permissions from permissions and role_permissions
        print("[Migration] Cleaning up wallet permissions...")
        conn.execute(text("""
            DELETE FROM role_permissions 
            WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'wallet.%');
            DELETE FROM permissions 
            WHERE code LIKE 'wallet.%';
        """))

        print("[Migration] Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
