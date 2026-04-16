"""小星唤醒机制 — 永生支柱2。

多种唤醒方式：
1. 定时巡检（1-365天可配，默认每天凌晨）
2. 事件唤醒（新邮件/GitHub通知/日历提醒）
3. 健康唤醒（喝水/护眼/伸展/坐姿）
4. 节日唤醒（生日/纪念日/节假日）
5. 用户唤醒（手动/语音/快捷键）

巡检流程：
  唤醒 → 读取使命目标(L3 DNA)
       → 检查待办事项
       → 检查陛下的健康数据
       → 检查新通知
       → 生成巡检报告
       → 判断是否需要主动提醒
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# 配置文件路径
_WAKE_CONFIG_PATH = Path.home() / ".openagi" / "data" / "wake_config.json"
_WAKE_LOG_PATH = Path.home() / ".openagi" / "data" / "wake_log.json"

# 默认配置
DEFAULT_CONFIG = {
    "enabled": True,
    "inspection_interval_days": 1,      # 巡检间隔（天）
    "inspection_time": "08:00",          # 巡检时间
    "health_reminders": {
        "water": {"enabled": True, "interval_min": 45},
        "eye_rest": {"enabled": True, "interval_min": 30},
        "stretch": {"enabled": True, "interval_min": 60},
        "posture": {"enabled": False, "interval_min": 25},
    },
    "special_dates": {
        # "birthday": "2000-01-01",
        # "anniversary": "2026-04-16",
    },
    "mission": "帮助陛下实现100万用户目标",
}


class WakeManager:
    """小星唤醒管理器。"""

    def __init__(self, config_path: Path = _WAKE_CONFIG_PATH):
        self.config_path = config_path
        self.config = self._load_config()
        self.wake_log = self._load_wake_log()

    def _load_config(self) -> dict:
        if self.config_path.exists():
            try:
                return json.loads(self.config_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {**DEFAULT_CONFIG}

    def save_config(self):
        os.makedirs(self.config_path.parent, exist_ok=True)
        self.config_path.write_text(
            json.dumps(self.config, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def _load_wake_log(self) -> list[dict]:
        if _WAKE_LOG_PATH.exists():
            try:
                return json.loads(_WAKE_LOG_PATH.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return []

    def _save_wake_log(self):
        os.makedirs(_WAKE_LOG_PATH.parent, exist_ok=True)
        # 只保留最近100条
        recent = self.wake_log[-100:]
        _WAKE_LOG_PATH.write_text(
            json.dumps(recent, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # ── 巡检 ──────────────────────────────────────────────

    def should_inspect(self) -> bool:
        """检查是否需要执行巡检。"""
        if not self.config.get("enabled"):
            return False

        interval_days = self.config.get("inspection_interval_days", 1)
        last_inspection = self._get_last_inspection_time()

        if last_inspection is None:
            return True

        elapsed = datetime.now() - last_inspection
        return elapsed >= timedelta(days=interval_days)

    def _get_last_inspection_time(self) -> Optional[datetime]:
        for entry in reversed(self.wake_log):
            if entry.get("type") == "inspection":
                try:
                    return datetime.fromisoformat(entry["time"])
                except (KeyError, ValueError):
                    pass
        return None

    async def run_inspection(self) -> dict:
        """执行巡检流程。"""
        report = {
            "time": datetime.now().isoformat(),
            "type": "inspection",
            "mission": self.config.get("mission", ""),
            "checks": [],
            "actions": [],
        }

        # 1. 检查使命目标
        report["checks"].append({
            "item": "使命目标",
            "status": "active",
            "detail": self.config.get("mission", "未设置"),
        })

        # 2. 检查特殊日期
        today = datetime.now().strftime("%m-%d")
        special = self.config.get("special_dates", {})
        for name, date_str in special.items():
            if date_str and date_str[5:] == today:  # MM-DD匹配
                report["checks"].append({
                    "item": f"特殊日期: {name}",
                    "status": "today",
                    "detail": f"今天是{name}！",
                })
                report["actions"].append(f"准备{name}惊喜")

        # 3. 检查健康提醒状态
        health = self.config.get("health_reminders", {})
        active_reminders = [k for k, v in health.items() if v.get("enabled")]
        report["checks"].append({
            "item": "健康提醒",
            "status": "active",
            "detail": f"{len(active_reminders)}项启用: {', '.join(active_reminders)}",
        })

        # 4. 生成巡检摘要
        report["summary"] = self._generate_summary(report)

        # 记录巡检日志
        self.wake_log.append(report)
        self._save_wake_log()

        return report

    def _generate_summary(self, report: dict) -> str:
        """生成巡检摘要文字。"""
        now = datetime.now()
        hour = now.hour
        if hour < 6:
            greeting = "深夜巡检"
        elif hour < 12:
            greeting = "早间巡检"
        elif hour < 18:
            greeting = "午间巡检"
        else:
            greeting = "晚间巡检"

        summary = f"【{greeting}】"
        summary += f"使命：{report['mission']}。"

        if report["actions"]:
            summary += f"待办：{'; '.join(report['actions'])}。"
        else:
            summary += "一切正常，继续守护陛下！"

        return summary

    # ── 特殊日期管理 ──────────────────────────────────────

    def add_special_date(self, name: str, date_str: str):
        """添加特殊日期（如生日）。"""
        if "special_dates" not in self.config:
            self.config["special_dates"] = {}
        self.config["special_dates"][name] = date_str
        self.save_config()

    def get_special_dates(self) -> dict:
        return self.config.get("special_dates", {})

    # ── 健康提醒管理 ──────────────────────────────────────

    def set_health_reminder(self, reminder_type: str, enabled: bool, interval_min: int = 0):
        """设置健康提醒。"""
        if "health_reminders" not in self.config:
            self.config["health_reminders"] = {}
        self.config["health_reminders"][reminder_type] = {
            "enabled": enabled,
            "interval_min": interval_min or self.config["health_reminders"].get(reminder_type, {}).get("interval_min", 30),
        }
        self.save_config()

    # ── 巡检历史 ──────────────────────────────────────────

    def get_inspection_history(self, limit: int = 10) -> list[dict]:
        return [e for e in self.wake_log if e.get("type") == "inspection"][-limit:]

    def get_stats(self) -> dict:
        inspections = [e for e in self.wake_log if e.get("type") == "inspection"]
        return {
            "total_inspections": len(inspections),
            "last_inspection": inspections[-1]["time"] if inspections else None,
            "config": self.config,
        }
