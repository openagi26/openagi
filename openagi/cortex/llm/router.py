"""
LLM多模型路由器 — OpenAGI Layer 1 大脑层
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
管理多个LLM模型和中转站，实现主模型+回退链的故障转移。

核心功能：
  · 中转站管理（添加/测试/发现可用模型）
  · 可用模型列表（主模型+回退①②...）
  · API池故障转移（指数退避重试）
  · 本地Claude自动识别
  · 并行测试模型可用性和连接速率
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import StrEnum

import litellm

logger = logging.getLogger("openagi.llm")


# ─── 数据结构 ───────────────────────────────────────────────────────────────

class ModelRole(StrEnum):
    PRIMARY = "primary"
    FALLBACK = "fallback"
    AVAILABLE = "available"


@dataclass
class RelayStation:
    """中转站配置（持久化保存，刷新不丢失）。"""

    id: str
    name: str  # 备注名称（如"OpenRouter"、"OneAPI自建站"）
    base_url: str
    api_key: str  # 存储时加密，显示时只显示后2位
    enabled: bool = True
    last_tested: str | None = None
    models_discovered: list[str] = field(default_factory=list)

    @property
    def key_suffix(self) -> str:
        """密钥后2位，用于UI显示区分。"""
        return f"••{self.api_key[-2:]}" if len(self.api_key) >= 2 else "••••"


@dataclass
class ModelEntry:
    """可用模型条目。"""

    model_id: str  # litellm模型ID
    provider: str  # 提供商名称（Anthropic/OpenAI/DeepSeek等）
    relay_name: str  # 中转站名称（"本地自动识别"/"OpenRouter"等）
    key_suffix: str  # 密钥后2位
    role: ModelRole = ModelRole.AVAILABLE
    fallback_order: int = 0  # 回退优先级（1=回退①, 2=回退②...）
    latency_ms: float = 0  # 最近测试的延迟
    is_available: bool = True
    is_local: bool = False  # 是否本地自动识别的模型
    last_tested: str | None = None
    consecutive_failures: int = 0


@dataclass
class TestResult:
    """模型测试结果。"""

    model_id: str
    relay_name: str
    available: bool
    latency_ms: float
    error: str | None = None


# ─── LLM路由器 ──────────────────────────────────────────────────────────────

class LLMRouter:
    """
    多模型路由器。

    管理中转站和可用模型列表，提供：
    - 中转站添加/删除/测试
    - 模型发现和可用性测试
    - 主模型+回退链的智能切换
    - 指数退避重试
    - 本地Claude自动识别
    """

    def __init__(self, max_retries: int = 3, base_backoff: float = 2.0):
        self._relays: list[RelayStation] = []
        self._models: list[ModelEntry] = []
        self._max_retries = max_retries
        self._base_backoff = base_backoff

    # ── 中转站管理 ──────────────────────────────────────────────────────────

    def add_relay(self, name: str, base_url: str, api_key: str) -> RelayStation:
        """添加中转站。"""
        relay = RelayStation(
            id=f"relay_{len(self._relays)}",
            name=name,
            base_url=base_url.rstrip("/"),
            api_key=api_key,
        )
        self._relays.append(relay)
        logger.info(f"添加中转站: {name} ({base_url})")
        return relay

    def remove_relay(self, relay_id: str) -> bool:
        """删除中转站及其关联模型。"""
        self._relays = [r for r in self._relays if r.id != relay_id]
        self._models = [m for m in self._models if m.relay_name != relay_id]
        return True

    def list_relays(self) -> list[RelayStation]:
        """获取所有中转站。"""
        return list(self._relays)

    # ── 模型发现与测试 ──────────────────────────────────────────────────────

    async def test_model(self, model_id: str, relay: RelayStation) -> TestResult:
        """测试单个模型的可用性和延迟。"""
        start = time.monotonic()
        try:
            response = await litellm.acompletion(
                model=model_id,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=5,
                timeout=15,
                api_base=relay.base_url,
                api_key=relay.api_key,
            )
            latency = (time.monotonic() - start) * 1000
            return TestResult(
                model_id=model_id,
                relay_name=relay.name,
                available=True,
                latency_ms=round(latency),
            )
        except Exception as e:
            latency = (time.monotonic() - start) * 1000
            return TestResult(
                model_id=model_id,
                relay_name=relay.name,
                available=False,
                latency_ms=round(latency),
                error=str(e)[:100],
            )

    async def discover_models(self, relay: RelayStation) -> list[TestResult]:
        """
        自动发现中转站的可用模型。
        尝试常见模型列表，并行测试。
        """
        common_models = [
            "claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001",
            "gpt-4o", "gpt-4o-mini",
            "deepseek-chat", "deepseek-reasoner",
            "gemini-2.0-flash",
        ]

        tasks = [self.test_model(m, relay) for m in common_models]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        valid_results = []
        for r in results:
            if isinstance(r, TestResult):
                valid_results.append(r)
                if r.available:
                    self._add_discovered_model(r, relay)

        return valid_results

    async def test_selected_models(self, model_ids: list[str] | None = None) -> list[TestResult]:
        """并行测试选中的模型（或全部模型）。"""
        targets = self._models if model_ids is None else [m for m in self._models if m.model_id in model_ids]

        async def _test_one(entry: ModelEntry) -> TestResult:
            relay = next((r for r in self._relays if r.name == entry.relay_name), None)
            if not relay and not entry.is_local:
                return TestResult(model_id=entry.model_id, relay_name=entry.relay_name, available=False, latency_ms=0, error="中转站不存在")

            if entry.is_local:
                return TestResult(model_id=entry.model_id, relay_name="本地", available=True, latency_ms=0)

            return await self.test_model(entry.model_id, relay)

        tasks = [_test_one(m) for m in targets]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for r in results:
            if isinstance(r, TestResult):
                entry = next((m for m in self._models if m.model_id == r.model_id and m.relay_name == r.relay_name), None)
                if entry:
                    entry.is_available = r.available
                    entry.latency_ms = r.latency_ms

        return [r for r in results if isinstance(r, TestResult)]

    def _add_discovered_model(self, result: TestResult, relay: RelayStation) -> None:
        """将发现的可用模型添加到列表。"""
        exists = any(m.model_id == result.model_id and m.relay_name == relay.name for m in self._models)
        if not exists:
            provider = self._guess_provider(result.model_id)
            self._models.append(ModelEntry(
                model_id=result.model_id,
                provider=provider,
                relay_name=relay.name,
                key_suffix=relay.key_suffix,
                latency_ms=result.latency_ms,
                is_available=True,
            ))

    # ── 模型角色管理 ────────────────────────────────────────────────────────

    def set_primary(self, model_id: str, relay_name: str) -> bool:
        """设为主模型（取消当前主模型）。"""
        for m in self._models:
            if m.role == ModelRole.PRIMARY:
                m.role = ModelRole.AVAILABLE
        target = self._find_model(model_id, relay_name)
        if target:
            target.role = ModelRole.PRIMARY
            return True
        return False

    def set_fallback(self, model_id: str, relay_name: str, order: int = 0) -> bool:
        """设为回退模型。order=0自动分配下一个序号。"""
        target = self._find_model(model_id, relay_name)
        if not target:
            return False
        if order == 0:
            existing_orders = [m.fallback_order for m in self._models if m.role == ModelRole.FALLBACK]
            order = max(existing_orders, default=0) + 1
        target.role = ModelRole.FALLBACK
        target.fallback_order = order
        return True

    def remove_model(self, model_id: str, relay_name: str) -> bool:
        """从列表中删除模型。"""
        self._models = [m for m in self._models if not (m.model_id == model_id and m.relay_name == relay_name)]
        return True

    def list_models(self) -> list[ModelEntry]:
        """获取排序后的模型列表：主模型→回退①②→其他。"""
        primary = [m for m in self._models if m.role == ModelRole.PRIMARY]
        fallbacks = sorted([m for m in self._models if m.role == ModelRole.FALLBACK], key=lambda m: m.fallback_order)
        others = [m for m in self._models if m.role == ModelRole.AVAILABLE]
        return primary + fallbacks + others

    def get_primary(self) -> ModelEntry | None:
        """获取当前主模型。"""
        return next((m for m in self._models if m.role == ModelRole.PRIMARY), None)

    def get_fallback_chain(self) -> list[ModelEntry]:
        """获取回退链（按优先级排序）。"""
        return sorted([m for m in self._models if m.role == ModelRole.FALLBACK], key=lambda m: m.fallback_order)

    # ── 智能调用（含故障转移） ──────────────────────────────────────────────

    async def call(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs,
    ) -> dict:
        """
        智能LLM调用，自动故障转移。

        流程：主模型 → 回退① → 回退② → ... → 抛出异常
        每个模型最多重试max_retries次，指数退避。
        """
        chain = []
        primary = self.get_primary()
        if primary and primary.is_available:
            chain.append(primary)
        chain.extend(self.get_fallback_chain())

        if not chain:
            raise LLMError("没有可用的模型，请先配置中转站并设置主模型。")

        last_error = None
        for model_entry in chain:
            relay = next((r for r in self._relays if r.name == model_entry.relay_name), None)

            for attempt in range(self._max_retries):
                try:
                    call_kwargs = {
                        "model": model_entry.model_id,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "timeout": 30,
                        **kwargs,
                    }
                    if relay and not model_entry.is_local:
                        call_kwargs["api_base"] = relay.base_url
                        call_kwargs["api_key"] = relay.api_key

                    response = await litellm.acompletion(**call_kwargs)
                    model_entry.consecutive_failures = 0
                    return {
                        "content": response.choices[0].message.content,
                        "model": model_entry.model_id,
                        "relay": model_entry.relay_name,
                        "tokens": {
                            "input": response.usage.prompt_tokens or 0,
                            "output": response.usage.completion_tokens or 0,
                        },
                    }
                except Exception as e:
                    last_error = e
                    model_entry.consecutive_failures += 1
                    backoff = self._base_backoff * (2 ** attempt)
                    logger.warning(
                        f"模型 {model_entry.model_id}({model_entry.relay_name}) "
                        f"第{attempt+1}次失败: {e}，{backoff}秒后重试"
                    )
                    if attempt < self._max_retries - 1:
                        await asyncio.sleep(backoff)

            logger.error(f"模型 {model_entry.model_id} 连续{self._max_retries}次失败，切换到下一个回退模型")

        raise LLMError(f"所有模型均不可用，最后错误: {last_error}")

    # ── 本地Claude自动识别 ──────────────────────────────────────────────────

    def detect_local_claude(self) -> list[ModelEntry]:
        """
        自动检测本机安装的Claude Code，添加其可用模型。
        检测路径：/opt/homebrew/bin/claude 或 which claude
        """
        import shutil
        import json
        from pathlib import Path

        claude_path = shutil.which("claude")
        if not claude_path:
            return []

        # 读取版本信息
        pkg_json = Path("/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/package.json")
        version = "unknown"
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text())
                version = data.get("version", "unknown")
            except Exception:
                pass

        # 检查认证状态
        auth_dir = Path.home() / ".claude"
        if not auth_dir.exists():
            logger.info("Claude Code已安装但未登录")
            return []

        # 添加三个模型
        local_models = [
            ("claude-opus-4-6", "Claude Opus 4.6"),
            ("claude-sonnet-4-6", "Claude Sonnet 4.6"),
            ("claude-haiku-4-5-20251001", "Claude Haiku 4.5"),
        ]

        added = []
        for model_id, display_name in local_models:
            exists = any(m.model_id == model_id and m.is_local for m in self._models)
            if not exists:
                entry = ModelEntry(
                    model_id=model_id,
                    provider="Anthropic",
                    relay_name=f"本地 Claude Code v{version}",
                    key_suffix="免API",
                    is_local=True,
                    is_available=True,
                    latency_ms=0,
                )
                self._models.append(entry)
                added.append(entry)

        if added:
            logger.info(f"自动识别到本机 Claude Code v{version}，添加{len(added)}个模型")

        return added

    # ── 内部工具 ────────────────────────────────────────────────────────────

    def _find_model(self, model_id: str, relay_name: str) -> ModelEntry | None:
        return next((m for m in self._models if m.model_id == model_id and m.relay_name == relay_name), None)

    @staticmethod
    def _guess_provider(model_id: str) -> str:
        """根据模型ID猜测提供商。"""
        if "claude" in model_id:
            return "Anthropic"
        if "gpt" in model_id:
            return "OpenAI"
        if "deepseek" in model_id:
            return "DeepSeek"
        if "gemini" in model_id:
            return "Google"
        if "qwen" in model_id:
            return "Alibaba"
        if "llama" in model_id:
            return "Meta"
        return "Unknown"


class LLMError(Exception):
    """LLM调用相关异常。"""
