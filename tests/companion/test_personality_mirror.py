"""用户人格镜像测试。"""

import tempfile
from pathlib import Path


def test_mirror_module_exists():
    f = Path(__file__).parent.parent.parent / "openagi" / "companion" / "personality_mirror.py"
    assert f.exists()


def test_mirror_learn():
    from openagi.companion.personality_mirror import PersonalityMirror
    mirror = PersonalityMirror(path=Path(tempfile.mktemp(suffix=".json")))
    mirror.learn_from_message("今天的代码写得不错")
    assert mirror.data["total_messages"] == 1
    assert mirror.data["avg_msg_length"] > 0


def test_mirror_topic_detection():
    from openagi.companion.personality_mirror import PersonalityMirror
    mirror = PersonalityMirror(path=Path(tempfile.mktemp(suffix=".json")))
    mirror.learn_from_message("这个项目的用户增长不错")
    assert "创业" in mirror.data["topic_interests"]


def test_mirror_style_prompt():
    from openagi.companion.personality_mirror import PersonalityMirror
    mirror = PersonalityMirror(path=Path(tempfile.mktemp(suffix=".json")))
    for i in range(10):
        mirror.learn_from_message(f"这是第{i}条测试消息，我喜欢编程和开发")
    prompt = mirror.get_style_prompt()
    assert isinstance(prompt, str)


def test_mirror_stats():
    from openagi.companion.personality_mirror import PersonalityMirror
    mirror = PersonalityMirror(path=Path(tempfile.mktemp(suffix=".json")))
    mirror.learn_from_message("测试消息")
    stats = mirror.get_stats()
    assert stats["total_messages"] == 1
    assert "style" in stats
