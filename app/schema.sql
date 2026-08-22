-- =====================================================================
-- ماریناسان | سیستم درخواست خرید و گردش تاییدیه  (نسخه SQLite)
-- =====================================================================
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- ۱) کارمندان
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_number    TEXT NOT NULL UNIQUE,
    full_name           TEXT NOT NULL,
    position            TEXT,
    department          TEXT,
    email               TEXT UNIQUE,
    password_hash       TEXT NOT NULL,
    is_active           INTEGER NOT NULL DEFAULT 1,
    signature_image     TEXT,                    -- Base64 PNG امضای دیجیتال
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- ۲) درخواست‌های خرید
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_requests (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number       TEXT NOT NULL UNIQUE,
    requester_id         INTEGER NOT NULL REFERENCES employees(id),
    title                TEXT NOT NULL,
    description          TEXT,
    total_amount         NUMERIC NOT NULL DEFAULT 0,
    currency             TEXT NOT NULL DEFAULT 'IRT',
    status               TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected','cancelled','returned_for_documents')),
    current_step_order   INTEGER NOT NULL DEFAULT 1,
    attachment_url       TEXT,
    documents            TEXT,                        -- مدارک و پیوست‌های درخواست‌دهنده (اختیاری)
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- ۳) اقلام هر درخواست
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_request_items (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_request_id  INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    item_name            TEXT NOT NULL,
    quantity             NUMERIC NOT NULL,
    unit_price           NUMERIC NOT NULL,
    total_price          NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ---------------------------------------------------------------------
-- ۴) قوانین مسیر تایید (بر اساس بازه مبلغ)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_rules (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    min_amount           NUMERIC NOT NULL DEFAULT 0,
    max_amount           NUMERIC,                    -- NULL یعنی بدون سقف
    step_order           INTEGER NOT NULL,
    approver_role        TEXT NOT NULL,               -- باید با employees.position مطابقت داشته باشد
    is_active            INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------
-- ۵) مراحل تاییدیه‌ی تولیدشده برای هر درخواست خاص
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_steps (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_request_id  INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    step_order           INTEGER NOT NULL,
    approver_id          INTEGER NOT NULL REFERENCES employees(id),
    status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
    UNIQUE (purchase_request_id, step_order)
);

-- ---------------------------------------------------------------------
-- ۶) امضاهای نهایی (سند تاریخی و غیرقابل‌تغییر)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_signatures (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_request_id  INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    approval_step_id     INTEGER NOT NULL REFERENCES approval_steps(id),
    step_order           INTEGER NOT NULL,

    employee_id          INTEGER NOT NULL REFERENCES employees(id),
    personnel_number     TEXT NOT NULL,
    full_name            TEXT NOT NULL,
    position              TEXT,

    decision              TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
    comment               TEXT,

    signature_type        TEXT NOT NULL DEFAULT 'digital_click'
                          CHECK (signature_type IN ('digital_click','digital_certificate','otp_confirmed')),
    signature_hash         TEXT,
    signature_image        TEXT,                    -- Base64 PNG امضا در لحظه تایید

    signed_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address            TEXT,
    device_info           TEXT
);

CREATE INDEX IF NOT EXISTS idx_pr_status           ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_requester        ON purchase_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_steps_request       ON approval_steps(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_signatures_request  ON approval_signatures(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_signatures_employee ON approval_signatures(employee_id);

-- سند چاپی تایید نهایی (PDF/HTML ذخیره شده)
CREATE TABLE IF NOT EXISTS printed_documents (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_request_id  INTEGER NOT NULL UNIQUE REFERENCES purchase_requests(id) ON DELETE CASCADE,
    
    document_html        TEXT NOT NULL,              -- محتوای HTML سند
    document_pdf         BLOB,                       -- فایل PDF (اختیاری)
    
    generated_by         INTEGER NOT NULL REFERENCES employees(id),
    generated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    file_size            INTEGER,                    -- حجم فایل بایت
    content_hash         TEXT,                       -- SHA256 برای تأیید یکپارچگی
    
    UNIQUE (purchase_request_id)
);

CREATE INDEX IF NOT EXISTS idx_printed_docs_request ON printed_documents(purchase_request_id);
