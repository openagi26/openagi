"""Tests for chat/skills/market.py — 技能市场"""

import pytest
from openagi.chat.skills.engine import SkillCategory
from openagi.chat.skills.market import (
    COCOLOOP_PACKAGES,
    OPENCLAW_PACKAGES,
    MarketCatalog,
    MarketSource,
    SkillPackage,
    browse_by_category,
    catalog_summary,
    create_catalog_from_builtins,
    get_package,
    get_source_info,
    get_top_packages,
    list_all_sources,
    search_packages,
)


# ---------------------------------------------------------------------------
# 目录初始化
# ---------------------------------------------------------------------------

def test_create_catalog_from_builtins():
    catalog = create_catalog_from_builtins()
    assert len(catalog.packages) == len(OPENCLAW_PACKAGES) + len(COCOLOOP_PACKAGES)
    assert catalog.last_synced is not None


def test_catalog_has_openclaw_packages():
    catalog = create_catalog_from_builtins()
    for pkg in OPENCLAW_PACKAGES:
        assert pkg.package_name in catalog.packages


def test_catalog_has_cocoloop_packages():
    catalog = create_catalog_from_builtins()
    for pkg in COCOLOOP_PACKAGES:
        assert pkg.package_name in catalog.packages


# ---------------------------------------------------------------------------
# 搜索
# ---------------------------------------------------------------------------

def test_search_packages_by_name():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "search")
    assert any(p.package_name == "web-search" for p in results)


def test_search_packages_by_display_name():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "网页搜索")
    assert len(results) >= 1


def test_search_packages_by_description():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "PDF")
    assert any("document" in p.package_name for p in results)


def test_search_packages_by_tag():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "代码")
    assert any(p.package_name == "code-executor" for p in results)


def test_search_packages_by_source():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "", source=MarketSource.OPENCLAW)
    assert all(p.source == MarketSource.OPENCLAW for p in results)
    assert len(results) == len(OPENCLAW_PACKAGES)


def test_search_packages_by_category():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "", category=SkillCategory.TOOL)
    assert all(p.category == SkillCategory.TOOL for p in results)


def test_search_packages_sorted_by_downloads():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "")
    for i in range(len(results) - 1):
        assert results[i].downloads >= results[i + 1].downloads


def test_search_packages_empty_query_returns_all():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "")
    assert len(results) == len(catalog.packages)


def test_search_packages_no_match():
    catalog = create_catalog_from_builtins()
    results = search_packages(catalog, "不存在的技能xyz123")
    assert len(results) == 0


# ---------------------------------------------------------------------------
# 分类浏览
# ---------------------------------------------------------------------------

def test_browse_by_category_tool():
    catalog = create_catalog_from_builtins()
    results = browse_by_category(catalog, SkillCategory.TOOL)
    assert len(results) > 0
    assert all(p.category == SkillCategory.TOOL for p in results)


def test_browse_by_category_knowledge():
    catalog = create_catalog_from_builtins()
    results = browse_by_category(catalog, SkillCategory.KNOWLEDGE)
    assert len(results) > 0


def test_browse_by_category_with_source_filter():
    catalog = create_catalog_from_builtins()
    results = browse_by_category(catalog, SkillCategory.TOOL, source=MarketSource.COCOLOOP)
    assert all(p.source == MarketSource.COCOLOOP for p in results)


# ---------------------------------------------------------------------------
# 包详情
# ---------------------------------------------------------------------------

def test_get_package_found():
    catalog = create_catalog_from_builtins()
    pkg = get_package(catalog, "web-search")
    assert pkg is not None
    assert pkg.display_name == "网页搜索"


def test_get_package_not_found():
    catalog = create_catalog_from_builtins()
    assert get_package(catalog, "nonexistent-pkg") is None


# ---------------------------------------------------------------------------
# 排行榜
# ---------------------------------------------------------------------------

def test_get_top_packages():
    catalog = create_catalog_from_builtins()
    top = get_top_packages(catalog, limit=3)
    assert len(top) == 3
    # 应按下载量降序
    for i in range(len(top) - 1):
        assert top[i].downloads >= top[i + 1].downloads


def test_get_top_packages_by_source():
    catalog = create_catalog_from_builtins()
    top = get_top_packages(catalog, source=MarketSource.COCOLOOP)
    assert all(p.source == MarketSource.COCOLOOP for p in top)


# ---------------------------------------------------------------------------
# 来源信息
# ---------------------------------------------------------------------------

def test_get_source_info_openclaw():
    info = get_source_info(MarketSource.OPENCLAW)
    assert "cn.clawhub-mirror.com" in info["url"]
    assert info["trusted"] is True


def test_get_source_info_cocoloop():
    info = get_source_info(MarketSource.COCOLOOP)
    assert "hub.cocoloop.cn" in info["url"]
    assert info["trusted"] is True


def test_list_all_sources():
    sources = list_all_sources()
    assert len(sources) == 3
    source_values = [s["source"] for s in sources]
    assert "openclaw" in source_values
    assert "cocoloop" in source_values


# ---------------------------------------------------------------------------
# 目录摘要
# ---------------------------------------------------------------------------

def test_catalog_summary():
    catalog = create_catalog_from_builtins()
    summary = catalog_summary(catalog)
    assert summary["total_packages"] == len(catalog.packages)
    assert "by_source" in summary
    assert "by_category" in summary
    assert summary["by_source"]["openclaw"] == len(OPENCLAW_PACKAGES)
    assert summary["by_source"]["cocoloop"] == len(COCOLOOP_PACKAGES)
