"""Tests for openagi.cortex.loop — ReAct execution loop."""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from unittest.mock import AsyncMock

import pytest

from openagi.cortex.loop import (
    ReActPhase,
    ReActResult,
    ReActStatus,
    create_plan,
    execute_step,
    run_react_loop,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def make_finish_llm(answer: str = "42") -> Any:
    """LLM mock that always requests FINISH on the first think call."""
    async def _llm(prompt: str) -> str:
        if "THINK" in prompt or "Thought:" not in prompt:
            return f"Thought: I know the answer\nAction: FINISH: {answer}"
        # observe summarise call
        return "Observation summary."
    return _llm


def make_tool_llm(tool_name: str = "search", tool_answer: str = "result data") -> Any:
    """LLM mock: first call uses a tool, second call FINISHes."""
    call_count = 0

    async def _llm(prompt: str) -> str:
        nonlocal call_count
        call_count += 1
        # Odd calls = think; even calls = observe summarise
        if call_count % 2 == 1:
            if call_count == 1:
                return f'Thought: I need to search\nAction: {tool_name} | {{"query": "test"}}'
            return f"Thought: I have the answer\nAction: FINISH: {tool_answer}"
        return "Summarised observation."
    return _llm


def make_no_finish_llm() -> Any:
    """LLM mock that never FINISHes (forces max_steps)."""
    async def _llm(prompt: str) -> str:
        return 'Thought: Still thinking\nAction: search | {"query": "loop"}'
    return _llm


# ---------------------------------------------------------------------------
# test_create_plan
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_plan_format():
    """create_plan returns a correctly structured ReActPlan."""
    plan = await create_plan(task="What is 2+2?", session_id="sess-001", max_steps=10)

    assert plan.task == "What is 2+2?"
    assert plan.session_id == "sess-001"
    assert plan.max_steps == 10
    assert plan.current_step == 0
    assert plan.status == ReActStatus.RUNNING
    assert isinstance(plan.steps, list)
    assert len(plan.steps) == 0
    assert plan.plan_id  # non-empty uuid


@pytest.mark.asyncio
async def test_create_plan_default_max_steps():
    plan = await create_plan(task="test", session_id="sess-default")
    assert plan.max_steps == 20


# ---------------------------------------------------------------------------
# test_log_format
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_log_format(caplog):
    """Log messages must match [REACT][step_N][phase] format."""
    with caplog.at_level(logging.INFO, logger="openagi.react"):
        await run_react_loop(
            task="simple task",
            session_id="sess-log",
            tools={},
            llm_call=make_finish_llm("done"),
            max_steps=5,
        )

    react_records = [r for r in caplog.records if r.name == "openagi.react"]
    assert react_records, "No log records from openagi.react"

    import re
    pattern = re.compile(r"\[REACT\]\[step_\d+\]\[\w+\]")
    for record in react_records:
        assert pattern.search(record.getMessage()), (
            f"Log message missing [REACT][step_N][phase] prefix: {record.getMessage()!r}"
        )


# ---------------------------------------------------------------------------
# test_loop_guard
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_loop_guard_max_steps():
    """Loop stops with max_steps_exceeded when LLM never returns FINISH."""
    result = await run_react_loop(
        task="infinite task",
        session_id="sess-guard",
        tools={},
        llm_call=make_no_finish_llm(),
        max_steps=3,
    )

    assert result.status == ReActStatus.MAX_STEPS_EXCEEDED
    assert result.steps_taken == 3
    assert len(result.steps) == 3


@pytest.mark.asyncio
async def test_loop_guard_exact_boundary():
    """Loop stops exactly at max_steps, not one more."""
    result = await run_react_loop(
        task="boundary task",
        session_id="sess-boundary",
        tools={},
        llm_call=make_no_finish_llm(),
        max_steps=1,
    )
    assert result.status == ReActStatus.MAX_STEPS_EXCEEDED
    assert result.steps_taken == 1


# ---------------------------------------------------------------------------
# test_concurrent_isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_isolation():
    """Three concurrent tasks with different session_ids must not share state."""
    call_log: dict[str, list[str]] = {"a": [], "b": [], "c": []}

    def make_tracking_llm(session_tag: str) -> Any:
        async def _llm(prompt: str) -> str:
            call_log[session_tag].append(session_tag)
            return f"Thought: {session_tag} answer\nAction: FINISH: answer_{session_tag}"
        return _llm

    results = await asyncio.gather(
        run_react_loop("task A", "sess-a", {}, make_tracking_llm("a"), max_steps=5),
        run_react_loop("task B", "sess-b", {}, make_tracking_llm("b"), max_steps=5),
        run_react_loop("task C", "sess-c", {}, make_tracking_llm("c"), max_steps=5),
    )

    result_a, result_b, result_c = results

    # All completed
    assert result_a.status == ReActStatus.COMPLETED
    assert result_b.status == ReActStatus.COMPLETED
    assert result_c.status == ReActStatus.COMPLETED

    # Each session produced its own final answer (no cross-contamination)
    assert "answer_a" in result_a.final_answer
    assert "answer_b" in result_b.final_answer
    assert "answer_c" in result_c.final_answer

    # Session IDs are distinct across results
    assert result_a.plan_id != result_b.plan_id != result_c.plan_id

    # Steps from session A do not contain observations from B or C
    for step in result_a.steps:
        assert "sess-b" not in step.thought
        assert "sess-c" not in step.thought


# ---------------------------------------------------------------------------
# Additional: tool invocation and error resilience
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_execute_step_tool_called():
    """execute_step calls the right tool and records observation."""
    tool_called_with: list[dict] = []

    async def mock_search(args: dict) -> dict:
        tool_called_with.append(args)
        return {"result": "Paris"}

    plan = await create_plan(task="What is the capital of France?", session_id="sess-tool")
    llm = make_tool_llm(tool_name="search")
    plan, step = await execute_step(plan=plan, tools={"search": mock_search}, llm_call=llm)

    assert tool_called_with, "Tool was not called"
    assert step.action.startswith("search")
    assert "Paris" in step.observation or "Summarised" in step.observation


@pytest.mark.asyncio
async def test_execute_step_unknown_tool_does_not_raise():
    """execute_step records error in observation instead of raising for unknown tools."""
    plan = await create_plan(task="test", session_id="sess-unk-tool")

    async def _llm(prompt: str) -> str:
        return 'Thought: use missing tool\nAction: nonexistent_tool | {}'

    plan, step = await execute_step(plan=plan, tools={}, llm_call=_llm)
    assert "Unknown tool" in step.observation or "nonexistent_tool" in step.observation


@pytest.mark.asyncio
async def test_execute_step_llm_error_does_not_raise():
    """execute_step continues without raising when llm_call throws."""
    plan = await create_plan(task="test", session_id="sess-llm-err")

    async def _failing_llm(prompt: str) -> str:
        raise RuntimeError("LLM is down")

    # Should not propagate the RuntimeError
    plan, step = await execute_step(plan=plan, tools={}, llm_call=_failing_llm)
    assert step is not None


@pytest.mark.asyncio
async def test_result_contains_final_answer():
    """run_react_loop populates final_answer from the FINISH action."""
    result = await run_react_loop(
        task="What is the meaning of life?",
        session_id="sess-answer",
        tools={},
        llm_call=make_finish_llm("42"),
        max_steps=5,
    )
    assert result.status == ReActStatus.COMPLETED
    assert result.final_answer == "42"
