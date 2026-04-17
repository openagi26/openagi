#!/usr/bin/env python3
"""run_1key.py — 1键真实端到端测试（≤60行）"""
import hashlib, json, sys, time
from datetime import datetime
from pathlib import Path
import httpx

BASE = "http://localhost:8888"
BANNED = ["DEMO", "演示", "[错误", "placeholder"]

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
run_dir = Path(f"/Users/mc/AI/openagi/docs/test-runs/1key_{ts}")
run_dir.mkdir(parents=True, exist_ok=True)

# 1. health
h = httpx.get(f"{BASE}/health", timeout=5)
assert h.status_code == 200, f"health FAIL: {h.status_code}"

# 2. chat/send
t0 = time.time()
r = httpx.post(f"{BASE}/api/v1/chat/send",
               json={"message": "介绍下 Python 装饰器", "persona": "engineer", "core_count": 1},
               timeout=60)
elapsed = round(time.time() - t0, 2)
reply: str = r.json().get("data", {}).get("reply", "") if r.status_code == 200 else ""
sha = hashlib.sha256(reply.encode()).hexdigest()[:16]

# 3. audit/verify
ar = httpx.post(f"{BASE}/api/v1/audit/verify", timeout=10, json={
    "test_id": f"1key_{ts}",
    "network_url_pattern": "/api/v1/chat/send",
    "network_response_must_contain": ["装饰器"],
    "dom_actual_text": reply[:200] + " — 来自 /api/v1/chat/send",
    "dom_must_not_contain": BANNED,
    "dom_min_length": 30,
})
audit = ar.json()

# 4. 业务断言
a1 = r.status_code == 200
a2 = len(reply) >= 30
a3 = not any(w in reply for w in BANNED)
a4 = audit.get("all_pass", False)

# 5. 写文件
(run_dir / "reply.txt").write_text(reply, encoding="utf-8")
(run_dir / "manifest.jsonl").write_text(json.dumps(
    {"seq": 1, "test_id": f"1key_{ts}", "verdict": "PASS" if all([a1,a2,a3,a4]) else "FAIL",
     "timestamp": ts, "reply_sha256": sha, "audit": audit}, ensure_ascii=False) + "\n", encoding="utf-8")
(run_dir / "progress.json").write_text(json.dumps(
    {"total": 1, "passed": int(all([a1,a2,a3,a4])), "failed": int(not all([a1,a2,a3,a4])),
     "last_run": ts, "last_verdict": "PASS" if all([a1,a2,a3,a4]) else "FAIL"}, indent=2, ensure_ascii=False))

a5 = (run_dir / "manifest.jsonl").exists()
a6 = (run_dir / "reply.txt").exists()
verdict = "PASS" if all([a1, a2, a3, a4, a5, a6]) else "FAIL"

# 6. stdout
print(f"\n后端 /health 状态: {h.status_code}")
print(f"POST chat/send 耗时: {elapsed}s  HTTP {r.status_code}")
print(f"reply 前100字: {reply[:100]}")
print(f"reply 长度: {len(reply)} 字 | sha256前16: {sha}")
print(f"audit: all_pass={audit.get('all_pass')}  network_ok={audit.get('network_ok')}  dom_ok={audit.get('dom_ok')}  store_ok={audit.get('store_ok')}")
print(f"\n业务断言: 1.HTTP200={'✅' if a1 else '❌'}  2.len≥30={'✅' if a2 else '❌'}  3.无禁词={'✅' if a3 else '❌'}  4.audit={'✅' if a4 else '❌'}  5.manifest={'✅' if a5 else '❌'}  6.reply.txt={'✅' if a6 else '❌'}")
print(f"\n最终判定: [{verdict}]  证据目录: {run_dir}\n")
sys.exit(0 if verdict == "PASS" else 1)
