"""
Workflow logic for purchase request approval system.
Handles multi-step approval, signatures, and document generation.
"""
import os
import logging
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

# Playwright for PDF generation
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

# Database imports
from database import get_connection


class WorkflowError(Exception):
    """Custom exception for workflow errors."""
    pass


def build_approval_steps(conn, purchase_request_id: int, total_amount: float):
    """
    بر اساس مبلغ کل درخواست، قوانین approval_rules را می‌خواند
    و ردیف‌های approval_steps را می‌سازد.
    برای هر مرحله، اولین کارمند فعال با همان سمت (position) به عنوان تاییدکننده انتخاب می‌شود.
    """
    cur = conn.cursor()

    rules = cur.execute(
        """SELECT * FROM approval_rules
           WHERE is_active = true
             AND min_amount <= ?
             AND (max_amount IS NULL OR max_amount >= ?)
           ORDER BY step_order ASC""",
        (total_amount, total_amount),
    ).fetchall()

    if not rules:
        raise WorkflowError("برای این مبلغ هیچ مسیر تاییدی تعریف نشده است.")

    for rule in rules:
        approver = cur.execute(
            """SELECT id FROM employees
               WHERE position = ? AND is_active = true
               ORDER BY id LIMIT 1""",
            (rule["approver_role"],),
        ).fetchone()

        if approver is None:
            raise WorkflowError(f"هیچ کارمند فعالی با سمت «{rule['approver_role']}» یافت نشد.")

        cur.execute(
            """INSERT INTO approval_steps
               (purchase_request_id, step_order, approver_id, status)
               VALUES (?, ?, ?, 'pending')""",
            (purchase_request_id, rule["step_order"], approver["id"]),
        )


@dataclass
class ApprovalStep:
    id: int
    purchase_request_id: int
    step_order: int
    approver_id: int
    status: str  # pending, approved, rejected
    created_at: str
    updated_at: str


def get_current_step(conn, purchase_request_id: int):
    """Get current approval step and purchase request info."""
    cur = conn.cursor()
    pr = cur.execute(
        """SELECT * FROM purchase_requests WHERE id = ?""",
        (purchase_request_id,)
    ).fetchone()

    if not pr:
        raise WorkflowError("درخواست خرید یافت نشد.")

    current_step_order = pr["current_step_order"] or 1
    step = cur.execute(
        """SELECT * FROM approval_steps 
           WHERE purchase_request_id = ? AND step_order = ?""",
        (purchase_request_id, current_step_order)
    ).fetchone()

    return pr, step


def _save_printed_document(conn, purchase_request_id: int, generated_by: int,
                           html_content: str, pdf_bytes: bytes = None):
    """Save printed document to database."""
    import hashlib
    content_hash = hashlib.sha256(html_content.encode()).hexdigest()[:64]
    file_size = len(pdf_bytes) if pdf_bytes else len(html_content.encode())

    cur = conn.cursor()
    cur.execute(
        """INSERT INTO printed_documents
           (purchase_request_id, document_html, document_pdf, generated_by, file_size, content_hash)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(purchase_request_id) DO UPDATE SET
           document_html = excluded.document_html,
           document_pdf = excluded.document_pdf,
           generated_by = excluded.generated_by,
           file_size = excluded.file_size,
           content_hash = excluded.content_hash,
           generated_at = CURRENT_TIMESTAMP""",
        (purchase_request_id, html_content, pdf_bytes, generated_by, file_size, content_hash),
    )
    conn.commit()


