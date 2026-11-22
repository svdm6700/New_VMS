"""create_payments_and_audit_logs_tables

Revision ID: 4e9f12345678
Revises: 1fb151078b6e
Create Date: 2026-11-22 07:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4e9f12345678'
down_revision: Union[str, Sequence[str], None] = '1fb151078b6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include payments and payment_audit_logs tables."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'payments' not in tables:
        op.create_table(
            'payments',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('transaction_id', sa.String(length=64), nullable=False),
            sa.Column('receipt_number', sa.String(length=64), nullable=False),
            sa.Column('voter_id', sa.Integer(), nullable=False),
            sa.Column('voter_entry_id', sa.Integer(), nullable=True),
            sa.Column('mobile_number', sa.String(length=15), nullable=False),
            sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('payment_date', sa.Date(), nullable=False),
            sa.Column('payment_method', sa.String(length=32), server_default='Cash', nullable=False),
            sa.Column('payment_status', sa.String(length=32), server_default='Paid', nullable=False),
            sa.Column('transaction_reference', sa.String(length=128), nullable=True),
            sa.Column('remarks', sa.Text(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('updated_by', sa.Integer(), nullable=True),
            sa.Column('verified_by', sa.Integer(), nullable=True),
            sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['voter_id'], ['voter_records.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['voter_entry_id'], ['voter_entries.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['verified_by'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('transaction_id'),
            sa.UniqueConstraint('receipt_number')
        )
        op.create_index('ix_payments_transaction_id', 'payments', ['transaction_id'])
        op.create_index('ix_payments_receipt_number', 'payments', ['receipt_number'])
        op.create_index('ix_payments_voter_id', 'payments', ['voter_id'])
        op.create_index('ix_payments_voter_entry_id', 'payments', ['voter_entry_id'])
        op.create_index('ix_payments_mobile_number', 'payments', ['mobile_number'])
        op.create_index('ix_payments_payment_date', 'payments', ['payment_date'])
        op.create_index('ix_payments_payment_method', 'payments', ['payment_method'])
        op.create_index('ix_payments_payment_status', 'payments', ['payment_status'])
        op.create_index('ix_payments_created_by', 'payments', ['created_by'])

    if 'payment_audit_logs' not in tables:
        op.create_table(
            'payment_audit_logs',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('payment_id', sa.Integer(), nullable=False),
            sa.Column('action', sa.String(length=64), nullable=False),
            sa.Column('old_values', sa.JSON(), nullable=True),
            sa.Column('new_values', sa.JSON(), nullable=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('performed_by', sa.Integer(), nullable=True),
            sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['performed_by'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_payment_audit_logs_payment_id', 'payment_audit_logs', ['payment_id'])
        op.create_index('ix_payment_audit_logs_action', 'payment_audit_logs', ['action'])
        op.create_index('ix_payment_audit_logs_performed_by', 'payment_audit_logs', ['performed_by'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('payment_audit_logs')
    op.drop_table('payments')
