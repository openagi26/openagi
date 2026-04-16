"""小星主动感知系统测试 — 桌面生活助手核心引擎。"""

from pathlib import Path

DESKTOP_ROOT = Path(__file__).parent.parent.parent / "desktop"


# ── 主动感知引擎 ──────────────────────────────────────────

def test_proactive_engine_exists():
    f = DESKTOP_ROOT / "src" / "proactive-engine.js"
    assert f.exists()
    content = f.read_text()
    assert "ProactiveEngine" in content
    assert "APP_SCENES" in content
    assert "WELLNESS_REMINDERS" in content


def test_six_scene_types():
    """覆盖陛下定义的6大场景。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    scenes = ["creation", "socialPost", "coding", "business", "foreignApp", "entertainment"]
    for s in scenes:
        assert s in content, f"缺少场景: {s}"


def test_scene_keywords_cover_apps():
    """场景关键词覆盖主流应用。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    apps = ["photoshop", "figma", "小红书", "github", "gmail",
            "outlook", "vscode", "bilibili", "youtube"]
    for app in apps:
        assert app in content, f"缺少应用关键词: {app}"


def test_scene_cooldown_mechanism():
    """场景有冷却时间防止频繁打扰。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    assert "cooldownMin" in content
    assert "_isOnCooldown" in content
    assert "_setCooldown" in content


def test_scene_chinese_responses():
    """场景响应包含陛下称呼和中文鼓励。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    assert "陛下" in content
    assert "小星" in content
    assert "恭喜" in content or "太棒了" in content


# ── 健康提醒 ──────────────────────────────────────────────

def test_wellness_four_types():
    """4种健康提醒：喝水/护眼/伸展/坐姿。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    for t in ["water", "eyeRest", "stretch", "posture"]:
        assert t in content, f"缺少健康提醒: {t}"


def test_wellness_water_reminder():
    """喝水提醒包含💧和具体文案。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    assert "喝水" in content
    assert "💧" in content


def test_wellness_toggle():
    """健康提醒可开关。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    assert "toggleWellness" in content
    assert "_wellnessEnabled" in content


# ── 活动窗口监测 ──────────────────────────────────────────

def test_window_monitoring():
    """活动窗口监测机制。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    assert "_checkActiveWindow" in content
    assert "processWindowTitle" in content
    assert "get_active_window" in content


def test_rust_active_window_command():
    """Rust 有活动窗口检测命令。"""
    content = (DESKTOP_ROOT / "src-tauri" / "src" / "lib.rs").read_text()
    assert "get_active_window" in content
    assert "osascript" in content  # macOS AppleScript
    assert "frontmost" in content


def test_rust_registers_5_commands():
    """Rust 注册了全部5个命令。"""
    content = (DESKTOP_ROOT / "src-tauri" / "src" / "lib.rs").read_text()
    for cmd in ["send_message", "get_greeting", "get_heart_status",
                "get_active_window", "check_backend"]:
        assert cmd in content, f"缺少命令: {cmd}"


# ── 集成测试 ──────────────────────────────────────────────

def test_main_integrates_proactive():
    """主入口集成了主动感知引擎。"""
    content = (DESKTOP_ROOT / "src" / "main.js").read_text()
    assert "ProactiveEngine" in content
    assert "proactive" in content
    assert "setupProactive" in content
    assert "proactive.start()" in content


# ── 改名验证 ──────────────────────────────────────────────

def test_renamed_to_xiaoxing():
    """全部改名为小星。"""
    for name in ["index.html", "src/star-spirit.js", "src/main.js"]:
        content = (DESKTOP_ROOT / name).read_text()
        assert "小星" in content, f"{name} 未改名为小星"
    # Rust 也改了
    content = (DESKTOP_ROOT / "src-tauri" / "src" / "lib.rs").read_text()
    assert "小星" in content


def test_foreign_app_translation_scene():
    """外文软件翻译场景。"""
    content = (DESKTOP_ROOT / "src" / "proactive-engine.js").read_text()
    assert "foreignApp" in content
    assert "翻译" in content
    assert "英文" in content
