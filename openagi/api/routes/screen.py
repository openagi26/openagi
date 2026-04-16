"""屏幕分析API路由 — 小星的眼睛。

接收屏幕截图，用多模态LLM分析内容，返回场景描述。
"""

from __future__ import annotations

import base64
import os

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/screen", tags=["屏幕感知"])


@router.post("/analyze")
async def analyze_screen(payload: dict):
    """分析屏幕截图，返回用户正在做什么。"""
    image_b64 = payload.get("image_base64", "")

    if not image_b64 or len(image_b64) < 100:
        return {"success": False, "error": "缺少截图数据"}

    # 尝试用多模态LLM分析
    analysis = await _analyze_with_llm(image_b64)

    if analysis:
        return {"success": True, "data": {"analysis": analysis}}

    return {"success": False, "error": "无可用的视觉分析模型"}


async def _analyze_with_llm(image_b64: str) -> str | None:
    """用多模态LLM分析截图。

    优先使用配置的视觉模型，降级到文字描述。
    """
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

        # 尝试视觉模型（支持图片输入的模型）
        vision_model = os.environ.get("VISION_MODEL", "glm-4v-flash")

        response = await client.chat.completions.create(
            model=vision_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是小星的视觉系统。分析屏幕截图，简洁描述用户正在做什么。"
                        "只输出1-2句话，包含：1)用户在用什么软件 2)在做什么具体操作。"
                        "如果看到错误/报警，特别指出。如果是英文界面，说明。"
                        "用中文回答。"
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "分析这个屏幕截图，用户在做什么？"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_b64[:50000]}",
                            },
                        },
                    ],
                },
            ],
            max_tokens=200,
            timeout=15,
        )

        if response.choices:
            return response.choices[0].message.content
        return None

    except Exception as e:
        print(f"视觉分析异常: {e}")
        return None
