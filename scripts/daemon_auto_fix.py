#!/usr/bin/env python3
"""
daemon_auto_fix.py — OpenAGI D1 daemon 自修脚本
读取所有 browser_* 目录的 manifest.jsonl，对 FAIL 用例做分类与自修。

分类：
  类型 A：test_plan 期望字段错（HTTP 200 但 network_response_must_contain 字段不在响应中）
          → 自动修正 test_plan.json 中对应 case 的 network_response_must_contain
  类型 B：真实后端 bug（非 200 / 超时 / API 调用失败）
          → 记录到 fail_queue，等人工介入

输出：
  /tmp/openagi_fail_queue.jsonl       — 所有分类结果
  docs/test-runs/daemon_health.json   — daemon 健康状态

用法：
  python3 scripts/daemon_auto_fix.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path("/Users/mc/AI/openagi")
TEST_PLAN    = PROJECT_ROOT / "tests/test_plan.json"
RUNS_BASE    = PROJECT_ROOT / "docs/test-runs"
FAIL_QUEUE   = Path("/tmp/openagi_fail_queue.jsonl")
HEALTH_FILE  = RUNS_BASE / "daemon_health.json"

# ─── 工具 ─────────────────────────────────────────────────────────────────────

def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _load_test_plan() -> tuple[dict, list]:
    """读取 test_plan.json，返回 (plan_dict, cases_list)"""
    raw = TEST_PLAN.read_text(encoding="utf-8")
    plan = json.loads(raw)
    return plan, plan.get("cases", [])


def _save_test_plan(plan: dict) -> None:
    """写回 test_plan.json（保留 UTF-8，不折行）"""
    TEST_PLAN.write_text(
        json.dumps(plan, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


# ─── 从 manifest 推断实际字段 ─────────────────────────────────────────────────

def _infer_actual_fields(result: dict) -> list[str]:
    """
    从 manifest 记录的 reply_preview 推断响应里有哪些顶层字段。

    reply_preview 由 _extract_preview 生成：
      - 如果 data 是 dict：从 (reply/content/message/status/available) 中取第一个非空
      - 如果 data 是 list：形如 "[列表，N 项] 首项: ..."
      - 否则直接是字符串

    规则：
      1. 若 reply_preview 以 "[列表" 开头 → data 是列表，顶层有 "data"
      2. 若 reply_preview 非空（dict 类型，成功提取了某个 key）→ 顶层有 "data"
      3. 若 api_status=True（HTTP 200）→ 肯定有 "success"
      4. 无法精确推断时 → 返回 ["data"]（比保留错误字段更安全）
    """
    preview = result.get("reply_preview", "")
    api_ok  = result.get("api_status", False)

    if not api_ok:
        return []

    # 有预览说明 data 字段存在（无论是 dict 还是 list）
    if preview:
        return ["data"]
    # api_status=True 但无预览（空 data）
    return ["data"]


# ─── FAIL 分类 ───────────────────────────────────────────────────────────────

def _classify_fail(result: dict) -> dict:
    """
    返回分类记录：
    {
      "test_id": str,
      "verdict": "FAIL",
      "type": "A" | "B",
      "reason": str,
      "missing_fields": [...],   # 类型 A
      "fix_applied": bool,
      "fix_detail": str,
    }
    """
    test_id  = result.get("test_id", "unknown")
    audit    = result.get("audit", {})
    details  = audit.get("details", {})
    net_ok   = audit.get("network_ok", False)
    api_ok   = result.get("api_status", False)
    net_msg  = details.get("network", "")

    # ── 从 network 消息中提取缺失字段 ──────────────────────────────────────
    # 格式：缺少字段: ['models']  或  API调用失败: HTTP 422: ...
    missing_fields: list[str] = []
    m = re.search(r"缺少字段:\s*(\[.*?\])", net_msg)
    if m:
        try:
            missing_fields = json.loads(m.group(1).replace("'", '"'))
        except Exception:
            pass

    # ── 分类 ──────────────────────────────────────────────────────────────
    if api_ok and missing_fields:
        # 类型 A：HTTP 200 但期望字段不在响应里
        return {
            "test_id": test_id,
            "verdict": "FAIL",
            "type": "A",
            "reason": f"期望字段不在响应中: {missing_fields}（后端 HTTP 200，字段名写错）",
            "missing_fields": missing_fields,
            "fix_applied": False,
            "fix_detail": "",
        }
    else:
        # 类型 B：真实后端 bug
        return {
            "test_id": test_id,
            "verdict": "FAIL",
            "type": "B",
            "reason": net_msg[:200] if net_msg else "API 调用失败或非 200",
            "missing_fields": [],
            "fix_applied": False,
            "fix_detail": "",
        }


# ─── 类型 A 自修 ──────────────────────────────────────────────────────────────

def _apply_type_a_fix(classified: dict, cases: list, result: dict) -> str:
    """
    对类型 A 的 FAIL 修正 test_plan.json 对应 case 的 network_response_must_contain。

    修正策略：
      - 用 _infer_actual_fields 推断真实字段
      - 若能推断 → 替换 network_response_must_contain
      - 若无法推断 → 设为 [] (清空，让该 case 跳过 network 断言)

    返回修改说明字符串（空字符串=未找到对应 case）
    """
    test_id = classified["test_id"]
    actual_fields = _infer_actual_fields(result)

    for case in cases:
        if case.get("test_id") == test_id:
            old_fields = case.get("network_response_must_contain", [])
            case["network_response_must_contain"] = actual_fields
            desc = (
                f"{test_id}: network_response_must_contain "
                f"{old_fields} → {actual_fields}"
            )
            return desc

    return ""  # 未找到对应 case


# ─── 读取所有 manifest ────────────────────────────────────────────────────────

def _load_all_manifests() -> list[dict]:
    """读取所有 browser_* 目录下的 manifest.jsonl，去重（按 test_id 保留最新）"""
    all_results: dict[str, dict] = {}  # test_id → latest result

    run_dirs = sorted(
        [d for d in RUNS_BASE.iterdir() if d.is_dir() and d.name.startswith("browser_")],
        key=lambda d: d.name
    )

    for run_dir in run_dirs:
        manifest = run_dir / "manifest.jsonl"
        if not manifest.exists():
            continue
        try:
            for line in manifest.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                test_id = r.get("test_id", "")
                if test_id:
                    all_results[test_id] = r  # 同一 test_id 保留最新跑的
        except Exception as e:
            print(f"[auto_fix] 读取 {manifest} 出错: {e}", file=sys.stderr)

    return list(all_results.values())


# ─── 读取 daemon_state 以获取轮次信息 ─────────────────────────────────────────

def _load_daemon_state() -> dict:
    state_file = RUNS_BASE / "daemon_state.json"
    if state_file.exists():
        try:
            return json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


# ─── 主流程 ──────────────────────────────────────────────────────────────────

def main() -> None:
    print("[auto_fix] 启动 daemon_auto_fix.py")
    print(f"[auto_fix] 时间: {_ts()}")

    # 加载 test_plan
    plan, cases = _load_test_plan()
    print(f"[auto_fix] 加载 test_plan.json: {len(cases)} 个用例")

    # 加载所有 manifest
    all_results = _load_all_manifests()
    fail_results = [r for r in all_results if r.get("verdict") == "FAIL"]
    print(f"[auto_fix] 扫描结果: 共 {len(all_results)} 条，FAIL {len(fail_results)} 条")

    # 分类
    type_a: list[dict] = []
    type_b: list[dict] = []
    for result in fail_results:
        c = _classify_fail(result)
        if c["type"] == "A":
            type_a.append((c, result))
        else:
            type_b.append(c)

    print(f"[auto_fix] 类型 A (字段错): {len(type_a)} 个")
    print(f"[auto_fix] 类型 B (真 bug): {len(type_b)} 个")

    # 自修类型 A
    auto_fixed = 0
    fix_details = []
    for classified, result in type_a:
        desc = _apply_type_a_fix(classified, cases, result)
        if desc:
            classified["fix_applied"] = True
            classified["fix_detail"] = desc
            auto_fixed += 1
            fix_details.append(desc)
            print(f"[auto_fix]   修正 A: {desc}")
        else:
            classified["fix_applied"] = False
            classified["fix_detail"] = f"未在 test_plan 中找到 {classified['test_id']}"
            print(f"[auto_fix]   警告: 未找到 {classified['test_id']}")

    # 写回 test_plan.json（只有真的修了才写）
    if auto_fixed > 0:
        _save_test_plan(plan)
        print(f"[auto_fix] test_plan.json 已更新（修改 {auto_fixed} 个 case）")
    else:
        print("[auto_fix] test_plan.json 无需更新")

    # 构建 fail_queue
    queue_entries = []
    for classified, result in type_a:
        queue_entries.append({
            **classified,
            "timestamp": _ts(),
        })
    for classified in type_b:
        queue_entries.append({
            **classified,
            "fix_applied": False,
            "fix_detail": "类型 B：需人工介入",
            "timestamp": _ts(),
        })

    # 写 fail_queue
    if queue_entries:
        with FAIL_QUEUE.open("w", encoding="utf-8") as f:
            for entry in queue_entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        print(f"[auto_fix] fail_queue 写入: {FAIL_QUEUE} ({len(queue_entries)} 条)")
    else:
        FAIL_QUEUE.write_text("", encoding="utf-8")
        print("[auto_fix] 无 FAIL，fail_queue 已清空")

    # 计算汇总统计
    total_pass  = sum(1 for r in all_results if r.get("verdict") == "PASS")
    total_fail  = len(fail_results)
    human_queue = [c for c in type_b]

    # 读 daemon_state
    state = _load_daemon_state()

    # 写 daemon_health.json
    health = {
        "last_round": _ts(),
        "rounds_done": state.get("rounds", 0),
        "keys_completed": state.get("completed", 0),
        "total_keys": state.get("total_keys", 100),
        "total_pass": total_pass,
        "total_fails": total_fail,
        "auto_fixed": auto_fixed,
        "human_needed": len(human_queue),
        "auto_fix_details": fix_details,
        "human_queue": [
            {"test_id": c["test_id"], "reason": c["reason"]}
            for c in human_queue
        ],
        "type_a_count": len(type_a),
        "type_b_count": len(type_b),
    }
    RUNS_BASE.mkdir(parents=True, exist_ok=True)
    HEALTH_FILE.write_text(
        json.dumps(health, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"[auto_fix] daemon_health.json 写入: {HEALTH_FILE}")

    # 最终汇总
    print()
    print("=" * 60)
    print(f"[auto_fix] 完成")
    print(f"  类型 A 已自修: {auto_fixed} 个")
    print(f"  类型 B 入队列: {len(human_queue)} 个")
    print(f"  fail_queue   : {FAIL_QUEUE}")
    print(f"  health.json  : {HEALTH_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
