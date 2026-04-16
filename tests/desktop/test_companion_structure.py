"""桌面数字人 Phase 1 结构测试 — 验证文件完整性和配置正确性。"""

import json
from pathlib import Path

DESKTOP_ROOT = Path(__file__).parent.parent.parent / "desktop"


def test_desktop_directory_exists():
    assert DESKTOP_ROOT.exists(), "desktop/ 目录不存在"


def test_package_json():
    pkg = DESKTOP_ROOT / "package.json"
    assert pkg.exists()
    data = json.loads(pkg.read_text())
    assert data["name"] == "openagi-desktop"
    assert "@tauri-apps/cli" in data.get("devDependencies", {})


def test_tauri_conf():
    conf = DESKTOP_ROOT / "src-tauri" / "tauri.conf.json"
    assert conf.exists()
    data = json.loads(conf.read_text())
    assert data["productName"] == "OpenAGI Companion"
    # 透明窗口配置
    win = data["app"]["windows"][0]
    assert win["transparent"] is True
    assert win["decorations"] is False
    assert win["alwaysOnTop"] is True
    # 系统托盘
    assert "trayIcon" in data["app"]


def test_cargo_toml():
    cargo = DESKTOP_ROOT / "src-tauri" / "Cargo.toml"
    assert cargo.exists()
    content = cargo.read_text()
    assert "tauri" in content
    assert "reqwest" in content  # HTTP 客户端与后端通信
    assert "tray-icon" in content
    assert "macos-private-api" in content  # 透明窗口需要


def test_rust_lib():
    lib = DESKTOP_ROOT / "src-tauri" / "src" / "lib.rs"
    assert lib.exists()
    content = lib.read_text()
    assert "send_message" in content
    assert "get_greeting" in content
    assert "check_backend" in content
    assert "localhost:8888" in content  # 连接后端
    assert "localhost:8888/health" in content  # 正确的健康检查端点


def test_frontend_files():
    assert (DESKTOP_ROOT / "index.html").exists()
    assert (DESKTOP_ROOT / "src" / "main.js").exists()
    assert (DESKTOP_ROOT / "src" / "style.css").exists()
    assert (DESKTOP_ROOT / "src" / "star-spirit.js").exists()


def test_star_spirit_emotions():
    """星灵支持9种情绪。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    emotions = ["neutral", "happy", "sad", "think", "angry",
                "surprise", "focus", "curious", "awkward"]
    for e in emotions:
        assert e in content, f"缺少情绪: {e}"


def test_frontend_chat_integration():
    """前端正确连接后端API。"""
    content = (DESKTOP_ROOT / "src" / "main.js").read_text()
    assert "localhost:8888" in content
    assert "send_message" in content
    assert "check_backend" in content
    assert "addMessage" in content


def test_vite_config():
    assert (DESKTOP_ROOT / "vite.config.js").exists()


def test_icons_exist():
    icons_dir = DESKTOP_ROOT / "src-tauri" / "icons"
    assert icons_dir.exists()
    assert (icons_dir / "tray.png").exists()
    assert (icons_dir / "32x32.png").exists()


def test_design_doc_updated():
    """设计文档包含5种形象+自定义。"""
    doc = Path(__file__).parent.parent.parent / "docs" / "digital-companion-desktop.md"
    assert doc.exists()
    content = doc.read_text()
    assert "星灵" in content
    assert "灵狐" in content
    assert "幼龙" in content
    assert "灵枭" in content
    assert "星猫" in content
    assert "自定义创作" in content
    assert "M1.1" in content  # 里程碑


def test_companion_greeting_logic():
    """Rust lib 包含完整时段问候逻辑。"""
    content = (DESKTOP_ROOT / "src-tauri" / "src" / "lib.rs").read_text()
    assert "早上好" in content
    assert "夜深了" in content
    assert "陛下" in content
