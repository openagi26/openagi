"""文字转语音(TTS) API路由 — 小星的嘴巴。

多引擎TTS降级链：
1. edge-tts（微软免费，中文最佳，XiaoxiaoNeural女声）
2. macOS say命令（零依赖，离线可用）
3. 返回文字（无语音降级）
"""

from __future__ import annotations

import asyncio
import base64
import os
import tempfile

from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter(prefix="/api/v1/tts", tags=["语音合成"])

# 默认语音
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"


@router.post("/speak")
async def text_to_speech(payload: dict):
    """文字转语音，返回音频base64。"""
    text = payload.get("text", "").strip()
    voice = payload.get("voice", DEFAULT_VOICE)

    if not text:
        return {"success": False, "error": "缺少文字内容"}

    # 策略1: edge-tts（最佳质量）
    audio_b64 = await _try_edge_tts(text, voice)
    if audio_b64:
        return {"success": True, "data": {"audio_base64": audio_b64, "format": "mp3", "engine": "edge-tts"}}

    # 策略2: macOS say命令（离线可用）
    audio_b64 = await _try_macos_say(text)
    if audio_b64:
        return {"success": True, "data": {"audio_base64": audio_b64, "format": "aiff", "engine": "macos-say"}}

    return {"success": False, "error": "无可用TTS引擎"}


@router.get("/voices")
async def list_voices():
    """列出可用的中文语音。"""
    try:
        import edge_tts
        voices = await edge_tts.list_voices()
        zh_voices = [
            {"id": v["ShortName"], "name": v["ShortName"], "gender": v["Gender"], "locale": v["Locale"]}
            for v in voices if v["Locale"].startswith("zh")
        ]
        return {"success": True, "data": zh_voices}
    except ImportError:
        return {"success": True, "data": [{"id": "macos-say", "name": "macOS系统语音", "gender": "Female", "locale": "zh-CN"}]}


async def _try_edge_tts(text: str, voice: str) -> str | None:
    """微软edge-tts — 免费、高质量、中文最佳。"""
    try:
        import edge_tts

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name

        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(tmp_path)

        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()

        os.unlink(tmp_path)

        if len(audio_bytes) < 100:
            return None

        return base64.b64encode(audio_bytes).decode("ascii")
    except ImportError:
        return None
    except Exception as e:
        print(f"edge-tts异常: {e}")
        return None


async def _try_macos_say(text: str) -> str | None:
    """macOS系统TTS — 离线可用。"""
    try:
        with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
            tmp_path = f.name

        proc = await asyncio.create_subprocess_exec(
            "say", "-v", "Ting-Ting", "-o", tmp_path, text,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.wait(), timeout=10)

        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()

        os.unlink(tmp_path)

        if len(audio_bytes) < 100:
            return None

        return base64.b64encode(audio_bytes).decode("ascii")
    except Exception as e:
        print(f"macOS say异常: {e}")
        return None
