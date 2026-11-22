"""create geographic master tables

Revision ID: 7a8b9c0d1e2f
Revises: 4e9f12345678
Create Date: 2026-11-22 15:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '7a8b9c0d1e2f'
down_revision = '4e9f12345678'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Use if_not_exists to safely support already-initialized databases
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_tables = insp.get_table_names()

    if "districts" not in existing_tables:
        op.create_table(
            'districts',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('name', sa.String(length=150), nullable=False),
            sa.Column('code', sa.String(length=50), nullable=True),
            sa.Column('state', sa.String(length=100), nullable=False, server_default='Andhra Pradesh'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name')
        )
        op.create_index(op.f('ix_districts_name'), 'districts', ['name'], unique=True)

    if "constituencies" not in existing_tables:
        op.create_table(
            'constituencies',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('name', sa.String(length=150), nullable=False),
            sa.Column('code', sa.String(length=50), nullable=True),
            sa.Column('district_id', sa.Integer(), nullable=True),
            sa.Column('district_name', sa.String(length=150), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_constituencies_name'), 'constituencies', ['name'], unique=False)
        op.create_index(op.f('ix_constituencies_district_name'), 'constituencies', ['district_name'], unique=False)

    if "wards" not in existing_tables:
        op.create_table(
            'wards',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('ward_number', sa.String(length=50), nullable=False),
            sa.Column('constituency_id', sa.Integer(), nullable=True),
            sa.Column('constituency_name', sa.String(length=150), nullable=False),
            sa.Column('area_name', sa.String(length=200), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['constituency_id'], ['constituencies.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_wards_ward_number'), 'wards', ['ward_number'], unique=False)
        op.create_index(op.f('ix_wards_constituency_name'), 'wards', ['constituency_name'], unique=False)

def downgrade() -> None:
    op.drop_table('wards')
    op.drop_table('constituencies')
    op.drop_table('districts')
