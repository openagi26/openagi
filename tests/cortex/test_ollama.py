"""Ollama本地模型客户端测试。"""

from pathlib import Path


def test_ollama_module_exists():
    f = Path(__file__).parent.parent.parent / "openagi" / "cortex" / "llm" / "ollama.py"
    assert f.exists()
    content = f.read_text()
    assert "OllamaClient" in content
    assert "RECOMMENDED_MODELS" in content


def test_recommended_models():
    from openagi.cortex.llm.ollama import RECOMMENDED_MODELS
    assert len(RECOMMENDED_MODELS) >= 5
    names = [m["id"] for m in RECOMMENDED_MODELS]
    assert "qwen2.5:3b" in names  # 中文最优
    assert "llama3.2:3b" in names


def test_ollama_client_init():
    from openagi.cortex.llm.ollama import OllamaClient
    client = OllamaClient(base_url="http://localhost:11434", model="qwen2.5:3b")
    assert client.base_url == "http://localhost:11434"
    assert client.model == "qwen2.5:3b"


def test_ollama_route_exists():
    f = Path(__file__).parent.parent.parent / "openagi" / "api" / "routes" / "ollama.py"
    assert f.exists()
    content = f.read_text()
    assert "ollama_status" in content
    assert "ollama_chat" in content
    assert "pull_model" in content


def test_ollama_api_endpoints_registered():
    """确保Ollama路由已注册到FastAPI。"""
    content = (Path(__file__).parent.parent.parent / "openagi" / "api" / "main.py").read_text()
    assert "ollama_routes" in content
