"""add_location_fields_to_documents

Revision ID: b144b123599e
Revises: 
Create Date: 2026-11-21 19:20:19.477107

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b144b123599e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add manual location fields to documents table."""
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_cols = [c['name'] for c in insp.get_columns('documents')]

    if 'district' not in existing_cols:
        op.add_column('documents', sa.Column('district', sa.String(150), nullable=True))
    if 'constituency' not in existing_cols:
        op.add_column('documents', sa.Column('constituency', sa.String(150), nullable=True))
    if 'area' not in existing_cols:
        op.add_column('documents', sa.Column('area', sa.String(200), nullable=True))
    if 'ward_number' not in existing_cols:
        op.add_column('documents', sa.Column('ward_number', sa.String(50), nullable=True))


def downgrade() -> None:
    """Downgrade schema: remove manual location fields from documents table."""
    op.drop_column('documents', 'ward_number')
    op.drop_column('documents', 'area')
    op.drop_column('documents', 'constituency')
    op.drop_column('documents', 'district')
