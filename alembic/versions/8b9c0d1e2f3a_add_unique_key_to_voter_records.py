"""add unique key to voter records

Revision ID: 8b9c0d1e2f3a
Revises: 7a8b9c0d1e2f
Create Date: 2026-11-22 19:25:00.000000

"""
from alembic import op
import sqlalchemy as sa
import string
import secrets

revision = '8b9c0d1e2f3a'
down_revision = '7a8b9c0d1e2f'
branch_labels = None
depends_on = None

KEY_CHARS = string.ascii_uppercase + string.digits

def _gen_key():
    return "".join(secrets.choice(KEY_CHARS) for _ in range(5))

def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_cols = [c['name'] for c in insp.get_columns('voter_records')]

    if 'unique_key' not in existing_cols:
        op.add_column(
            'voter_records',
            sa.Column('unique_key', sa.String(length=5), nullable=True)
        )

    # Backfill any voter records that have NULL or empty unique_key
    existing_keys = set()
    res = conn.execute(sa.text("SELECT id, unique_key FROM voter_records WHERE unique_key IS NOT NULL AND unique_key != ''"))
    for row in res:
        if row[1]:
            existing_keys.add(row[1])

    missing_rows = conn.execute(sa.text("SELECT id FROM voter_records WHERE unique_key IS NULL OR unique_key = ''")).fetchall()
    for row in missing_rows:
        v_id = row[0]
        while True:
            candidate = _gen_key()
            if candidate not in existing_keys:
                existing_keys.add(candidate)
                conn.execute(
                    sa.text("UPDATE voter_records SET unique_key = :k WHERE id = :vid"),
                    {"k": candidate, "vid": v_id}
                )
                break

    # Ensure unique index exists
    existing_indexes = [idx['name'] for idx in insp.get_indexes('voter_records')]
    if 'ix_voter_records_unique_key' not in existing_indexes:
        op.create_index(
            'ix_voter_records_unique_key',
            'voter_records',
            ['unique_key'],
            unique=True
        )

def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_indexes = [idx['name'] for idx in insp.get_indexes('voter_records')]
    if 'ix_voter_records_unique_key' in existing_indexes:
        op.drop_index('ix_voter_records_unique_key', table_name='voter_records')

    existing_cols = [c['name'] for c in insp.get_columns('voter_records')]
    if 'unique_key' in existing_cols:
        op.drop_column('voter_records', 'unique_key')
