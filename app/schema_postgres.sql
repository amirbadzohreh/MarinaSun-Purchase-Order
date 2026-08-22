-- =====================================================================
-- ماریناسان | سیستم درخواست خرید  —  اسکیمای PostgreSQL (Production)
-- =====================================================================

CREATE TABLE IF NOT EXISTS employees (
    id                  SERIAL PRIMARY KEY,
    personnel_number    VARCHAR(20)  NOT NULL UNIQUE,
    full_name           VARCHAR(150) NOT NULL,
    position            VARCHAR(100),
    department          VARCHAR(100),
    email               VARCHAR(150) UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    signature_image     TEXT,                    -- Base64 PNG امضای دیجیتال
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_requests (
    id                   SERIAL PRIMARY KEY,
    request_number       VARCHAR(30)  NOT NULL UNIQUE,
    requester_id         INTEGER NOT NULL REFERENCES employees(id),
    title                VARCHAR(200) NOT NULL,
    description          TEXT,
    total_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    currency             VARCHAR(10) NOT NULL DEFAULT 'IRT',
    status               VARCHAR(30) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected','cancelled','returned_for_documents')),
    current_step_order   INTEGER NOT NULL DEFAULT 1,
    attachment_url       VARCHAR(500),
    documents            TEXT,                        -- مدارک و پیوست‌های درخواست‌دهنده (اختیاری)
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
    id                   SERIAL PRIMARY KEY,
    purchase_request_id  INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    item_name            VARCHAR(200) NOT NULL,
    quantity             NUMERIC(12,2) NOT NULL,
    unit_price           NUMERIC(18,2) NOT NULL,
    total_price          NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS approval_rules (
    id                   SERIAL PRIMARY KEY,
    min_amount           NUMERIC(18,2) NOT NULL DEFAULT 0,
    max_amount           NUMERIC(18,2),
    step_order           INTEGER NOT NULL,
    approver_role        VARCHAR(100) NOT NULL,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS approval_steps (
    id                   SERIAL PRIMARY KEY,
    purchase_request_id  INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    step_order           INTEGER NOT NULL,
    approver_id          INTEGER NOT NULL REFERENCES employees(id),
    status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
    UNIQUE (purchase_request_id, step_order)
);

CREATE TABLE IF NOT EXISTS approval_signatures (
    id                   SERIAL PRIMARY KEY,
    purchase_request_id  INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    approval_step_id     INTEGER NOT NULL REFERENCES approval_steps(id),
    step_order           INTEGER NOT NULL,

    employee_id          INTEGER NOT NULL REFERENCES employees(id),
    personnel_number     VARCHAR(20)  NOT NULL,
    full_name            VARCHAR(150) NOT NULL,
    position              VARCHAR(100),

    decision              VARCHAR(20) NOT NULL CHECK (decision IN ('approved','rejected')),
    comment               TEXT,

    signature_type        VARCHAR(20) NOT NULL DEFAULT 'digital_click'
                          CHECK (signature_type IN ('digital_click','digital_certificate','otp_confirmed')),
    signature_hash         VARCHAR(256),
    signature_image        TEXT,                    -- Base64 PNG امضا در لحظه تایید

    signed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address            VARCHAR(45),
    device_info           VARCHAR(300)
);

-- سند چاپی تایید نهایی (PDF/HTML ذخیره شده)
CREATE TABLE IF NOT EXISTS printed_documents (
    id                   SERIAL PRIMARY KEY,
    purchase_request_id  INTEGER NOT NULL UNIQUE REFERENCES purchase_requests(id) ON DELETE CASCADE,
    
    document_html        TEXT NOT NULL,              -- محتوای HTML سند
    document_pdf         BYTEA,                      -- فایل PDF (اختیاری)
    
    generated_by         INTEGER NOT NULL REFERENCES employees(id),  -- کارمندی که تایید نهایی کرده
    generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    file_size            INTEGER,                    -- حجم فایل بایت
    content_hash         VARCHAR(64),                -- SHA256 برای تأیید یکپارچگی
    
    UNIQUE (purchase_request_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_status           ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_requester        ON purchase_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_steps_request       ON approval_steps(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_signatures_request  ON approval_signatures(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_signatures_employee ON approval_signatures(employee_id);
CREATE INDEX IF NOT EXISTS idx_printed_docs_request ON printed_documents(purchase_request_id);