def _generate_printed_document_html(conn, purchase_request_id: int) -> str:
    """Generate HTML content for the printed document - compact single page."""
    cur = conn.cursor()

    # Get request details
    request = cur.execute(
        """SELECT * FROM purchase_requests WHERE id = ?""",
        (purchase_request_id,)
    ).fetchone()

    # Get items
    items = cur.execute(
        """SELECT * FROM purchase_request_items WHERE purchase_request_id = ?""",
        (purchase_request_id,)
    ).fetchall()

    # Get approval steps with signatures
    steps = cur.execute(
        """SELECT s.*, e.full_name as approver_name, e.position as approver_position,
                sig.signature_image, sig.full_name as signer_name, sig.position as signer_position,
                sig.decision, sig.signed_at, sig.comment
           FROM approval_steps s
           LEFT JOIN employees e ON s.approver_id = e.id
           LEFT JOIN approval_signatures sig ON sig.approval_step_id = s.id
          WHERE s.purchase_request_id = ?
          ORDER BY s.step_order""",
        (purchase_request_id,)
    ).fetchall()

    # Get requester info
    requester = cur.execute(
        """SELECT * FROM employees WHERE id = ?""",
        (request["requester_id"],)
    ).fetchone()

    # Helper functions
    def format_currency(amount):
        return "{:,.0f}".format(float(amount))

    def format_persian_date(date_val):
        if not date_val:
            return "-"
        if isinstance(date_val, datetime):
            dt = date_val
        else:
            dt = datetime.fromisoformat(str(date_val).replace('Z', '+00:00'))
        total_minutes = dt.minute + 30
        extra_hours = total_minutes // 60
        final_minute = total_minutes % 60
        final_hour = (dt.hour + 3 + extra_hours) % 24
        tehran_time = dt.replace(hour=final_hour, minute=final_minute)
        return tehran_time.strftime('%Y/%m/%d %H:%M')

    step_labels = {1: 'مدیر IT', 2: 'مدیر مالی', 3: 'مدیرعامل'}

    def get_status_label(status):
        labels = {'pending': 'در انتظار', 'approved': 'تایید شده', 'rejected': 'رد شده', 'cancelled': 'لغو شده'}
        return labels.get(status, status)

    def get_decision_label(decision):
        return 'تایید' if decision == 'approved' else 'رد'

    # Build items HTML
    items_html = ''
    for item in items:
        items_html += f'''
        <tr>
            <td class="px-2 py-1 text-right font-medium text-xs">{item["item_name"]}</td>
            <td class="px-2 py-1 text-center text-xs">{item["quantity"]}</td>
            <td class="px-2 py-1 text-center text-xs">{format_currency(item["unit_price"])}</td>
            <td class="px-2 py-1 text-center font-bold text-xs">{format_currency(item["total_price"])}</td>
        </tr>'''

    # Build signatures HTML - compact with small signatures next to names
    sig_rows = ''
    for step in steps:
        is_approved = step['status'] == 'approved'
        border_clr = 'success' if is_approved else ('danger' if step['status'] == 'rejected' else 'warning')
        status_clr = 'bg-success-100 text-success-700' if is_approved else ('bg-danger-100 text-danger-700' if step['status'] == 'rejected' else 'bg-warning-100 text-warning-700')

        sig_img = ''
        if step['signature_image']:
            sig_img = f'<img src="{step["signature_image"]}" alt="امضاء" style="height:20px;width:auto;vertical-align:middle;margin-right:6px;">'
        elif step['decision']:
            sig_img = '<span style="display:inline-block;height:20px;width:auto;vertical-align:middle;margin-right:6px;background:#e2e8f0;border-radius:3px;"></span>'

        signer = step['signer_name'] or step['approver_name']
        pos = step['signer_position'] or step['approver_position']
        dt = format_persian_date(step['signed_at']) if step['signed_at'] else '-'

        sig_rows += f'''
        <tr class="border-t border-gray-200">
            <td class="px-2 py-1.5 text-center w-8">
                <div class="w-6 h-6 rounded-full flex items-center justify-center bg-{border_clr}-100 text-{border_clr}-700 text-[10px] font-bold">{step['step_order']}</div>
            </td>
            <td class="px-2 py-1.5">
                <div class="flex items-center">
                    <div class="font-semibold text-xs text-gray-800">{step_labels.get(step['step_order'], f"مرحله {step['step_order']}")}</div>
                    <div class="text-[10px] text-gray-500 ml-2">{signer} - {pos}</div>
                    {sig_img}
                </div>
            </td>
            <td class="px-2 py-1.5 text-center w-20">
                <span class="inline-block px-1.5 py-0.5 text-[9px] rounded {status_clr}">{get_status_label(step['status'])}</span>
            </td>
            <td class="px-2 py-1.5 text-[9px] text-gray-600">{dt}</td>
        </tr>'''

    # Complete HTML - compact single page
    html = f'''<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        @page {{ margin: 0.8cm; size: A4; }}
        * {{ box-sizing: border-box; }}
        body {{ 
            font-family: 'Vazirmatn', 'IRANSans', 'Tahoma', sans-serif; 
            font-size: 10pt; 
            line-height: 1.4; 
            margin: 0; 
            padding: 0; 
            color: #1e293b; 
        }}
        .header {{ 
            border-bottom: 2px solid #3b82f6; 
            padding-bottom: 8px; 
            margin-bottom: 12px; 
        }}
        .header-content {{ display: flex; align-items: center; gap: 10px; }}
        .logo {{ 
            width: 48px; height: 48px; 
            border-radius: 8px; 
            display: flex; align-items: center; justify-content: center; 
        }}
        .logo img {{
            width: 100%; height: 100%; object-fit: contain;
        }}
        .company-name {{ font-size: 18px; font-weight: bold; color: #0f172a; }}
        .company-sub {{ font-size: 11px; color: #64748b; }}
        .doc-meta {{ text-align: left; font-size: 10px; color: #64748b; margin-top: 4px; }}
        .section {{ margin-bottom: 10px; }}
        .section-title {{ 
            font-weight: bold; 
            font-size: 11px; 
            color: #1e293b; 
            border-bottom: 1px solid #e2e8f0; 
            padding-bottom: 3px; 
            margin-bottom: 6px;
        }}
        .info-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 10px; }}
        .info-item {{ }}
        .info-label {{ color: #64748b; font-size: 9px; }}
        .info-value {{ font-weight: 600; color: #0f172a; }}
        .info-value.amount {{ color: #3b82f6; font-size: 12px; font-weight: bold; }}
        .items-table {{ width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }}
        .items-table th, .items-table td {{ border: 1px solid #e2e8f0; padding: 4px 6px; text-align: center; }}
        .items-table th {{ background: #f8fafc; font-weight: 600; color: #334155; }}
        .items-table tbody td:first-child {{ text-align: right; font-weight: 500; }}
        .items-table tfoot td {{ font-weight: bold; background: #f8fafc; }}
        .sig-table {{ width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }}
        .sig-table th, .sig-table td {{ border: 1px solid #e2e8f0; padding: 4px 6px; text-align: center; }}
        .sig-table th {{ background: #f8fafc; font-weight: 600; color: #334155; }}
        .sig-table tbody td:first-child {{ text-align: center; }}
        .sig-table tbody td:nth-child(2) {{ text-align: right; }}
        .sig-table tr:last-child td {{ font-weight: bold; background: #f8fafc; }}
        .badge {{ display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600; }}
        .footer {{ 
            margin-top: 16px; 
            padding-top: 8px; 
            border-top: 1px solid #e2e8f0; 
            text-align: center; 
            font-size: 9px; 
            color: #64748b; 
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div class="logo">
                <img src="data:image/png;base64,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Z2VSZWFkeXHJZTwAAAPraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzEzOCA3OS4xNTk4MjQsIDIwMTYvMDkvMTQtMDE6MDk6MDEgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtbD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMC0xMi0xOVQxMjowNjoyMSswMzozMCIgeG1wOk1vZGlmeURhdGU9IjIwMjAtMTItMjFUMTU6MzQ6MjQrMDM6MzAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjAtMTItMjFUMTU6MzQ6MjQrMDM6MzAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkFBOTU2MzRDNDM4NDExRUJBRkQ0QTI2QTYyNEY0MkI1IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkFBOTU2MzRENDM4NDExRUJBRkQ0QTI2QTYyNEY0MkI1Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6QUE5NTYzNEE0Mzg0MTFFQkFGRDRBMjZBNjI0RjQyQjUiIHN0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" alt="ماریناسان">
            </div>
            <div>
                <div class="company-name">ماریناسان</div>
                <div class="company-sub">سیستم درخواست خرید - سند تاییدیه</div>
            </div>
        </div>
        <div class="doc-meta">
            <div>شماره: {request['request_number']}</div>
            <div>چاپ: {datetime.now().strftime('%Y/%m/%d %H:%M')}</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">اطلاعات درخواست</div>
        <div class="info-grid">
            <div class="info-item"><div class="info-label">شماره درخواست</div><div class="info-value">{request['request_number']}</div></div>
            <div class="info-item"><div class="info-label">تاریخ ثبت</div><div class="info-value">{format_persian_date(request['created_at'])}</div></div>
            <div class="info-item"><div class="info-label">درخواست‌دهنده</div><div class="info-value">{requester['full_name'] if requester else 'نامشخص'}</div></div>
            <div class="info-item"><div class="info-label">مبلغ کل</div><div class="info-value amount">{format_currency(request['total_amount'])}</div></div>
        </div>
        {f'<div style="margin-top:8px;font-size:10px;"><strong>توضیحات:</strong> {request["description"]}</div>' if request["description"] else ''}
    </div>

    <div class="section">
        <div class="section-title">اقلام درخواست</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width:50%">نام کالا/خدمت</th>
                    <th style="width:15%">تعداد</th>
                    <th style="width:17%">قیمت واحد</th>
                    <th style="width:18%">مبلغ کل</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="text-align:right;font-weight:bold;">مبلغ کل</td>
                    <td style="font-weight:bold;font-size:11px;">{format_currency(request['total_amount'])}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <div class="section">
        <div class="section-title">گردش تایید و امضاهای دیجیتال</div>
        <table class="sig-table">
            <thead>
                <tr>
                    <th style="width:8%">مرحله</th>
                    <th style="width:45%">نقش / تاییدکننده / امضاء</th>
                    <th style="width:18%">وضعیت</th>
                    <th style="width:29%">تاریخ / ساعت</th>
                </tr>
            </thead>
            <tbody>
                {sig_rows}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <div>این سند به صورت دیجیتال امضا شده و معتبر می‌باشد</div>
        <div>ماریناسان - سیستم درخواست خرید</div>
    </div>
</body>
</html>'''

    return html


