#!/usr/bin/env python3
"""OpenAGI 连续无人值守测试主控脚本
按 test_plan.json 顺序跑每一键，调 audit/verify 断言，截图归档，失败继续。
用法：
  python3 scripts/test_runner.py          # 正式跑（需要后端运行）
  python3 scripts/test_runner.py --dry-run  # 空跑，不调真实 API，验证目录/文件结构
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # dry-run 模式不需要

# ── 路径常量 ──────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path("/Users/mc/AI/openagi")
TEST_PLAN    = PROJECT_ROOT / "tests/test_plan.json"
SCREENCAP_SH = PROJECT_ROOT / "scripts/screencapture_archive.sh"
AUDIT_URL    = "http://127.0.0.1:8000/api/v1/audit/verify"

# RUN_DIR 在 main() 里按时间戳动态创建，此处先声明
RUN_DIR: Path = Path("/tmp/openagi_dry_run")

# ── 工具函数 ──────────────────────────────────────────────────────────────────

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _append_error(errors_log: Path, test_id: str, seq: int, reason: str) -> None:
    entry = {
        "seq": seq,
        "test_id": test_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "reason": reason,
    }
    with errors_log.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _update_progress(progress_file: Path, seq: int, total: int, result: dict) -> None:
    data: dict = {}
    if progress_file.exists():
        try:
            data = json.loads(progress_file.read_text())
        except json.JSONDecodeError:
            data = {}
    data["last_completed"] = seq
    data["total"] = total
    data.setdefault("results", []).append(
        {"seq": seq, "test_id": result.get("test_id"), "verdict": result.get("verdict")}
    )
    progress_file.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _call_screencap(test_id: str, verdict: str, dry_run: bool) -> str:
    """调 A1 screencapture_archive.sh，返回 sha256 或占位符。"""
    if dry_run:
        return "dry_run_no_screenshot"
    result = subprocess.run(
        ["bash", str(SCREENCAP_SH), test_id, verdict],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode == 0:
        # 输出格式：OK seq=001 verdict=PASS sha256=xxxx file=...
        for token in result.stdout.split():
            if token.startswith("sha256="):
                return token.split("=", 1)[1]
    return "screencap_failed"


def _call_audit_verify(tc: dict, dry_run: bool) -> dict:
    """调 A2 /api/v1/audit/verify，返回 {all_pass, network_ok, dom_ok, store_ok}。"""
    if dry_run:
        return {"all_pass": True, "network_ok": True, "dom_ok": True, "store_ok": True}
    if httpx is None:
        return {"all_pass": False, "error": "httpx 未安装"}
    payload = {
        "test_id": tc["test_id"],
        "dom_actual_text": tc.get("dom_actual_text", ""),
        "dom_min_length": tc.get("dom_min_length"),
        "dom_must_not_contain": tc.get("dom_must_not_contain"),
        "network_url_pattern": tc.get("network_url_pattern"),
        "network_response_must_contain": tc.get("network_response_must_contain"),
        "store_action_expected": tc.get("store_action_expected"),
        "store_action_actual": tc.get("store_action_actual"),
    }
    try:
        resp = httpx.post(AUDIT_URL, json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        return {"all_pass": False, "error": str(exc)}


# ── 核心单测函数 ──────────────────────────────────────────────────────────────

def run_one_test(tc: dict, seq: int, manifest_file: Path,
                 errors_log: Path, dry_run: bool) -> dict:
    """
    跑单个测试用例，遇任何异常不抛出，写入 errors_log 后继续。
    返回 result dict：{test_id, seq, verdict, sha256, timestamp, audit}
    """
    test_id = tc.get("test_id", f"unknown_{seq}")
    timestamp = datetime.utcnow().isoformat() + "Z"
    audit: dict = {}
    verdict = "ERROR"

    try:
        # 1. 业务断言 → 调 A2 /api/v1/audit/verify
        audit = _call_audit_verify(tc, dry_run)
        if "error" in audit:
            _append_error(errors_log, test_id, seq, f"audit 调用失败: {audit['error']}")
        else:
            verdict = "PASS" if audit.get("all_pass") else "FAIL"

        # 2. 截图归档 → 调 A1 screencapture_archive.sh
        #    注：仅 PASS/FAIL 时截图（ERROR 时 screencap 脚本会拒绝）
        cap_verdict = verdict if verdict in ("PASS", "FAIL") else "FAIL"
        sha256 = _call_screencap(test_id, cap_verdict, dry_run)

    except Exception as exc:
        verdict = "ERROR"
        sha256 = _sha256(f"{test_id}{timestamp}")
        _append_error(errors_log, test_id, seq, f"未捕获异常: {exc}")

    result = {
        "seq": f"{seq:03d}",
        "test_id": test_id,
        "verdict": verdict,
        "timestamp": timestamp,
        "sha256": sha256,
        "audit": audit,
    }

    # 3. 写入 manifest.jsonl（证据链三合一：seq + sha256 + timestamp）
    with manifest_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(result, ensure_ascii=False) + "\n")

    return result


# ── 主入口 ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="OpenAGI 连续测试主控")
    parser.add_argument("--dry-run", action="store_true", help="空跑，不调真实 API")
    args = parser.parse_args()

    global RUN_DIR
    ts_label = datetime.now().strftime("%Y%m%d_%H%M%S")
    RUN_DIR = PROJECT_ROOT / f"docs/test-runs/{ts_label}"
    RUN_DIR.mkdir(parents=True, exist_ok=True)

    manifest_file = RUN_DIR / "manifest.jsonl"
    errors_log    = RUN_DIR / "audit_errors.jsonl"
    progress_file = RUN_DIR / "progress.json"

    # 加载计划
    if not TEST_PLAN.exists():
        print(f"[ERROR] test_plan.json 不存在：{TEST_PLAN}", file=sys.stderr)
        sys.exit(1)
    plan = json.loads(TEST_PLAN.read_text(encoding="utf-8"))
    total = plan.get("total", len(plan.get("cases", [])))
    last  = plan.get("last_completed", 0)
    cases = plan.get("cases", [])[last:]  # 断点续跑：只处理 > last_completed

    prefix = "[DRY-RUN] " if args.dry_run else ""
    print(f"{prefix}开始测试，共 {len(cases)} 个用例（跳过前 {last} 个）")
    print(f"RUN_DIR = {RUN_DIR}")

    pass_count = fail_count = error_count = 0

    for i, tc in enumerate(cases, start=last + 1):
        print(f"  [{i:03d}/{total}] {tc.get('test_id', '?')} ", end="", flush=True)

        # 三禁令：DOMQuery 3 次重试
        result: dict = {}
        for attempt in range(3):
            result = run_one_test(tc, i, manifest_file, errors_log, args.dry_run)
            if result["verdict"] != "ERROR":
                break
            if attempt < 2:
                time.sleep(2)

        v = result.get("verdict", "ERROR")
        print(v)
        if v == "PASS":
            pass_count += 1
        elif v == "FAIL":
            fail_count += 1
        else:
            error_count += 1

        # 立即写断点续跑进度（每键写一次）
        plan["last_completed"] = i
        TEST_PLAN.write_text(json.dumps(plan, indent=2, ensure_ascii=False))
        _update_progress(progress_file, i, total, result)

    summary = {
        "total": len(cases),
        "pass": pass_count,
        "fail": fail_count,
        "error": error_count,
        "run_dir": str(RUN_DIR),
    }
    (RUN_DIR / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False)
    )
    print(
        f"\n{prefix}全部完成 — "
        f"通过 {pass_count}，失败 {fail_count}，错误 {error_count}，共 {len(cases)} 键"
    )
    print(f"证据目录：{RUN_DIR}")


if __name__ == "__main__":
    main()
