"""create_voter_entries_table

Revision ID: dfb279beb9e6
Revises: b144b123599e
Create Date: 2026-11-22 03:18:25.395737

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dfb279beb9e6'
down_revision: Union[str, Sequence[str], None] = 'b144b123599e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if 'voter_entries' not in tables:
        op.create_table(
            'voter_entries',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('voter_id', sa.Integer(), nullable=False),
            sa.Column('mobile_number', sa.String(length=15), nullable=False),
            sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('entry_date', sa.Date(), nullable=False),
            sa.Column('remarks', sa.Text(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['voter_id'], ['voter_records.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_voter_entries_created_by'), 'voter_entries', ['created_by'], unique=False)
        op.create_index(op.f('ix_voter_entries_mobile_number'), 'voter_entries', ['mobile_number'], unique=False)
        op.create_index(op.f('ix_voter_entries_voter_id'), 'voter_entries', ['voter_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_voter_entries_voter_id'), table_name='voter_entries')
    op.drop_index(op.f('ix_voter_entries_mobile_number'), table_name='voter_entries')
    op.drop_index(op.f('ix_voter_entries_created_by'), table_name='voter_entries')
    op.drop_table('voter_entries')