def _generate_pdf_with_playwright(html_content: str) -> bytes:
    """Generate PDF using Playwright."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content)
        pdf_bytes = page.pdf(format='A4', margin={'top': '0.5cm', 'bottom': '0.5cm', 'left': '0.5cm', 'right': '0.5cm'})
        browser.close()
    return pdf_bytes


def _generate_and_save_printed_document(conn, purchase_request_id: int, generated_by: int):
    """Generate and save the printed document (HTML + PDF) for an approved request."""
    html_content = _generate_printed_document_html(conn, purchase_request_id)

    # Generate PDF using Playwright
    try:
        pdf_bytes = _generate_pdf_with_playwright(html_content)
    except Exception as e:
        # Log error but don't fail the approval - save HTML only
        import logging
        logging.error(f"PDF generation failed for request {purchase_request_id}: {e}")
        pdf_bytes = None

    _save_printed_document(conn, purchase_request_id, generated_by, html_content, pdf_bytes)


def submit_decision(conn, purchase_request_id: int, employee_id: int, decision: str,
                     comment: str = None, ip_address: str = None, device_info: str = None,
                     signature_type: str = "digital_click", signature_image: str = None):
    """
    ثبت تصمیم (تایید/رد/بازگشت برای تکمیل مدارک) یک کارمند برای مرحله فعلی درخواست.
    - بررسی می‌کند که کارمند همان تاییدکننده‌ی مرحله فعلی باشد (جلوگیری از جعل امضا).
    - رکورد امضا را با نام و شماره پرسنلی کارمند در لحظه امضا ثبت می‌کند.
    - در صورت تایید، مرحله بعد را باز می‌کند؛ در صورت رد، کل درخواست رد می‌شود.
    - در صورت بازگشت برای مدارک، درخواست به وضعیت returned_for_documents برمی‌گردد.
    """
    if decision not in ("approved", "rejected", "returned_for_documents"):
        raise WorkflowError("مقدار decision باید approved، rejected یا returned_for_documents باشد.")

    cur = conn.cursor()
    pr, step = get_current_step(conn, purchase_request_id)

    if pr["status"] != "pending":
        raise WorkflowError(f"این درخواست در وضعیت «{pr['status']}» است و قابل تایید/رد/بازگشت نیست.")

    if step is None:
        raise WorkflowError("مرحله تایید معتبری برای این درخواست یافت نشد.")

    if step["approver_id"] != employee_id:
        raise WorkflowError("شما تاییدکننده مجاز این مرحله نیستید.")

    employee = cur.execute(
        "SELECT * FROM employees WHERE id = ?", (employee_id,)
    ).fetchone()

    # ثبت امضا (denormalized: نام و شماره پرسنلی همین الان کپی می‌شود)
    cur.execute(
        """INSERT INTO approval_signatures
           (purchase_request_id, approval_step_id, step_order,
            employee_id, personnel_number, full_name, position,
            decision, comment, signature_type, signature_hash, signature_image,
            ip_address, device_info)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (purchase_request_id, step["id"], step["step_order"],
         employee["id"], employee["personnel_number"], employee["full_name"], employee["position"],
         decision, comment, signature_type, None, signature_image,
         ip_address, device_info),
    )

    cur.execute(
        "UPDATE approval_steps SET status = ? WHERE id = ?",
        (decision, step["id"]),
    )

    if decision == "rejected":
        cur.execute(
            "UPDATE purchase_requests SET status = 'rejected', updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), purchase_request_id),
        )
        conn.commit()
        return {"purchase_request_status": "rejected", "step_order": step["step_order"]}

    if decision == "returned_for_documents":
        # Keep current_step_order as is - will continue from this step when resubmitted
        # Mark the current step as returned_for_documents
        cur.execute(
            "UPDATE purchase_requests SET status = 'returned_for_documents', updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), purchase_request_id),
        )
        cur.execute(
            "UPDATE approval_steps SET status = 'returned_for_documents' WHERE id = ?",
            (step["id"],),
        )
        conn.commit()
        return {"purchase_request_status": "returned_for_documents", "step_order": step["step_order"]}

    # تایید شد -> بررسی اینکه مرحله بعدی وجود دارد یا این آخرین مرحله بود
    next_step = cur.execute(
        """SELECT * FROM approval_steps
           WHERE purchase_request_id = ? AND step_order = ?""",
        (purchase_request_id, step["step_order"] + 1),
    ).fetchone()

    if next_step is None:
        # این آخرین مرحله بود - درخواست تایید شد
        cur.execute(
            "UPDATE purchase_requests SET status = 'approved', updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), purchase_request_id),
        )
        
        # Generate and save the printed document
        _generate_and_save_printed_document(conn, purchase_request_id, employee_id)
        
        conn.commit()
        return {"purchase_request_status": "approved", "step_order": step["step_order"]}
    else:
        cur.execute(
            "UPDATE purchase_requests SET current_step_order = ?, updated_at = ? WHERE id = ?",
            (next_step["step_order"], datetime.utcnow().isoformat(), purchase_request_id),
        )
        conn.commit()
        return {"purchase_request_status": "pending", "step_order": step["step_order"],
                "next_step_order": next_step["step_order"]}