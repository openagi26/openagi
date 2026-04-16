"""Phase 2 桌面数字人特性测试 — 情绪引擎 + 语音 + Live2D 基础架构。"""

from pathlib import Path

DESKTOP_ROOT = Path(__file__).parent.parent.parent / "desktop"


def test_emotion_engine_exists():
    f = DESKTOP_ROOT / "src" / "emotion-engine.js"
    assert f.exists()
    content = f.read_text()
    assert "EmotionEngine" in content
    assert "mapHeartToEmotion" in content
    assert "LIVE2D_EXPRESSION_MAP" in content


def test_emotion_mapping_all_states():
    """情绪引擎覆盖 HeartEngine 所有4种状态。"""
    content = (DESKTOP_ROOT / "src" / "emotion-engine.js").read_text()
    for state in ["calm", "focused", "anxious", "crisis"]:
        assert f'"{state}"' in content or f"'{state}'" in content, f"缺少状态: {state}"


def test_emotion_9_emotions_in_map():
    """Live2D表情映射包含全部9种情绪。"""
    content = (DESKTOP_ROOT / "src" / "emotion-engine.js").read_text()
    for emotion in ["neutral", "happy", "sad", "angry", "think",
                     "surprise", "awkward", "curious", "focus"]:
        assert emotion in content, f"Live2D映射缺少情绪: {emotion}"


def test_emotion_live2d_params():
    """每种情绪都有 ParamEyeLOpen 等 Live2D 参数。"""
    content = (DESKTOP_ROOT / "src" / "emotion-engine.js").read_text()
    assert "ParamEyeLOpen" in content
    assert "ParamEyeROpen" in content
    assert "ParamMouthOpenY" in content
    assert "ParamBrowLY" in content


def test_voice_system_exists():
    f = DESKTOP_ROOT / "src" / "voice.js"
    assert f.exists()
    content = f.read_text()
    assert "VoiceSystem" in content
    assert "startListening" in content
    assert "speak" in content


def test_voice_stt_config():
    """STT 使用 MediaRecorder 录音 + 后端转写。"""
    content = (DESKTOP_ROOT / "src" / "voice.js").read_text()
    assert "MediaRecorder" in content
    assert "getUserMedia" in content
    assert "transcribe_audio" in content or "_transcribe" in content


def test_voice_tts_config():
    """TTS 配置为中文女声优先。"""
    content = (DESKTOP_ROOT / "src" / "voice.js").read_text()
    assert "SpeechSynthesisUtterance" in content
    assert "zh-CN" in content
    assert "getVoices" in content


def test_live2d_avatar_exists():
    f = DESKTOP_ROOT / "src" / "live2d-avatar.js"
    assert f.exists()
    content = f.read_text()
    assert "Live2DAvatar" in content
    assert "setExpression" in content
    assert "setMouthOpen" in content


def test_live2d_auto_behaviors():
    """Live2D 支持自动眨眼和空闲动作。"""
    content = (DESKTOP_ROOT / "src" / "live2d-avatar.js").read_text()
    assert "_startAutoBlink" in content
    assert "_startIdleMotion" in content
    assert "_setupMouseTracking" in content


def test_main_integrates_all_modules():
    """主入口集成了所有Phase 2模块。"""
    content = (DESKTOP_ROOT / "src" / "main.js").read_text()
    assert "EmotionEngine" in content
    assert "VoiceSystem" in content
    assert "Live2DAvatar" in content
    assert "emotionEngine" in content
    assert "voice" in content


def test_main_voice_handlers():
    """主入口有语音事件处理。"""
    content = (DESKTOP_ROOT / "src" / "main.js").read_text()
    assert "onResult" in content
    assert "onListenStart" in content
    assert "toggleListening" in content
    assert "autoSpeak" in content


def test_main_avatar_switch():
    """主入口支持形象切换。"""
    content = (DESKTOP_ROOT / "src" / "main.js").read_text()
    assert "toggleAvatar" in content
    assert "currentAvatar" in content
    assert '"star-spirit"' in content
    assert '"live2d"' in content


def test_html_has_voice_controls():
    """HTML 包含语音控制按钮。"""
    content = (DESKTOP_ROOT / "index.html").read_text()
    assert "mic-btn" in content
    assert "speaker-btn" in content
    assert "avatar-btn" in content
    assert "controls" in content


def test_css_has_voice_styles():
    """CSS 包含语音按钮样式。"""
    content = (DESKTOP_ROOT / "src" / "style.css").read_text()
    assert ".ctrl-btn.mic" in content
    assert ".listening" in content
    assert "pulse-mic" in content


def test_rust_heart_status_command():
    """Rust 后端有 get_heart_status 命令。"""
    content = (DESKTOP_ROOT / "src-tauri" / "src" / "lib.rs").read_text()
    assert "get_heart_status" in content
    assert "localhost:8888/health" in content


def test_rust_registers_all_commands():
    """Rust 注册了所有4个Tauri命令。"""
    content = (DESKTOP_ROOT / "src-tauri" / "src" / "lib.rs").read_text()
    for cmd in ["send_message", "get_greeting", "get_heart_status", "check_backend"]:
        assert cmd in content, f"Rust 缺少命令注册: {cmd}"
