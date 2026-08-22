"""
ابزار مدیریت خط فرمان.

استفاده:
  python3 manage.py init-db             ساخت جداول خالی (بدون هیچ داده‌ای)
  python3 manage.py seed-demo           پر کردن با داده نمایشی — فقط برای تست، هرگز روی دیتابیس واقعی!
  python3 manage.py create-employee     افزودن تعاملی یک کارمند واقعی با رمز عبور امن
"""
import sys
import getpass
from werkzeug.security import generate_password_hash
from database import init_db, get_connection


def cmd_init_db():
    init_db()
    print("جداول با موفقیت ساخته شدند.")


def cmd_seed_demo():
    confirm = input(
        "⚠ این دستور همه داده‌های موجود را پاک و با داده نمایشی جایگزین می‌کند.\n"
        "فقط برای محیط تست/دمو اجرا کن، نه روی دیتابیس واقعی شرکت.\n"
        "برای ادامه 'yes' را تایپ کن: "
    )
    if confirm.strip().lower() != "yes":
        print("لغو شد.")
        return
    from seed import run
    run()


def cmd_create_employee():
    personnel_number = input("شماره پرسنلی: ").strip()
    full_name = input("نام و نام خانوادگی: ").strip()
    position = input(
        "سمت سازمانی (اگر این فرد قرار است تاییدکننده باشد، باید دقیقا با\n"
        "         مقدار approver_role در جدول approval_rules یکسان باشد): "
    ).strip()
    department = input("دپارتمان: ").strip()
    email = input("ایمیل: ").strip()
    password = getpass.getpass("رمز عبور اولیه: ")
    password_confirm = getpass.getpass("تکرار رمز عبور: ")

    if password != password_confirm:
        print("رمزهای عبور یکسان نیستند. لغو شد.")
        return
    if len(password) < 8:
        print("رمز عبور باید حداقل ۸ کاراکتر باشد. لغو شد.")
        return

    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO employees
               (personnel_number, full_name, position, department, email, password_hash)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (personnel_number, full_name, position, department, email,
             generate_password_hash(password)),
        )
        conn.commit()
        print(f"کارمند «{full_name}» با شماره پرسنلی {personnel_number} با موفقیت اضافه شد.")
    except Exception as e:
        conn.rollback()
        print(f"خطا در افزودن کارمند: {e}")
    finally:
        conn.close()


COMMANDS = {
    "init-db": cmd_init_db,
    "seed-demo": cmd_seed_demo,
    "create-employee": cmd_create_employee,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"استفاده: python3 manage.py [{'|'.join(COMMANDS)}]")
        sys.exit(1)
    COMMANDS[sys.argv[1]]()
