"""Initial migration - create all tables from schema_postgres.sql

Revision ID: 001_initial
Revises: 
Create Date: 2025-07-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =====================================================================
    # ۱) کارمندان
    # =====================================================================
    op.create_table(
        'employees',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('personnel_number', sa.String(20), nullable=False),
        sa.Column('full_name', sa.String(150), nullable=False),
        sa.Column('position', sa.String(100), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('email', sa.String(150), nullable=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('signature_image', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('personnel_number'),
        sa.UniqueConstraint('email'),
    )

    # =====================================================================
    # ۲) درخواست‌های خرید
    # =====================================================================
    op.create_table(
        'purchase_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_number', sa.String(30), nullable=False),
        sa.Column('requester_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('total_amount', sa.Numeric(18, 2), nullable=False, server_default=sa.text('0')),
        sa.Column('currency', sa.String(10), nullable=False, server_default=sa.text("'IRT'")),
        sa.Column('status', sa.String(30), nullable=False, server_default=sa.text("'pending'")),
        sa.Column('current_step_order', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('attachment_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_number'),
        sa.ForeignKeyConstraint(['requester_id'], ['employees.id'], ondelete='RESTRICT'),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected','cancelled')",
            name='ck_purchase_requests_status'
        ),
    )

    # =====================================================================
    # ۳) اقلام هر درخواست
    # =====================================================================
    op.create_table(
        'purchase_request_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_request_id', sa.Integer(), nullable=False),
        sa.Column('item_name', sa.String(200), nullable=False),
        sa.Column('quantity', sa.Numeric(12, 2), nullable=False),
        sa.Column('unit_price', sa.Numeric(18, 2), nullable=False),
        sa.Column('total_price', sa.Numeric(18, 2), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['purchase_request_id'], ['purchase_requests.id'], ondelete='CASCADE'),
    )

    # =====================================================================
    # ۴) قوانین مسیر تایید (بر اساس بازه مبلغ)
    # =====================================================================
    op.create_table(
        'approval_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('min_amount', sa.Numeric(18, 2), nullable=False, server_default=sa.text('0')),
        sa.Column('max_amount', sa.Numeric(18, 2), nullable=True),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('approver_role', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )

    # =====================================================================
    # ۵) مراحل تاییدیه‌ی تولیدشده برای هر درخواست خاص
    # =====================================================================
    op.create_table(
        'approval_steps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_request_id', sa.Integer(), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('approver_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['purchase_request_id'], ['purchase_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approver_id'], ['employees.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('purchase_request_id', 'step_order', name='uq_approval_steps_request_step'),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected')",
            name='ck_approval_steps_status'
        ),
    )

    # =====================================================================
    # ۶) امضاهای نهایی (سند تاریخی و غیرقابل‌تغییر)
    # =====================================================================
    op.create_table(
        'approval_signatures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_request_id', sa.Integer(), nullable=False),
        sa.Column('approval_step_id', sa.Integer(), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('personnel_number', sa.String(20), nullable=False),
        sa.Column('full_name', sa.String(150), nullable=False),
        sa.Column('position', sa.String(100), nullable=True),
        sa.Column('decision', sa.String(20), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('signature_type', sa.String(20), nullable=False, server_default=sa.text("'digital_click'")),
        sa.Column('signature_hash', sa.String(256), nullable=True),
        sa.Column('signature_image', sa.Text(), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('device_info', sa.String(300), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['purchase_request_id'], ['purchase_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approval_step_id'], ['approval_steps.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='RESTRICT'),
        sa.CheckConstraint(
            "decision IN ('approved','rejected')",
            name='ck_approval_signatures_decision'
        ),
        sa.CheckConstraint(
            "signature_type IN ('digital_click','digital_certificate','otp_confirmed')",
            name='ck_approval_signatures_type'
        ),
    )

    # =====================================================================
    # Indexes
    # =====================================================================
    op.create_index('idx_pr_status', 'purchase_requests', ['status'])
    op.create_index('idx_pr_requester', 'purchase_requests', ['requester_id'])
    op.create_index('idx_steps_request', 'approval_steps', ['purchase_request_id'])
    op.create_index('idx_signatures_request', 'approval_signatures', ['purchase_request_id'])
    op.create_index('idx_signatures_employee', 'approval_signatures', ['employee_id'])


def downgrade() -> None:
    op.drop_index('idx_signatures_employee', table_name='approval_signatures')
    op.drop_index('idx_signatures_request', table_name='approval_signatures')
    op.drop_index('idx_steps_request', table_name='approval_steps')
    op.drop_index('idx_pr_requester', table_name='purchase_requests')
    op.drop_index('idx_pr_status', table_name='purchase_requests')

    op.drop_table('approval_signatures')
    op.drop_table('approval_steps')
    op.drop_table('approval_rules')
    op.drop_table('purchase_request_items')
    op.drop_table('purchase_requests')
    op.drop_table('employees')