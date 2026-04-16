"""唤醒机制测试。"""

import tempfile
from pathlib import Path


def test_wake_module_exists():
    f = Path(__file__).parent.parent.parent / "openagi" / "cortex" / "commander" / "wake.py"
    assert f.exists()
    content = f.read_text()
    assert "WakeManager" in content
    assert "should_inspect" in content
    assert "run_inspection" in content


def test_wake_manager_init():
    from openagi.cortex.commander.wake import WakeManager
    tmp = tempfile.mktemp(suffix=".json")
    mgr = WakeManager(config_path=Path(tmp))
    assert mgr.config["enabled"] is True
    assert mgr.config["inspection_interval_days"] == 1


def test_should_inspect_first_time():
    from openagi.cortex.commander.wake import WakeManager
    tmp = tempfile.mktemp(suffix=".json")
    mgr = WakeManager(config_path=Path(tmp))
    assert mgr.should_inspect() is True  # 首次应该巡检


def test_special_dates():
    from openagi.cortex.commander.wake import WakeManager
    tmp = tempfile.mktemp(suffix=".json")
    mgr = WakeManager(config_path=Path(tmp))
    mgr.add_special_date("生日", "1990-05-15")
    assert "生日" in mgr.get_special_dates()


def test_health_reminder_config():
    from openagi.cortex.commander.wake import WakeManager
    tmp = tempfile.mktemp(suffix=".json")
    mgr = WakeManager(config_path=Path(tmp))
    mgr.set_health_reminder("water", True, 45)
    assert mgr.config["health_reminders"]["water"]["enabled"] is True
    assert mgr.config["health_reminders"]["water"]["interval_min"] == 45
