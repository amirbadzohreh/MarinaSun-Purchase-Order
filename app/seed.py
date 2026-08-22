"""
داده‌های اولیه برای تست سیستم.
اجرا: python3 seed.py
"""
from werkzeug.security import generate_password_hash
from database import get_connection, init_db

EMPLOYEES = [
    # personnel_number, full_name, position, department, email, password
    ("1204", "رضا احمدی", "کارشناس فناوری اطلاعات", "IT", "r.ahmadi@marinasan.com", "pass1204"),
    ("0817", "سارا کریمی", "مدیر IT", "IT", "s.karimi@marinasan.com", "pass0817"),
    ("0345", "محسن حسینی", "مدیر مالی", "مالی", "m.hosseini@marinasan.com", "pass0345"),
    ("0129", "علیرضا رستمی", "مدیرعامل", "مدیریت", "a.rostami@marinasan.com", "pass0129"),
]

# مسیر تایید بر اساس بازه مبلغ (تومان)
APPROVAL_RULES = [
    # min_amount, max_amount, step_order, approver_role
    (0, 200_000_000, 1, "مدیر IT"),
    (0, 200_000_000, 2, "مدیر مالی"),
    (0, 200_000_000, 3, "مدیرعامل"),
]


def run():
    init_db(reset=True)
    conn = get_connection()
    cur = conn.cursor()

    for personnel_number, full_name, position, department, email, password in EMPLOYEES:
        cur.execute(
            """INSERT INTO employees
               (personnel_number, full_name, position, department, email, password_hash)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (personnel_number, full_name, position, department, email,
             generate_password_hash(password)),
        )

    for min_amount, max_amount, step_order, approver_role in APPROVAL_RULES:
        cur.execute(
            """INSERT INTO approval_rules (min_amount, max_amount, step_order, approver_role)
               VALUES (?, ?, ?, ?)""",
            (min_amount, max_amount, step_order, approver_role),
        )

    conn.commit()
    conn.close()
    print("دیتابیس با داده‌های نمونه ساخته شد: app/marinasan.db")
    print("\nکاربران نمونه برای ورود:")
    for personnel_number, full_name, position, _, _, password in EMPLOYEES:
        print(f"  - {full_name} ({position}) | شماره پرسنلی: {personnel_number} | رمز: {password}")


if __name__ == "__main__":
    run()
