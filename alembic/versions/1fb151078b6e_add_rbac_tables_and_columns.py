"""add_rbac_tables_and_columns

Revision ID: 1fb151078b6e
Revises: dfb279beb9e6
Create Date: 2026-11-22 03:37:51.659319

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1fb151078b6e'
down_revision: Union[str, Sequence[str], None] = 'dfb279beb9e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # Columns on roles
    role_cols = [c['name'] for c in inspector.get_columns('roles')]
    if 'is_system' not in role_cols:
        op.add_column('roles', sa.Column('is_system', sa.Boolean(), server_default='false', nullable=False))
    if 'updated_at' not in role_cols:
        op.add_column('roles', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))

    if 'permissions' not in tables:
        op.create_table(
            'permissions',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('code', sa.String(length=100), nullable=False),
            sa.Column('module', sa.String(length=64), nullable=False),
            sa.Column('action', sa.String(length=32), nullable=False),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('code')
        )

    if 'role_permissions' not in tables:
        op.create_table(
            'role_permissions',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('role_id', sa.Integer(), nullable=False),
            sa.Column('permission_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

    if 'user_roles' not in tables:
        op.create_table(
            'user_roles',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('role_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

    if 'audit_logs' not in tables:
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('action', sa.String(length=128), nullable=False),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column('ip_address', sa.String(length=64), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('audit_logs')
    op.drop_table('user_roles')
    op.drop_table('role_permissions')
    op.drop_table('permissions')
