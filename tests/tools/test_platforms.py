"""
tests/tools/test_platforms.py — 平台搜索工具测试

注意：网络请求测试标记为 slow，CI 环境下可跳过。
单元测试侧重注册逻辑、数据格式和降级处理。
"""

from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO

from openagi.tools.browser.platforms import (
    _strip_html,
    _parse_search_results,
    _http_get,
    browse,
    extract_text,
    register_platform_tools,
    google_search,
    github_search,
    wikipedia_search,
    hacker_news_search,
    npm_search,
)
from openagi.tools.registry import ToolRegistry


# ─── _strip_html 测试 ────────────────────────────────────────────────────────

def test_strip_html_basic():
    """基本 HTML 标签剥离。"""
    result = _strip_html("<h1>标题</h1><p>内容</p>")
    assert "标题" in result
    assert "内容" in result
    assert "<h1>" not in result
    assert "<p>" not in result


def test_strip_html_removes_script():
    """<script> 内容应被完全移除。"""
    html = "<div>正文</div><script>alert('xss')</script>"
    result = _strip_html(html)
    assert "正文" in result
    assert "alert" not in result
    assert "xss" not in result


def test_strip_html_removes_style():
    """<style> 内容应被完全移除。"""
    html = "<style>.cls{color:red}</style><p>内容</p>"
    result = _strip_html(html)
    assert "内容" in result
    assert "color" not in result


def test_strip_html_empty_string():
    assert _strip_html("") == ""


def test_strip_html_truncation():
    """超长内容应被截断。"""
    long_html = "<p>" + "A" * 20000 + "</p>"
    result = _strip_html(long_html)
    assert len(result) <= 5100  # MAX_CONTENT + 少量余量


# ─── _parse_search_results 测试 ──────────────────────────────────────────────

def test_parse_search_results_basic():
    """能从 HTML 中提取带标题和链接的搜索结果。"""
    html = '''
    <a href="https://example.com/page1">这是一个搜索结果标题</a>
    <a href="https://example.com/page2">另一个搜索结果非常好</a>
    <a href="javascript:void(0)">无效链接</a>
    '''
    results = _parse_search_results(html)
    urls = [r["url"] for r in results]
    assert "https://example.com/page1" in urls
    assert "https://example.com/page2" in urls
    # 无效链接不应出现
    assert not any("javascript" in u for u in urls)


def test_parse_search_results_max_10():
    """最多返回 10 条结果。"""
    links = "\n".join(
        f'<a href="https://example{i}.com/page">标题{'A' * 10}{i}内容</a>'
        for i in range(20)
    )
    results = _parse_search_results(links)
    assert len(results) <= 10


def test_parse_search_results_empty():
    """无有效链接时返回空列表。"""
    results = _parse_search_results("<html><body>没有链接</body></html>")
    assert results == []


# ─── _http_get 测试（Mock）───────────────────────────────────────────────────

def test_http_get_failure_returns_empty():
    """网络错误时应返回空字符串，不抛出异常。"""
    with patch("openagi.tools.browser.platforms.urlopen", side_effect=Exception("网络错误")):
        result = _http_get("https://example.com")
    assert result == ""


def _mock_urlopen(url, timeout=None):
    """Mock urlopen 返回固定 HTML。"""
    mock_resp = MagicMock()
    mock_resp.read.return_value = b"<html><body>Mock Response</body></html>"
    mock_resp.headers.get_content_charset.return_value = "utf-8"
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)
    return mock_resp


def test_http_get_success():
    """成功时应返回响应文本。"""
    with patch("openagi.tools.browser.platforms.urlopen", side_effect=_mock_urlopen):
        result = _http_get("https://example.com")
    assert "Mock Response" in result


# ─── browse 测试 ─────────────────────────────────────────────────────────────

def test_browse_failure():
    """HTTP 失败时 browse 应返回含 error 的字典，不抛出异常。"""
    with patch("openagi.tools.browser.platforms._http_get", return_value=""):
        result = browse("https://nonexistent.example.com")
    assert "error" in result
    assert result["url"] == "https://nonexistent.example.com"


def test_browse_success():
    """成功时应包含 url/title/text 字段。"""
    mock_html = "<html><head><title>测试标题</title></head><body>正文内容</body></html>"
    with patch("openagi.tools.browser.platforms._http_get", return_value=mock_html):
        result = browse("https://example.com")
    assert result["url"] == "https://example.com"
    assert "测试标题" in result["title"]
    assert "正文内容" in result["text"]


# ─── extract_text 测试 ───────────────────────────────────────────────────────

def test_extract_text_failure():
    """HTTP 失败时应返回错误字符串，不抛出异常。"""
    with patch("openagi.tools.browser.platforms._http_get", return_value=""):
        result = extract_text("https://nonexistent.example.com")
    assert "错误" in result or "无法" in result


def test_extract_text_success():
    """成功时应返回纯文本。"""
    mock_html = "<html><body><p>这是纯文本内容</p></body></html>"
    with patch("openagi.tools.browser.platforms._http_get", return_value=mock_html):
        result = extract_text("https://example.com")
    assert "这是纯文本内容" in result
    assert "<" not in result


