import sqlite3

conn = sqlite3.connect('backend/data/telugu_pdf_reader.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print("Tables found:", tables)

for t in tables:
    c.execute(f"SELECT count(*) FROM {t}")
    count = c.fetchone()[0]
    print(f"Table '{t}': {count} rows")

c.execute("SELECT id, username, email, role, is_active FROM users")
print("\nUsers:")
for u in c.fetchall():
    print(" ", u)

c.execute("SELECT id, original_filename, district, constituency, area, ward_number, processing_status FROM documents")
print("\nDocuments:")
for d in c.fetchall():
    print(" ", d)

conn.close()
