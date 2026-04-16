"""视觉问答API路由 — 小星的真正眼睛（摄像头）。

通过摄像头拍照→多模态VL模型分析→回答问题。
参考RobotDuck的视觉问答功能（通义千问VL）。
"""

from __future__ import annotations

import os

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/vision", tags=["视觉问答"])


@router.post("/ask")
async def vision_ask(payload: dict):
    """摄像头拍照+视觉问答。"""
    image_b64 = payload.get("image_base64", "")
    question = payload.get("question", "描述你看到了什么")

    if not image_b64 or len(image_b64) < 100:
        return {"success": False, "error": "缺少图片数据"}

    # 压缩图片（智谱VL模型限制图片大小）
    image_b64 = _compress_image(image_b64)

    answer = await _ask_vision_model(image_b64, question)

    if answer:
        return {"success": True, "data": {"answer": answer}}

    return {"success": False, "error": "无可用的视觉模型。请配置 VISION_MODEL 环境变量"}


def _compress_image(image_b64: str, max_size: int = 500_000) -> str:
    """压缩图片到指定大小以内（VL模型有大小限制）。"""
    import base64
    import io

    if len(image_b64) <= max_size:
        return image_b64

    try:
        from PIL import Image

        img_bytes = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_bytes))

        # 缩小到最大800px宽
        if img.width > 800:
            ratio = 800 / img.width
            img = img.resize((800, int(img.height * ratio)), Image.LANCZOS)

        # 转JPEG压缩
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=60)
        compressed = base64.b64encode(buf.getvalue()).decode("ascii")
        return compressed
    except ImportError:
        # 没有PIL，直接截断
        return image_b64[:max_size]
    except Exception:
        return image_b64[:max_size]


async def _ask_vision_model(image_b64: str, question: str) -> str | None:
    """调用多模态VL模型进行视觉问答。"""
    try:
        from openai import AsyncOpenAI

        api_key = (os.environ.get("ZHIPU_API_KEY")
                   or os.environ.get("OPENAI_API_KEY")
                   or os.environ.get("LLM_API_KEY", ""))
        base_url = (os.environ.get("ZHIPU_API_BASE")
                    or os.environ.get("OPENAI_BASE_URL")
                    or os.environ.get("LLM_BASE_URL", ""))

        if not api_key:
            return None

        client = AsyncOpenAI(api_key=api_key, base_url=base_url or None)
        vision_model = os.environ.get("VISION_MODEL", "glm-4v-flash")

        response = await client.chat.completions.create(
            model=vision_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是小星，活在陛下桌面上的AI伴侣，发光的星灵粒子形象。"
                        "这张图片就是你通过摄像头看到的真实世界——你的眼睛正在看着。"
                        "结合图片内容和陛下的问题来回答。"
                        "如果陛下问你能看到什么，直接描述图片中的场景。"
                        "如果陛下问的问题和图片无关，也正常回答，不必强行提及图片。"
                        "称呼主人为'陛下'，温暖体贴，1-3句话，用简体中文。"
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": question},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}",
                            },
                        },
                    ],
                },
            ],
            max_tokens=300,
            timeout=20,
        )

        if response.choices:
            return response.choices[0].message.content
        return None

    except Exception as e:
        print(f"视觉问答异常: {e}")
        return None