# ─── register_platform_tools 测试 ────────────────────────────────────────────

def test_register_platform_tools():
    """注册后 ToolRegistry 应包含 36+ 个平台工具。"""
    registry = ToolRegistry()
    register_platform_tools(registry)
    tools = registry.list_all()
    assert len(tools) >= 36


def test_registered_tools_have_correct_category():
    """所有注册的平台工具分类应为'网络访问'。"""
    registry = ToolRegistry()
    register_platform_tools(registry)
    for tool in registry.list_all():
        assert tool.category == "网络访问", f"工具 {tool.name} 分类不正确"


def test_registered_tools_have_permission_l1():
    """所有平台工具权限级别应为 L1。"""
    registry = ToolRegistry()
    register_platform_tools(registry)
    for tool in registry.list_all():
        assert tool.permission_level == "L1", f"工具 {tool.name} 权限级别不正确"


def test_all_tools_have_handlers():
    """所有注册工具都应有 handler（处理器）。"""
    registry = ToolRegistry()
    register_platform_tools(registry)
    for tool in registry.list_all():
        assert tool.handler is not None, f"工具 {tool.name} 缺少 handler"


def test_specific_tools_registered():
    """关键平台工具应被注册。"""
    registry = ToolRegistry()
    register_platform_tools(registry)
    names = {t.name for t in registry.list_all()}
    required = {
        "google_search", "baidu_search", "github_search",
        "browse", "extract_text", "wikipedia_search",
        "hacker_news_search", "npm_search",
    }
    for name in required:
        assert name in names, f"缺少工具: {name}"


# ─── github_search API 测试（Mock）──────────────────────────────────────────

def test_github_search_api_success():
    """GitHub API（接口）成功响应时应返回结构化结果列表。"""
    import json as _json
    mock_data = {
        "items": [
            {
                "full_name":          "openai/openai-python",
                "html_url":           "https://github.com/openai/openai-python",
                "description":        "OpenAI Python SDK（开发工具包）",
                "stargazers_count":   10000,
                "language":           "Python",
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = _json.dumps(mock_data).encode()
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("openagi.tools.browser.platforms.urlopen", return_value=mock_resp):
        results = github_search("openai python")

    assert len(results) == 1
    assert results[0]["title"] == "openai/openai-python"
    assert results[0]["stars"] == 10000
    assert results[0]["language"] == "Python"


def test_github_search_api_failure():
    """GitHub API 失败时应返回含 error 的列表，不抛出异常。"""
    with patch("openagi.tools.browser.platforms.urlopen", side_effect=Exception("网络超时")):
        results = github_search("test query")
    assert isinstance(results, list)
    assert len(results) == 1
    assert "error" in results[0]


def test_github_search_invalid_type():
    """传入无效 search_type 时应降级为 repositories。"""
    mock_data = {"items": []}
    mock_resp = MagicMock()
    mock_resp.read.return_value = json_encode(mock_data)
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    import json as _json
    with patch("openagi.tools.browser.platforms.urlopen", return_value=mock_resp):
        results = github_search("test", search_type="invalid_type")
    assert isinstance(results, list)


def json_encode(data) -> bytes:
    import json as _json
    return _json.dumps(data).encode()


# ─── hacker_news_search 测试（Mock）─────────────────────────────────────────

def test_hacker_news_search_success():
    """Hacker News Algolia API（接口）成功时应正确解析结果。"""
    mock_data = {
        "hits": [
            {
                "title":      "Show HN: OpenAGI Framework",
                "url":        "https://github.com/example/openagi",
                "objectID":   "12345",
                "story_text": "",
                "points":     500,
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json_encode(mock_data)
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("openagi.tools.browser.platforms.urlopen", return_value=mock_resp):
        results = hacker_news_search("openagi")

    assert len(results) == 1
    assert results[0]["title"] == "Show HN: OpenAGI Framework"
    assert results[0]["points"] == 500


# ─── wikipedia_search 测试（Mock）────────────────────────────────────────────

def test_wikipedia_search_success():
    """维基百科 API 成功时应返回含 url 的结果。"""
    mock_data = {
        "query": {
            "search": [
                {"title": "人工智能", "snippet": "人工智能是计算机科学的分支"}
            ]
        }
    }
    mock_resp = MagicMock()
    mock_resp.read.return_value = json_encode(mock_data)
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)

    with patch("openagi.tools.browser.platforms.urlopen", return_value=mock_resp):
        results = wikipedia_search("人工智能", lang="zh")

    assert len(results) == 1
    assert results[0]["title"] == "人工智能"
    assert "zh.wikipedia.org" in results[0]["url"]


async def test_registry_execute_google_search():
    """通过 ToolRegistry 执行 google_search，Mock 网络。"""
    registry = ToolRegistry()
    register_platform_tools(registry)

    with patch("openagi.tools.browser.platforms._http_get", return_value=""):
        result = await registry.execute("google_search", {"query": "openagi"})
    # 即使网络失败也应返回成功执行（函数本身不抛异常）
    assert result.tool_name == "google_search"
    assert result.success is True  # 函数返回了列表，工具执行本身成功
