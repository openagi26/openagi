"""
tools/browser/platforms.py — 36平台搜索命令集
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
功能：
  · google_search / baidu_search / github_search 等搜索函数
  · browse(url) 获取页面内容
  · extract_text(url) 获取纯文本
  · 所有平台函数注册到 ToolRegistry

实现方式：
  优先使用 CDP（Chrome调试协议）；Chrome 不可用时降级为 urllib HTTP 请求
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from urllib.parse import quote_plus, urljoin
from urllib.request import urlopen, Request
from urllib.error import URLError
from typing import Any

from openagi.tools.registry import ToolRegistry, ToolDefinition

logger = logging.getLogger("openagi.tools.browser.platforms")

# ─── 请求头（模拟浏览器，避免被拒绝）──────────────────────────────────────────

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

MAX_CONTENT = 5000   # 内容截断长度（字符数）
HTTP_TIMEOUT = 15    # HTTP 请求超时（秒）


# ─── 底层 HTTP 工具 ───────────────────────────────────────────────────────────

def _http_get(url: str, timeout: int = HTTP_TIMEOUT) -> str:
    """发送 GET 请求，返回响应文本。失败时返回空字符串。"""
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            encoding = resp.headers.get_content_charset("utf-8")
            return raw.decode(encoding, errors="replace")
    except Exception as e:
        logger.warning(f"HTTP GET 失败 {url}: {e}")
        return ""


def _strip_html(html: str) -> str:
    """简单移除 HTML 标签，返回纯文本。"""
    # 移除 script / style 块
    html = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    # 移除所有标签
    text = re.sub(r"<[^>]+>", " ", html)
    # 合并空白
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_CONTENT]


def _parse_search_results(html: str, base_url: str = "") -> list[dict]:
    """
    从 HTML 中粗粒度提取搜索结果（标题 + URL + 摘要）。
    适用于 Google / Baidu 等结构类似的搜索结果页。
    """
    results = []
    # 提取所有 <a href="..."> 链接
    links = re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, re.DOTALL | re.IGNORECASE)
    seen = set()
    for href, title_raw in links:
        title = _strip_html(title_raw).strip()
        # 过滤无效链接
        if not href.startswith("http") or len(title) < 5 or href in seen:
            continue
        if any(skip in href for skip in ["google.com/search", "baidu.com/s?", "javascript:"]):
            continue
        seen.add(href)
        results.append({"title": title[:120], "url": href, "snippet": ""})
        if len(results) >= 10:
            break
    return results


# ─── 搜索平台实现 ─────────────────────────────────────────────────────────────

def google_search(query: str) -> list[dict]:
    """
    Google 搜索，返回最多 10 条结果（{title, url, snippet}）。
    注意：Google 限制频繁抓取，生产环境建议使用 Custom Search API（自定义搜索接口）。
    """
    url  = f"https://www.google.com/search?q={quote_plus(query)}&hl=zh-CN&num=10"
    html = _http_get(url)
    if not html:
        return [{"error": "Google 搜索请求失败，可能被限流"}]
    results = _parse_search_results(html)
    return results if results else [{"info": "未找到结果", "query": query}]


def baidu_search(query: str) -> list[dict]:
    """百度搜索，返回最多 10 条结果。"""
    url  = f"https://www.baidu.com/s?wd={quote_plus(query)}&rn=10"
    html = _http_get(url)
    if not html:
        return [{"error": "百度搜索请求失败"}]
    results = _parse_search_results(html)
    return results if results else [{"info": "未找到结果", "query": query}]


def github_search(query: str, search_type: str = "repositories") -> list[dict]:
    """
    GitHub 搜索（代码仓库/代码/议题）。
    search_type（搜索类型）: repositories / code / issues / users
    优先使用 GitHub REST API（无需认证，有速率限制）。
    """
    valid_types = {"repositories", "code", "issues", "users", "topics"}
    if search_type not in valid_types:
        search_type = "repositories"

    api_url = f"https://api.github.com/search/{search_type}?q={quote_plus(query)}&per_page=10"
    try:
        req = Request(api_url, headers={
            **_HEADERS,
            "Accept": "application/vnd.github.v3+json",
        })
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        logger.warning(f"GitHub API 请求失败: {e}")
        return [{"error": f"GitHub 搜索失败: {e}"}]

    items = data.get("items", [])
    results = []
    for item in items:
        entry: dict[str, Any] = {
            "title":   item.get("full_name") or item.get("name") or item.get("title", ""),
            "url":     item.get("html_url", ""),
            "snippet": item.get("description") or item.get("body", "")[:200],
        }
        if search_type == "repositories":
            entry["stars"]    = item.get("stargazers_count", 0)
            entry["language"] = item.get("language", "")
        results.append(entry)
    return results if results else [{"info": "未找到结果", "query": query}]


def bing_search(query: str) -> list[dict]:
    """必应（Bing）搜索，返回最多 10 条结果。"""
    url  = f"https://www.bing.com/search?q={quote_plus(query)}&count=10"
    html = _http_get(url)
    if not html:
        return [{"error": "Bing 搜索请求失败"}]
    return _parse_search_results(html) or [{"info": "未找到结果"}]


def duckduckgo_search(query: str) -> list[dict]:
    """DuckDuckGo 搜索（隐私友好）。使用 HTML 版接口。"""
    url  = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
    html = _http_get(url)
    if not html:
        return [{"error": "DuckDuckGo 搜索请求失败"}]
    return _parse_search_results(html) or [{"info": "未找到结果"}]


def arxiv_search(query: str, max_results: int = 10) -> list[dict]:
    """
    arXiv 学术论文搜索（使用官方 API（接口））。
    """
    import xml.etree.ElementTree as ET
    url = (
        f"https://export.arxiv.org/api/query"
        f"?search_query=all:{quote_plus(query)}&max_results={max_results}"
    )
    xml_text = _http_get(url)
    if not xml_text:
        return [{"error": "arXiv API 请求失败"}]
    try:
        root = ET.fromstring(xml_text)
        ns   = {"atom": "http://www.w3.org/2005/Atom"}
        results = []
        for entry in root.findall("atom:entry", ns):
            title   = (entry.findtext("atom:title", "", ns) or "").strip()
            summary = (entry.findtext("atom:summary", "", ns) or "").strip()[:300]
            link    = ""
            for lnk in entry.findall("atom:link", ns):
                if lnk.get("type") == "text/html":
                    link = lnk.get("href", "")
            results.append({"title": title, "url": link, "snippet": summary})
        return results if results else [{"info": "未找到论文", "query": query}]
    except ET.ParseError as e:
        return [{"error": f"arXiv XML 解析失败: {e}"}]


def wikipedia_search(query: str, lang: str = "zh") -> list[dict]:
    """
    维基百科搜索（支持中文/英文等语言版本）。
    lang（语言代码）: zh / en / ja 等
    """
    url = (
        f"https://{lang}.wikipedia.org/w/api.php"
        f"?action=search&list=search&srsearch={quote_plus(query)}&format=json&srlimit=10"
    )
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"维基百科搜索失败: {e}"}]

    hits    = data.get("query", {}).get("search", [])
    results = []
    for hit in hits:
        title = hit.get("title", "")
        results.append({
            "title":   title,
            "url":     f"https://{lang}.wikipedia.org/wiki/{quote_plus(title)}",
            "snippet": re.sub(r"<[^>]+>", "", hit.get("snippet", "")).strip(),
        })
    return results if results else [{"info": "未找到词条", "query": query}]


def stackoverflow_search(query: str) -> list[dict]:
    """Stack Overflow 搜索（技术问题）。"""
    url = (
        f"https://api.stackexchange.com/2.3/search/advanced"
        f"?order=desc&sort=relevance&q={quote_plus(query)}&site=stackoverflow&pagesize=10"
    )
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"Stack Overflow 搜索失败: {e}"}]

    items   = data.get("items", [])
    results = []
    for item in items:
        results.append({
            "title":        item.get("title", ""),
            "url":          item.get("link", ""),
            "snippet":      f"回答数: {item.get('answer_count', 0)}, 得分: {item.get('score', 0)}",
            "is_answered":  item.get("is_answered", False),
        })
    return results if results else [{"info": "未找到结果", "query": query}]


def npm_search(query: str) -> list[dict]:
    """npm 包搜索。"""
    url = f"https://registry.npmjs.org/-/v1/search?text={quote_plus(query)}&size=10"
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"npm 搜索失败: {e}"}]

    objects = data.get("objects", [])
    results = []
    for obj in objects:
        pkg = obj.get("package", {})
        results.append({
            "title":    pkg.get("name", ""),
            "url":      f"https://www.npmjs.com/package/{pkg.get('name', '')}",
            "snippet":  pkg.get("description", ""),
            "version":  pkg.get("version", ""),
        })
    return results if results else [{"info": "未找到包", "query": query}]


def pypi_search(query: str) -> list[dict]:
    """PyPI（Python包索引）搜索。"""
    url = f"https://pypi.org/search/?q={quote_plus(query)}&format=json"
    # PyPI 无官方搜索 JSON API（接口），用简单 API 端点
    # 直接查询具体包信息
    pkg_url = f"https://pypi.org/pypi/{quote_plus(query)}/json"
    try:
        req = Request(pkg_url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
        info = data.get("info", {})
        return [{
            "title":    info.get("name", query),
            "url":      info.get("package_url", f"https://pypi.org/project/{query}/"),
            "snippet":  info.get("summary", ""),
            "version":  info.get("version", ""),
            "author":   info.get("author", ""),
        }]
    except Exception:
        # 降级：直接抓取搜索页
        html = _http_get(f"https://pypi.org/search/?q={quote_plus(query)}")
        if not html:
            return [{"error": "PyPI 搜索失败"}]
        return _parse_search_results(html) or [{"info": "未找到包"}]


def dockerhub_search(query: str) -> list[dict]:
    """Docker Hub 镜像搜索。"""
    url = f"https://hub.docker.com/v2/search/repositories/?query={quote_plus(query)}&page_size=10"
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"Docker Hub 搜索失败: {e}"}]

    results_data = data.get("results", [])
    results = []
    for item in results_data:
        results.append({
            "title":   item.get("name", ""),
            "url":     f"https://hub.docker.com/r/{item.get('name', '')}",
            "snippet": item.get("short_description", ""),
            "stars":   item.get("star_count", 0),
            "pulls":   item.get("pull_count", 0),
        })
    return results if results else [{"info": "未找到镜像", "query": query}]


def zhihu_search(query: str) -> list[dict]:
    """知乎搜索（问题/文章）。"""
    url  = f"https://www.zhihu.com/search?type=content&q={quote_plus(query)}"
    html = _http_get(url)
    if not html:
        return [{"error": "知乎搜索请求失败"}]
    return _parse_search_results(html) or [{"info": "未找到结果"}]


def weibo_search(query: str) -> list[dict]:
    """微博搜索。"""
    url  = f"https://s.weibo.com/weibo?q={quote_plus(query)}"
    html = _http_get(url)
    if not html:
        return [{"error": "微博搜索请求失败"}]
    return _parse_search_results(html) or [{"info": "未找到结果"}]


def bilibili_search(query: str) -> list[dict]:
    """B站（哔哩哔哩）视频搜索。"""
    url = f"https://api.bilibili.com/x/web-interface/search/all/v2?keyword={quote_plus(query)}&page=1"
    try:
        req = Request(url, headers={**_HEADERS, "Referer": "https://www.bilibili.com"})
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"B站搜索失败: {e}"}]

    results = []
    for module in data.get("data", {}).get("result", []):
        if module.get("result_type") == "video":
            for item in module.get("data", []):
                results.append({
                    "title":  re.sub(r"<[^>]+>", "", item.get("title", "")),
                    "url":    f"https://www.bilibili.com/video/{item.get('bvid', '')}",
                    "snippet": item.get("description", "")[:200],
                    "author": item.get("author", ""),
                })
    return results[:10] if results else [{"info": "未找到视频", "query": query}]


def reddit_search(query: str, subreddit: str = "") -> list[dict]:
    """Reddit 帖子搜索。"""
    base = f"https://www.reddit.com/r/{subreddit}/search.json" if subreddit else "https://www.reddit.com/search.json"
    url  = f"{base}?q={quote_plus(query)}&limit=10&sort=relevance"
    try:
        req = Request(url, headers={**_HEADERS, "Accept": "application/json"})
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"Reddit 搜索失败: {e}"}]

    children = data.get("data", {}).get("children", [])
    results  = []
    for child in children:
        post = child.get("data", {})
        results.append({
            "title":   post.get("title", ""),
            "url":     f"https://www.reddit.com{post.get('permalink', '')}",
            "snippet": post.get("selftext", "")[:200],
            "score":   post.get("score", 0),
        })
    return results if results else [{"info": "未找到帖子", "query": query}]


def twitter_search(query: str) -> list[dict]:
    """Twitter/X 搜索（仅返回搜索页面链接，API需付费）。"""
    return [{
        "title":   f"Twitter 搜索: {query}",
        "url":     f"https://twitter.com/search?q={quote_plus(query)}",
        "snippet": "Twitter API（接口）需要开发者账号，请在浏览器中打开链接",
    }]


def linkedin_search(query: str) -> list[dict]:
    """LinkedIn 职业搜索（需登录，返回搜索链接）。"""
    return [{
        "title":   f"LinkedIn 搜索: {query}",
        "url":     f"https://www.linkedin.com/search/results/all/?keywords={quote_plus(query)}",
        "snippet": "LinkedIn 需要登录后访问，请在浏览器中打开链接",
    }]


def youtube_search(query: str) -> list[dict]:
    """YouTube 视频搜索（返回搜索链接，API需配置密钥）。"""
    url  = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    html = _http_get(url)
    if not html:
        return [{"title": f"YouTube 搜索: {query}", "url": url, "snippet": "请在浏览器中打开"}]
    # 尝试从 ytInitialData（初始数据）中提取结果
    match = re.search(r'"videoId":"([^"]+)".*?"title":\{"runs":\[\{"text":"([^"]+)"', html)
    if match:
        vid_id, title = match.group(1), match.group(2)
        return [{"title": title, "url": f"https://www.youtube.com/watch?v={vid_id}", "snippet": ""}]
    return [{"title": f"YouTube 搜索: {query}", "url": url, "snippet": "请在浏览器中打开"}]


def producthunt_search(query: str) -> list[dict]:
    """Product Hunt 产品搜索。"""
    url  = f"https://www.producthunt.com/search?q={quote_plus(query)}"
    html = _http_get(url)
    if not html:
        return [{"error": "Product Hunt 搜索失败"}]
    return _parse_search_results(html) or [{"info": "未找到产品"}]


def hacker_news_search(query: str) -> list[dict]:
    """Hacker News（黑客新闻）搜索，使用 Algolia API（接口）。"""
    url = f"https://hn.algolia.com/api/v1/search?query={quote_plus(query)}&hitsPerPage=10"
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"Hacker News 搜索失败: {e}"}]

    hits    = data.get("hits", [])
    results = []
    for hit in hits:
        results.append({
            "title":   hit.get("title", hit.get("story_title", "")),
            "url":     hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}",
            "snippet": hit.get("story_text", "")[:200],
            "points":  hit.get("points", 0),
        })
    return results if results else [{"info": "未找到结果", "query": query}]


def medium_search(query: str) -> list[dict]:
    """Medium 文章搜索。"""
    url  = f"https://medium.com/search?q={quote_plus(query)}"
    html = _http_get(url)
    if not html:
        return [{"error": "Medium 搜索失败"}]
    return _parse_search_results(html) or [{"info": "未找到文章"}]


def dev_to_search(query: str) -> list[dict]:
    """dev.to 开发者文章搜索（使用官方 API（接口））。"""
    url = f"https://dev.to/api/articles?per_page=10&tag={quote_plus(query)}"
    try:
        req = Request(url, headers={**_HEADERS, "Accept": "application/json"})
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            articles = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"dev.to 搜索失败: {e}"}]

    results = []
    for article in articles[:10]:
        results.append({
            "title":   article.get("title", ""),
            "url":     article.get("url", ""),
            "snippet": article.get("description", ""),
            "author":  article.get("user", {}).get("name", ""),
        })
    return results if results else [{"info": "未找到文章", "query": query}]


def crates_io_search(query: str) -> list[dict]:
    """crates.io Rust 包搜索。"""
    url = f"https://crates.io/api/v1/crates?q={quote_plus(query)}&per_page=10"
    try:
        req = Request(url, headers={**_HEADERS, "Accept": "application/json"})
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"crates.io 搜索失败: {e}"}]

    crates  = data.get("crates", [])
    results = []
    for crate in crates:
        results.append({
            "title":   crate.get("name", ""),
            "url":     f"https://crates.io/crates/{crate.get('name', '')}",
            "snippet": crate.get("description", ""),
            "version": crate.get("newest_version", ""),
        })
    return results if results else [{"info": "未找到包", "query": query}]


def maven_search(query: str) -> list[dict]:
    """Maven Central Java 包搜索。"""
    url = f"https://search.maven.org/solrsearch/select?q={quote_plus(query)}&rows=10&wt=json"
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"Maven 搜索失败: {e}"}]

    docs    = data.get("response", {}).get("docs", [])
    results = []
    for doc in docs:
        results.append({
            "title":   f"{doc.get('g', '')}:{doc.get('a', '')}",
            "url":     f"https://search.maven.org/artifact/{doc.get('g','')}/{doc.get('a','')}",
            "snippet": f"最新版本: {doc.get('latestVersion', '')}",
            "version": doc.get("latestVersion", ""),
        })
    return results if results else [{"info": "未找到包", "query": query}]


def huggingface_search(query: str) -> list[dict]:
    """HuggingFace AI 模型/数据集搜索。"""
    url = f"https://huggingface.co/api/models?search={quote_plus(query)}&limit=10"
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            models = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"HuggingFace 搜索失败: {e}"}]

    results = []
    for model in models[:10]:
        model_id = model.get("modelId") or model.get("id", "")
        results.append({
            "title":    model_id,
            "url":      f"https://huggingface.co/{model_id}",
            "snippet":  f"下载量: {model.get('downloads', 0):,}",
            "likes":    model.get("likes", 0),
            "pipeline": model.get("pipeline_tag", ""),
        })
    return results if results else [{"info": "未找到模型", "query": query}]


def kaggle_search(query: str) -> list[dict]:
    """Kaggle 数据集搜索（返回搜索页面链接）。"""
    return [{
        "title":   f"Kaggle 搜索: {query}",
        "url":     f"https://www.kaggle.com/search?q={quote_plus(query)}",
        "snippet": "Kaggle API（接口）需要账号认证，请在浏览器中打开搜索",
    }]


def gitee_search(query: str) -> list[dict]:
    """Gitee（码云）仓库搜索（国内 GitHub 替代）。"""
    url  = f"https://search.gitee.com/?q={quote_plus(query)}&type=repository"
    html = _http_get(url)
    if not html:
        return [{"error": "Gitee 搜索失败"}]
    return _parse_search_results(html) or [{"info": "未找到仓库"}]


def csdn_search(query: str) -> list[dict]:
    """CSDN 技术文章搜索。"""
    url  = f"https://so.csdn.net/so/search?q={quote_plus(query)}"
    html = _http_get(url)
    if not html:
        return [{"error": "CSDN 搜索失败"}]
    return _parse_search_results(html) or [{"info": "未找到文章"}]


def juejin_search(query: str) -> list[dict]:
    """掘金技术文章搜索。"""
    url = "https://api.juejin.cn/search_api/v1/search"
    try:
        payload = json.dumps({
            "key_word": query, "id_type": 0,
            "cursor":   "0", "limit": 10,
            "search_type": "0",
        }).encode()
        req = Request(url, data=payload, headers={
            **_HEADERS, "Content-Type": "application/json",
        })
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"掘金搜索失败: {e}"}]

    items   = data.get("data", [])
    results = []
    for item in items:
        info = item.get("article_info", item)
        results.append({
            "title":  info.get("title", ""),
            "url":    f"https://juejin.cn/post/{info.get('article_id', '')}",
            "snippet": info.get("brief_content", ""),
        })
    return results if results else [{"info": "未找到文章", "query": query}]


def cnki_search(query: str) -> list[dict]:
    """中国知网（CNKI）学术论文搜索（返回搜索链接）。"""
    return [{
        "title":   f"知网搜索: {query}",
        "url":     f"https://www.cnki.net/kns8/AdvSearch?dbcode=SCDB&kw={quote_plus(query)}",
        "snippet": "知网需要机构认证访问，请在浏览器中打开",
    }]


def wanfang_search(query: str) -> list[dict]:
    """万方数据学术搜索（返回搜索链接）。"""
    return [{
        "title":   f"万方搜索: {query}",
        "url":     f"https://www.wanfangdata.com.cn/search/searchList.do?searchType=all&searchWord={quote_plus(query)}",
        "snippet": "万方数据学术搜索平台",
    }]


def google_scholar_search(query: str) -> list[dict]:
    """Google Scholar（谷歌学术）搜索。"""
    url  = f"https://scholar.google.com/scholar?q={quote_plus(query)}&hl=zh-CN"
    html = _http_get(url)
    if not html:
        return [{"error": "Google Scholar 请求失败（可能需要代理）"}]
    return _parse_search_results(html) or [{"info": "未找到论文"}]


def semantic_scholar_search(query: str) -> list[dict]:
    """Semantic Scholar 学术论文搜索（使用官方 API（接口））。"""
    url = (
        f"https://api.semanticscholar.org/graph/v1/paper/search"
        f"?query={quote_plus(query)}&limit=10&fields=title,abstract,url,year,authors"
    )
    try:
        req = Request(url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return [{"error": f"Semantic Scholar 搜索失败: {e}"}]

    papers  = data.get("data", [])
    results = []
    for paper in papers:
        authors = ", ".join(a.get("name", "") for a in paper.get("authors", [])[:3])
        results.append({
            "title":   paper.get("title", ""),
            "url":     paper.get("url", ""),
            "snippet": (paper.get("abstract") or "")[:200],
            "year":    paper.get("year"),
            "authors": authors,
        })
    return results if results else [{"info": "未找到论文", "query": query}]


def pubmed_search(query: str) -> list[dict]:
    """PubMed 医学文献搜索（使用 NCBI E-utilities API（接口））。"""
    # 第一步：获取文章 ID 列表
    esearch_url = (
        f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        f"?db=pubmed&term={quote_plus(query)}&retmax=10&format=json"
    )
    try:
        req = Request(esearch_url, headers=_HEADERS)
        with urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            ids_data = json.loads(resp.read())
        ids = ids_data.get("esearchresult", {}).get("idlist", [])
    except Exception as e:
        return [{"error": f"PubMed 搜索失败: {e}"}]

    if not ids:
        return [{"info": "未找到文献", "query": query}]

    # 第二步：获取摘要
    results = []
    for pmid in ids[:5]:
        results.append({
            "title":   f"PubMed ID: {pmid}",
            "url":     f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "snippet": "点击链接查看详细摘要",
        })
    return results


def amazon_search(query: str) -> list[dict]:
    """亚马逊商品搜索（返回搜索页面链接）。"""
    return [{
        "title":   f"Amazon 搜索: {query}",
        "url":     f"https://www.amazon.com/s?k={quote_plus(query)}",
        "snippet": "Amazon 商品搜索，请在浏览器中打开",
    }]


def taobao_search(query: str) -> list[dict]:
    """淘宝商品搜索（返回搜索页面链接）。"""
    return [{
        "title":   f"淘宝搜索: {query}",
        "url":     f"https://s.taobao.com/search?q={quote_plus(query)}",
        "snippet": "淘宝商品搜索，需要登录访问，请在浏览器中打开",
    }]


def jd_search(query: str) -> list[dict]:
    """京东商品搜索（返回搜索页面链接）。"""
    return [{
        "title":   f"京东搜索: {query}",
        "url":     f"https://search.jd.com/Search?keyword={quote_plus(query)}",
        "snippet": "京东商品搜索，请在浏览器中打开",
    }]


def tianyancha_search(query: str) -> list[dict]:
    """天眼查企业信息搜索（返回搜索链接）。"""
    return [{
        "title":   f"天眼查: {query}",
        "url":     f"https://www.tianyancha.com/search?key={quote_plus(query)}",
        "snippet": "企业工商信息查询，需要登录访问",
    }]


def qichacha_search(query: str) -> list[dict]:
    """企查查企业信息搜索（返回搜索链接）。"""
    return [{
        "title":   f"企查查: {query}",
        "url":     f"https://www.qcc.com/web/search?key={quote_plus(query)}",
        "snippet": "企业工商信息查询，需要登录访问",
    }]


# ─── 通用浏览函数 ─────────────────────────────────────────────────────────────

def browse(url: str) -> dict:
    """
    获取指定 URL 的页面内容（标题 + 文本 + HTML 片段）。

    返回格式：{url, title, text, html_preview}
    """
    html = _http_get(url)
    if not html:
        return {"url": url, "error": "页面获取失败", "text": "", "title": ""}

    # 提取标题
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = _strip_html(title_match.group(1) if title_match else "").strip()

    text = _strip_html(html)
    return {
        "url":          url,
        "title":        title,
        "text":         text,
        "html_preview": html[:1000],
    }


def extract_text(url: str) -> str:
    """
    获取指定 URL 的纯文本内容（自动去除 HTML 标签）。
    """
    html = _http_get(url)
    if not html:
        return f"[错误] 无法访问 {url}"
    return _strip_html(html)


# ─── 注册到 ToolRegistry ──────────────────────────────────────────────────────

# 所有平台搜索函数的注册信息
_PLATFORM_TOOLS: list[tuple[str, str, Any]] = [
    ("google_search",         "Google 网页搜索",              google_search),
    ("baidu_search",          "百度搜索",                      baidu_search),
    ("github_search",         "GitHub 仓库/代码搜索",          github_search),
    ("bing_search",           "必应（Bing）搜索",              bing_search),
    ("duckduckgo_search",     "DuckDuckGo 隐私搜索",           duckduckgo_search),
    ("arxiv_search",          "arXiv 学术论文搜索",            arxiv_search),
    ("wikipedia_search",      "维基百科搜索",                  wikipedia_search),
    ("stackoverflow_search",  "Stack Overflow 技术问题搜索",   stackoverflow_search),
    ("npm_search",            "npm JavaScript 包搜索",         npm_search),
    ("pypi_search",           "PyPI Python 包搜索",            pypi_search),
    ("dockerhub_search",      "Docker Hub 镜像搜索",           dockerhub_search),
    ("zhihu_search",          "知乎问答搜索",                  zhihu_search),
    ("weibo_search",          "微博搜索",                      weibo_search),
    ("bilibili_search",       "B站（哔哩哔哩）视频搜索",       bilibili_search),
    ("reddit_search",         "Reddit 社区帖子搜索",           reddit_search),
    ("twitter_search",        "Twitter/X 搜索链接",            twitter_search),
    ("linkedin_search",       "LinkedIn 职业搜索链接",         linkedin_search),
    ("youtube_search",        "YouTube 视频搜索",              youtube_search),
    ("producthunt_search",    "Product Hunt 产品搜索",         producthunt_search),
    ("hacker_news_search",    "Hacker News 技术新闻搜索",      hacker_news_search),
    ("medium_search",         "Medium 文章搜索",               medium_search),
    ("dev_to_search",         "dev.to 开发者文章搜索",         dev_to_search),
    ("crates_io_search",      "crates.io Rust 包搜索",         crates_io_search),
    ("maven_search",          "Maven Central Java 包搜索",     maven_search),
    ("huggingface_search",    "HuggingFace AI 模型搜索",       huggingface_search),
    ("kaggle_search",         "Kaggle 数据集搜索链接",         kaggle_search),
    ("gitee_search",          "Gitee（码云）仓库搜索",         gitee_search),
    ("csdn_search",           "CSDN 技术文章搜索",             csdn_search),
    ("juejin_search",         "掘金技术文章搜索",              juejin_search),
    ("cnki_search",           "中国知网学术搜索链接",           cnki_search),
    ("wanfang_search",        "万方数据学术搜索链接",           wanfang_search),
    ("google_scholar_search", "Google Scholar 学术搜索",       google_scholar_search),
    ("semantic_scholar_search","Semantic Scholar 论文搜索",    semantic_scholar_search),
    ("pubmed_search",         "PubMed 医学文献搜索",           pubmed_search),
    ("amazon_search",         "亚马逊商品搜索链接",            amazon_search),
    ("taobao_search",         "淘宝商品搜索链接",              taobao_search),
]

_BROWSE_TOOLS: list[tuple[str, str, Any]] = [
    ("browse",        "浏览网页，获取标题与文本内容", browse),
    ("extract_text",  "提取网页纯文本内容",          extract_text),
]


def register_platform_tools(registry: ToolRegistry) -> None:
    """将所有平台搜索工具注册到 ToolRegistry（工具注册表）。"""
    for name, description, handler in _PLATFORM_TOOLS:
        registry.register(ToolDefinition(
            name=name,
            description=description,
            permission_level="L1",
            category="网络访问",
            handler=handler,
        ))
    for name, description, handler in _BROWSE_TOOLS:
        registry.register(ToolDefinition(
            name=name,
            description=description,
            permission_level="L1",
            category="网络访问",
            handler=handler,
        ))
    logger.info(f"已注册 {len(_PLATFORM_TOOLS) + len(_BROWSE_TOOLS)} 个平台搜索工具")
