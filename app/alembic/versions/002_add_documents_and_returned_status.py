"""Add documents field and returned_for_documents status to purchase_requests

Revision ID: 002_add_documents_and_returned_status
Revises: 001_initial
Create Date: 2025-07-24
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_documents_and_returned_status'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add documents column to purchase_requests
    op.add_column('purchase_requests', sa.Column('documents', sa.Text(), nullable=True))

    # Update status check constraint to include returned_for_documents
    op.drop_constraint('ck_purchase_requests_status', 'purchase_requests', type_='check')
    op.create_check_constraint(
        'ck_purchase_requests_status',
        'purchase_requests',
        "status IN ('pending','approved','rejected','cancelled','returned_for_documents')"
    )

    # Update approval_signatures decision check constraint to include returned_for_documents
    op.drop_constraint('ck_approval_signatures_decision', 'approval_signatures', type_='check')
    op.create_check_constraint(
        'ck_approval_signatures_decision',
        'approval_signatures',
        "decision IN ('approved','rejected','returned_for_documents')"
    )


def downgrade() -> None:
    # Revert approval_signatures decision check constraint
    op.drop_constraint('ck_approval_signatures_decision', 'approval_signatures', type_='check')
    op.create_check_constraint(
        'ck_approval_signatures_decision',
        'approval_signatures',
        "decision IN ('approved','rejected')"
    )

    # Revert purchase_requests status check constraint
    op.drop_constraint('ck_purchase_requests_status', 'purchase_requests', type_='check')
    op.create_check_constraint(
        'ck_purchase_requests_status',
        'purchase_requests',
        "status IN ('pending','approved','rejected','cancelled')"
    )

    # Drop documents column
    op.drop_column('purchase_requests', 'documents')