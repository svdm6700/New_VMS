from backend.database import engine
from sqlalchemy import text

def run_migration():
    with engine.begin() as conn:
        # 1. Add snapshot columns to payments
        conn.execute(text('ALTER TABLE payments ADD COLUMN IF NOT EXISTS voter_name VARCHAR(512);'))
        conn.execute(text('ALTER TABLE payments ADD COLUMN IF NOT EXISTS epic_no VARCHAR(128);'))
        conn.execute(text('ALTER TABLE payments ADD COLUMN IF NOT EXISTS district VARCHAR(150);'))
        conn.execute(text('ALTER TABLE payments ADD COLUMN IF NOT EXISTS constituency VARCHAR(150);'))
        
        # 2. Make voter_id nullable
        conn.execute(text('ALTER TABLE payments ALTER COLUMN voter_id DROP NOT NULL;'))
        
        # 3. Find and update foreign key constraint on payments.voter_id to ON DELETE SET NULL
        fk_res = conn.execute(text('''
            SELECT tc.constraint_name 
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'payments' 
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'voter_id';
        ''')).fetchall()
        for row in fk_res:
            c_name = row[0]
            print(f'Dropping FK constraint {c_name} and replacing with ON DELETE SET NULL...')
            conn.execute(text(f'ALTER TABLE payments DROP CONSTRAINT "{c_name}";'))
            conn.execute(text(f'ALTER TABLE payments ADD CONSTRAINT "{c_name}" FOREIGN KEY (voter_id) REFERENCES voter_records(id) ON DELETE SET NULL;'))

        # 4. Populate snapshot data for existing payments
        conn.execute(text('''
            UPDATE payments p
            SET 
                voter_name = vr.voter_name,
                epic_no = vr.voter_id,
                district = d.district,
                constituency = d.constituency
            FROM voter_records vr
            LEFT JOIN documents d ON vr.document_id = d.id
            WHERE p.voter_id = vr.id AND (p.voter_name IS NULL OR p.epic_no IS NULL);
        '''))
        print('Migration completed successfully!')

if __name__ == '__main__':
    run_migration()
