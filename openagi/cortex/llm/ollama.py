"""Ollama 本地模型客户端 — 小星永生支柱4。

让小星断网也能对话。Ollama是本地LLM的壳，
用户自选模型（qwen2.5:3b/llama3.2/phi-4等），
无需API密钥，完全免费，隐私安全。

集成方式：HTTP API (localhost:11434)
"""

from __future__ import annotations

import os
from typing import Optional

import httpx

OLLAMA_BASE = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")

# 推荐的本地模型（中文能力排序）
RECOMMENDED_MODELS = [
    {"id": "qwen2.5:3b", "name": "通义千问2.5 3B", "size": "2.0GB", "lang": "中文最优", "speed": "快"},
    {"id": "qwen2.5:7b", "name": "通义千问2.5 7B", "size": "4.7GB", "lang": "中文优秀", "speed": "中"},
    {"id": "llama3.2:3b", "name": "Llama 3.2 3B", "size": "2.0GB", "lang": "英文为主", "speed": "快"},
    {"id": "phi-4-mini", "name": "Phi-4 Mini", "size": "2.2GB", "lang": "多语言", "speed": "快"},
    {"id": "gemma2:2b", "name": "Gemma 2 2B", "size": "1.6GB", "lang": "多语言", "speed": "极快"},
    {"id": "deepseek-r1:7b", "name": "DeepSeek R1 7B", "size": "4.7GB", "lang": "中文优秀+推理", "speed": "慢"},
]


class OllamaClient:
    """Ollama 本地模型客户端。"""

    def __init__(self, base_url: str = OLLAMA_BASE, model: str = DEFAULT_MODEL):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=60.0)

    async def is_available(self) -> bool:
        """检查Ollama服务是否运行。"""
        try:
            resp = await self._client.get("/api/version")
            return resp.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[dict]:
        """列出已下载的模型。"""
        try:
            resp = await self._client.get("/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {
                        "name": m.get("name", ""),
                        "size": m.get("size", 0),
                        "modified": m.get("modified_at", ""),
                    }
                    for m in data.get("models", [])
                ]
            return []
        except Exception:
            return []

    async def chat(
        self,
        message: str,
        system_prompt: str = "",
        model: Optional[str] = None,
        max_tokens: int = 1024,
    ) -> dict:
        """发送对话请求。"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": message})

        body = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.7,
            },
        }

        try:
            resp = await self._client.post("/api/chat", json=body)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("message", {}).get("content", "")
                return {
                    "content": content,
                    "model": model or self.model,
                    "tokens": {
                        "input": data.get("prompt_eval_count", 0),
                        "output": data.get("eval_count", 0),
                    },
                    "source": "ollama-local",
                }
            return {"content": f"Ollama错误: HTTP {resp.status_code}", "model": model or self.model, "tokens": {"input": 0, "output": 0}, "source": "ollama-local"}
        except httpx.ConnectError:
            return {"content": "Ollama服务未运行。请执行: ollama serve", "model": "", "tokens": {"input": 0, "output": 0}, "source": "ollama-local"}
        except Exception as e:
            return {"content": f"Ollama异常: {e}", "model": "", "tokens": {"input": 0, "output": 0}, "source": "ollama-local"}

    async def pull_model(self, model_name: str) -> bool:
        """下载模型（流式进度）。"""
        try:
            resp = await self._client.post(
                "/api/pull",
                json={"name": model_name, "stream": False},
                timeout=600.0,  # 下载可能需要很久
            )
            return resp.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self._client.aclose()


# 全局单例
_ollama_client: Optional[OllamaClient] = None


def get_ollama() -> OllamaClient:
    """获取全局Ollama客户端。"""
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = OllamaClient()
    return _ollama_client
