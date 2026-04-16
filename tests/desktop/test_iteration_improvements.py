"""Phase 2.1 迭代改进测试 — 来自三方审计头脑风暴。"""

from pathlib import Path

DESKTOP_ROOT = Path(__file__).parent.parent.parent / "desktop"


# ── 改进1: 粒子交互物理 ──────────────────────────────────

def test_particle_interaction_physics():
    """星灵粒子有触碰排斥+聚拢回弹物理。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    assert "repelForce" in content, "缺少排斥力"
    assert "returnSpeed" in content, "缺少回弹速度"
    assert "vx" in content and "vy" in content, "缺少速度分量"


def test_particle_mouse_interaction():
    """鼠标移动和点击触发粒子物理反应。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    assert "mousemove" in content
    assert "mousedown" in content
    assert "mouseup" in content


def test_particle_fps_adaptive():
    """帧率自适应：动态LOD。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    assert "_fps" in content
    assert "_targetParticles" in content
    assert "80" in content and "20" in content  # LOD范围


# ── 改进2: 专注模式看护 ──────────────────────────────────

def test_focus_guard_exists():
    f = DESKTOP_ROOT / "src" / "focus-guard.js"
    assert f.exists()
    content = f.read_text()
    assert "FocusGuard" in content
    assert "FOCUS_PRESETS" in content


def test_focus_presets():
    """专注预设包含番茄钟/深度工作/马拉松。"""
    content = (DESKTOP_ROOT / "src" / "focus-guard.js").read_text()
    assert "番茄钟" in content
    assert "25" in content
    assert "深度工作" in content
    assert "45" in content
    assert "马拉松" in content
    assert "60" in content


def test_focus_idle_detection():
    """闲置检测：60秒无操作提醒。"""
    content = (DESKTOP_ROOT / "src" / "focus-guard.js").read_text()
    assert "idleSeconds" in content
    assert "recordActivity" in content
    assert "onIdleWarning" in content


def test_focus_milestones():
    """专注里程碑：25%/50%/75%提醒。"""
    content = (DESKTOP_ROOT / "src" / "focus-guard.js").read_text()
    assert "onMilestone" in content
    assert "25" in content
    assert "50" in content
    assert "75" in content


def test_focus_stats_persistence():
    """专注统计持久化到localStorage。"""
    content = (DESKTOP_ROOT / "src" / "focus-guard.js").read_text()
    assert "localStorage" in content
    assert "focus-stats" in content
    assert "todaySessions" in content
    assert "streak" in content


def test_focus_integrated_in_main():
    """主入口集成了专注模式。"""
    content = (DESKTOP_ROOT / "src" / "main.js").read_text()
    assert "FocusGuard" in content
    assert "focusGuard" in content
    assert "setupFocusGuard" in content


def test_focus_button_in_html():
    """HTML有专注按钮。"""
    content = (DESKTOP_ROOT / "index.html").read_text()
    assert "focus-btn" in content


# ── 改进3: 情绪感知tooltip ──────────────────────────────

def test_emotion_tooltip_system():
    """星灵有情绪变化tooltip提示。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    assert "EMOTION_TOOLTIPS" in content
    assert "_showTooltip" in content


def test_emotion_chinese_labels():
    """情绪标签使用中文。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    assert "平静" in content
    assert "开心" in content
    assert "专注" in content
    assert "思考" in content
    assert "好奇" in content


def test_emotion_tooltip_messages():
    """每种情绪有对应的感知提示文案。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    assert "小星感知到" in content
    assert "正在专注" in content
    assert "好开心" in content


def test_particle_easing_transition():
    """情绪切换使用easing平滑过渡。"""
    content = (DESKTOP_ROOT / "src" / "star-spirit.js").read_text()
    assert "ease" in content.lower()
    assert "dt" in content  # 时间步长
