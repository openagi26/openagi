"""语音转文字(STT) API路由。

支持多种转写后端：
1. OpenAI Whisper API（兼容智谱/DeepSeek等）
2. 本地 whisper 命令行
3. 基于描述的LLM转写（兜底方案）
"""

from __future__ import annotations

import base64
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/stt", tags=["语音转文字"])


@router.post("/transcribe")
async def transcribe_audio(payload: dict):
    """语音转文字。

    接收 base64 编码的音频数据，返回转写文本。
    """
    audio_b64 = payload.get("audio_base64", "")
    audio_format = payload.get("format", "webm")

    if not audio_b64:
        return {"success": False, "error": "缺少音频数据"}

    # 解码音频
    try:
        audio_bytes = base64.b64decode(audio_b64)
    except Exception as e:
        return {"success": False, "error": f"音频解码失败: {e}"}

    if len(audio_bytes) < 100:
        return {"success": True, "data": {"text": ""}}

    # 保存到临时文件
    suffix = f".{audio_format}" if audio_format else ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        audio_path = f.name

    try:
        # 策略0（最优）: 本地 Whisper Python 模型
        text = await _try_whisper_python(audio_path)
        if text:
            return {"success": True, "data": {"text": text}}

        # 策略1: 尝试 OpenAI 兼容的 Whisper API
        text = await _try_openai_whisper(audio_path)
        if text:
            return {"success": True, "data": {"text": text}}

        # 策略2: 尝试本地 whisper 命令行
        text = await _try_local_whisper(audio_path)
        if text:
            return {"success": True, "data": {"text": text}}

        # 策略3: 尝试 macOS 原生转写
        text = await _try_macos_stt(audio_path)
        if text:
            return {"success": True, "data": {"text": text}}

        return {"success": False, "error": "无可用的语音转写服务。请安装 whisper: pip install openai-whisper"}
    finally:
        # 清理临时文件
        try:
            os.unlink(audio_path)
        except OSError:
            pass


_whisper_model = None  # 缓存模型，避免每次加载

# 常用繁→简映射（覆盖Whisper最常见的繁体输出）
_T2S_MAP = str.maketrans(
    "謝請個鐘體開關點擊認識歡記時間問題號碼選項設備語電話機書寫這麼說話學習創還從進運動認來過對應該當範圍網關報導導經濟繼續維護區業務員會議決調試驗發現場準備複雜環響應處組織構給輕鬆實際數據總結頭腦風標準備記錄類別選擇鍵盤節點質測頻導鏈記憶斷開單獨參與觀察禮貌義務聯繫統計劃動態圖標題項顯視圖層監歷與東優書傳網車輪農鳥魚長門間馬風飛齊齒龍樂電雲點鏡對鐘項針壓壞塊塵場獎備設試語説諸課費購貨質車軟進鄰選郵釣釋錢鋼鑰門開閱關隊際隱雞點麵",
    "谢请个钟体开关点击认识欢记时间问题号码选项设备语电话机书写这么说话学习创还从进运动认来过对应该当范围网关报导导经济继续维护区业务员会议决调试验发现场准备复杂环响应处组织构给轻松实际数据总结头脑风标准备记录类别选择键盘节点质测频导链记忆断开单独参与观察礼貌义务联系统计划动态图标题项显视图层监历与东优书传网车轮农鸟鱼长门间马风飞齐齿龙乐电云点镜对钟项针压坏块尘场奖备设试语说诸课费购货质车软进邻选邮钓释钱钢钥门开阅关队际隐鸡点面",
)


def _to_simplified(text: str) -> str:
    """繁体中文→简体中文（轻量映射，无外部依赖）。"""
    return text.translate(_T2S_MAP)


async def _try_whisper_python(audio_path: str) -> str | None:
    """本地 Whisper Python 模型（最优方案，首次加载后缓存）。"""
    import asyncio

    def _transcribe():
        global _whisper_model
        try:
            import whisper

            # 首次加载模型（small模型中文效果优秀，比base准确率高40%）
            if _whisper_model is None:
                _whisper_model = whisper.load_model("small")

            result = _whisper_model.transcribe(
                audio_path,
                language="zh",
                fp16=False,  # M4 Apple Silicon 兼容
                initial_prompt="以下是简体中文对话。",  # 强制简体中文
            )
            text = result.get("text", "").strip()
            # 繁体→简体转换
            text = _to_simplified(text)
            return text
        except ImportError:
            return None
        except Exception as e:
            print(f"Whisper转写异常: {e}")
            return None

    # 在线程池运行（避免阻塞事件循环）
    return await asyncio.get_event_loop().run_in_executor(None, _transcribe)


async def _try_openai_whisper(audio_path: str) -> str | None:
    """尝试 OpenAI 兼容的 Whisper API（支持智谱/DeepSeek等中转站）。"""
    try:
        from openai import AsyncOpenAI

        # 读取环境变量中的 API 配置
        api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("LLM_API_KEY", "")
        base_url = os.environ.get("OPENAI_BASE_URL") or os.environ.get("LLM_BASE_URL", "")

        if not api_key:
            return None

        client = AsyncOpenAI(api_key=api_key, base_url=base_url or None)

        with open(audio_path, "rb") as f:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language="zh",
            )
        return transcript.text if transcript else None
    except Exception:
        return None


async def _try_local_whisper(audio_path: str) -> str | None:
    """尝试本地 whisper 命令行工具。"""
    import asyncio
    import shutil

    whisper_bin = shutil.which("whisper")
    if not whisper_bin:
        return None

    try:
        proc = await asyncio.create_subprocess_exec(
            whisper_bin, audio_path,
            "--model", "base",
            "--language", "zh",
            "--output_format", "txt",
            "--output_dir", str(Path(audio_path).parent),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.wait(), timeout=30)

        # whisper 输出 .txt 文件
        txt_path = Path(audio_path).with_suffix(".txt")
        if txt_path.exists():
            text = txt_path.read_text(encoding="utf-8").strip()
            txt_path.unlink(missing_ok=True)
            return text
        return None
    except Exception:
        return None


async def _try_macos_stt(audio_path: str) -> str | None:
    """macOS 原生语音识别（通过 Python SpeechRecognition 库）。"""
    try:
        import speech_recognition as sr

        recognizer = sr.Recognizer()
        # 先用 ffmpeg 转换为 wav（如果需要）
        wav_path = audio_path
        if not audio_path.endswith(".wav"):
            import subprocess
            wav_path = audio_path + ".wav"
            result = subprocess.run(
                ["ffmpeg", "-i", audio_path, "-ar", "16000", "-ac", "1", wav_path, "-y"],
                capture_output=True, timeout=10,
            )
            if result.returncode != 0:
                return None

        with sr.AudioFile(wav_path) as source:
            audio = recognizer.record(source)

        text = recognizer.recognize_google(audio, language="zh-CN")
        return text
    except Exception:
        return None
