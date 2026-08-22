#!/usr/bin/env python3
"""تست همزمانی gevent"""
import sys
sys.path.insert(0, '/app')

import gevent
from gevent import monkey
monkey.patch_all()

import requests
import time
from concurrent.futures import ThreadPoolExecutor
import statistics

BASE_URL = "http://localhost:5002"

def test_health():
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        return r.status_code == 200
    except:
        return False

def login():
    try:
        r = requests.post("http://localhost:5002/api/auth/login", 
            json={"personnel_number": "1204", "password": "pass1204"}, timeout=10)
        if r.status_code == 200:
            return r.json()["token"]
    except:
        return None
    return None

def test_concurrent(n=50, concurrency=20):
    """تست همزمان n درخواست با concurrency همزمان"""
    
    # اول لاگین کن
    token = login()
    if not token:
        print("❌ Login failed")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    def make_request():
        try:
            r = requests.get("http://localhost:5002/api/purchase-requests", 
                           headers={"Authorization": f"Bearer {login()}"}, timeout=10)
            return r.status_code == 200
        except:
            return False
    
    # تست همزمان با ThreadPoolExecutor
    print(f"شروع تست {n} درخواست با {concurrency} همزمان...")
    start = time.time()
    
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(make_request) for _ in range(n)]
        results = [f.result() for f in futures]
    
    elapsed = time.time() - start
    success = sum(results)
    
    print(f"\n✅ موفق: {success}/{n}")
    print(f"⏱ زمان کل: {elapsed:.2f}s")
    print(f"📊 RPS: {n/elapsed:.1f}")
    print(f"❌ خطا: {n-success}")

if __name__ == "__main__":
    test_concurrent(100, 25)
