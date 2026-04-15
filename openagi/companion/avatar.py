"""
companion/avatar.py — 形象管理 (Avatar Manager)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

管理AI伴侣的视觉形象：
  · 形象类型：静态头像 / Live2D / VRM / AI自拍
  · 头像上传和存储路径管理
  · 形象配置持久化（~/.openagi/data/avatar/）
  · AI自拍配置（触发条件/模式/风格提示词）
"""

from __future__ import annotations

import json
import logging
import shutil
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger("openagi.companion.avatar")

# ─── 存储路径 ────────────────────────────────────────────────────────────────

_AVATAR_DIR   = Path.home() / ".openagi" / "data" / "avatar"
_UPLOAD_DIR   = _AVATAR_DIR / "uploads"
_SELFIE_DIR   = _AVATAR_DIR / "selfies"
_LIVE2D_DIR   = _AVATAR_DIR / "live2d"
_VRM_DIR      = _AVATAR_DIR / "vrm"
_CONFIG_FILE  = _AVATAR_DIR / "avatar_config.json"

# 支持的上传格式
ALLOWED_IMAGE_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_LIVE2D_FORMATS = {".zip", ".moc3"}
ALLOWED_VRM_FORMATS = {".vrm"}

# 默认头像（内置占位）
DEFAULT_AVATAR_PATH = _AVATAR_DIR / "default_avatar.png"


# ─── 形象类型枚举 ────────────────────────────────────────────────────────────

class AvatarType(str, Enum):
    """AI伴侣的形象类型。"""
    STATIC  = "static"   # 静态头像（PNG/JPG/WebP）
    LIVE2D  = "live2d"   # Live2D 动态模型
    VRM     = "vrm"      # VRM 3D虚拟形象
    SELFIE  = "selfie"   # AI自拍（由图像生成模型实时生成）


# ─── AI自拍配置 ──────────────────────────────────────────────────────────────

class SelfieMode(str, Enum):
    """AI自拍触发模式。"""
    ON_REQUEST   = "on_request"   # 仅用户主动请求时生成
    PERIODIC     = "periodic"     # 定时自动生成
    ON_MOOD_CHANGE = "on_mood_change"  # 心境变化时自动生成


@dataclass
class SelfieConfig:
    """AI自拍配置。"""
    enabled: bool = False
    mode: SelfieMode = SelfieMode.ON_REQUEST
    # 自拍风格提示词（用于图像生成模型）
    style_prompt: str = (
        "anime style, soft lighting, natural expression, "
        "looking at camera, digital art, high quality"
    )
    # 负向提示词（不希望出现的元素）
    negative_prompt: str = "blurry, ugly, deformed, nsfw, watermark"
    # 图像尺寸
    width: int = 512
    height: int = 512
    # 定时模式：间隔小时数
    periodic_hours: int = 6
    # 心境模式：触发的熵值变化阈值
    mood_entropy_delta: float = 0.2
    # 最近生成的自拍路径（最多保留N张）
    max_selfies_kept: int = 20


# ─── Live2D配置 ──────────────────────────────────────────────────────────────

@dataclass
class Live2DConfig:
    """Live2D模型配置。"""
    model_dir: str = ""          # 模型目录路径
    model_file: str = ""         # .moc3 主文件名
    physics_file: str = ""       # 物理文件（可选）
    expressions: list[str] = field(default_factory=list)  # 表情列表
    motions: list[str] = field(default_factory=list)      # 动作列表
    # 当前表情映射（情绪→表情名）
    emotion_map: dict[str, str] = field(default_factory=lambda: {
        "calm":    "normal",
        "focused": "thinking",
        "anxious": "worried",
        "crisis":  "scared",
        "happy":   "smile",
        "sad":     "sad",
    })


# ─── VRM配置 ─────────────────────────────────────────────────────────────────

@dataclass
class VRMConfig:
    """VRM 3D虚拟形象配置。"""
    model_path: str = ""         # .vrm 文件路径
    # 骨骼动画配置
    idle_animation: str = "idle_breathing"
    # BlendShape（混合变形）情绪映射
    blend_shape_map: dict[str, str] = field(default_factory=lambda: {
        "happy": "Joy",
        "sad":   "Sorrow",
        "angry": "Angry",
        "neutral": "Neutral",
        "surprised": "Fun",
    })


# ─── 主配置 ──────────────────────────────────────────────────────────────────

@dataclass
class AvatarConfig:
    """完整的形象配置。"""
    avatar_type: AvatarType = AvatarType.STATIC
    # 当前激活的头像文件路径（相对于_AVATAR_DIR）
    current_avatar_path: str = ""
    # 显示名称
    display_name: str = "OpenAGI"
    # 静态头像路径列表（可切换）
    static_avatar_paths: list[str] = field(default_factory=list)
    # AI自拍配置
    selfie: SelfieConfig = field(default_factory=SelfieConfig)
    # Live2D配置
    live2d: Live2DConfig = field(default_factory=Live2DConfig)
    # VRM配置
    vrm: VRMConfig = field(default_factory=VRMConfig)
    # 更新时间
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        d = asdict(self)
        d["avatar_type"] = self.avatar_type.value
        d["selfie"]["mode"] = self.selfie.mode.value
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "AvatarConfig":
        d = d.copy()
        d["avatar_type"] = AvatarType(d.get("avatar_type", "static"))
        if "selfie" in d and isinstance(d["selfie"], dict):
            selfie_d = d["selfie"].copy()
            selfie_d["mode"] = SelfieMode(selfie_d.get("mode", "on_request"))
            d["selfie"] = SelfieConfig(**selfie_d)
        if "live2d" in d and isinstance(d["live2d"], dict):
            d["live2d"] = Live2DConfig(**d["live2d"])
        if "vrm" in d and isinstance(d["vrm"], dict):
            d["vrm"] = VRMConfig(**d["vrm"])
        return cls(**d)


# ─── 上传结果 ────────────────────────────────────────────────────────────────

@dataclass
class UploadResult:
    """头像上传结果。"""
    success: bool
    saved_path: Optional[str]
    avatar_type: AvatarType
    error: Optional[str] = None
    file_size_kb: float = 0.0

    def __repr__(self) -> str:
        return f"UploadResult(ok={self.success}, type={self.avatar_type.value}, path={self.saved_path})"


# ─── 形象管理器 ──────────────────────────────────────────────────────────────

class AvatarManager:
    """
    AI伴侣形象管理器。

    职责：
    · 管理头像上传/存储/切换
    · 维护形象配置（持久化到JSON）
    · 管理AI自拍生成逻辑
    · 提供当前形象信息给渲染层
    """

    def __init__(self, config: Optional[AvatarConfig] = None):
        self._ensure_dirs()

        if config is not None:
            self._config = config
        elif _CONFIG_FILE.exists():
            self._config = self._load()
        else:
            self._config = AvatarConfig()

        self._last_selfie_at: float = 0.0
        self._last_entropy: float = 0.0

        logger.info(
            f"AvatarManager 初始化 — 类型={self._config.avatar_type.value}"
        )

    # ── 属性 ────────────────────────────────────────────────────────────────

    @property
    def config(self) -> AvatarConfig:
        return self._config

    @property
    def avatar_type(self) -> AvatarType:
        return self._config.avatar_type

    @property
    def current_avatar_path(self) -> Optional[Path]:
        """返回当前头像的绝对路径，不存在则返回None。"""
        if not self._config.current_avatar_path:
            return None
        p = Path(self._config.current_avatar_path)
        if not p.is_absolute():
            p = _AVATAR_DIR / p
        return p if p.exists() else None

    # ── 头像上传 ─────────────────────────────────────────────────────────────

    def upload_static_avatar(self, source_path: Path) -> UploadResult:
        """
        上传静态头像图片。

        Args:
            source_path: 原始图片路径（本地）

        Returns:
            UploadResult
        """
        source_path = Path(source_path)
        suffix = source_path.suffix.lower()

        if suffix not in ALLOWED_IMAGE_FORMATS:
            return UploadResult(
                success=False,
                saved_path=None,
                avatar_type=AvatarType.STATIC,
                error=f"不支持的格式: {suffix}，支持: {ALLOWED_IMAGE_FORMATS}",
            )

        if not source_path.exists():
            return UploadResult(
                success=False,
                saved_path=None,
                avatar_type=AvatarType.STATIC,
                error=f"文件不存在: {source_path}",
            )

        ts = int(time.time() * 1000)
        dest_name = f"avatar_{ts}{suffix}"
        dest_path = _UPLOAD_DIR / dest_name

        try:
            shutil.copy2(source_path, dest_path)
            file_size_kb = dest_path.stat().st_size / 1024

            # 添加到头像列表并设为当前头像
            rel_path = str(dest_path.relative_to(_AVATAR_DIR))
            if rel_path not in self._config.static_avatar_paths:
                self._config.static_avatar_paths.append(rel_path)
            self._config.current_avatar_path = rel_path
            self._config.avatar_type = AvatarType.STATIC
            self._config.updated_at = datetime.now(timezone.utc).isoformat()
            self.save()

            logger.info(f"静态头像上传成功: {dest_path} ({file_size_kb:.1f}KB)")
            return UploadResult(
                success=True,
                saved_path=str(dest_path),
                avatar_type=AvatarType.STATIC,
                file_size_kb=file_size_kb,
            )

        except Exception as e:
            logger.error(f"头像上传失败: {e}")
            return UploadResult(
                success=False,
                saved_path=None,
                avatar_type=AvatarType.STATIC,
                error=str(e),
            )

    def upload_live2d_model(self, source_path: Path) -> UploadResult:
        """
        上传Live2D模型（zip包或moc3文件）。

        Args:
            source_path: 模型文件路径
        """
        source_path = Path(source_path)
        suffix = source_path.suffix.lower()

        if suffix not in ALLOWED_LIVE2D_FORMATS:
            return UploadResult(
                success=False,
                saved_path=None,
                avatar_type=AvatarType.LIVE2D,
                error=f"不支持的格式: {suffix}，支持: {ALLOWED_LIVE2D_FORMATS}",
            )

        ts = int(time.time() * 1000)
        if suffix == ".zip":
            import zipfile
            dest_dir = _LIVE2D_DIR / f"model_{ts}"
            dest_dir.mkdir(parents=True, exist_ok=True)
            try:
                with zipfile.ZipFile(source_path, "r") as zf:
                    zf.extractall(dest_dir)
                # 查找.moc3文件
                moc3_files = list(dest_dir.rglob("*.moc3"))
                model_file = moc3_files[0].name if moc3_files else ""
                self._config.live2d.model_dir = str(dest_dir)
                self._config.live2d.model_file = model_file
                self._config.avatar_type = AvatarType.LIVE2D
                self._config.updated_at = datetime.now(timezone.utc).isoformat()
                self.save()
                logger.info(f"Live2D模型解压成功: {dest_dir}")
                return UploadResult(
                    success=True,
                    saved_path=str(dest_dir),
                    avatar_type=AvatarType.LIVE2D,
                )
            except Exception as e:
                return UploadResult(
                    success=False,
                    saved_path=None,
                    avatar_type=AvatarType.LIVE2D,
                    error=str(e),
                )
        else:
            dest_path = _LIVE2D_DIR / source_path.name
            shutil.copy2(source_path, dest_path)
            self._config.live2d.model_file = source_path.name
            self._config.live2d.model_dir = str(_LIVE2D_DIR)
            self._config.avatar_type = AvatarType.LIVE2D
            self.save()
            return UploadResult(
                success=True,
                saved_path=str(dest_path),
                avatar_type=AvatarType.LIVE2D,
            )

    def upload_vrm_model(self, source_path: Path) -> UploadResult:
        """上传VRM 3D模型文件。"""
        source_path = Path(source_path)
        if source_path.suffix.lower() not in ALLOWED_VRM_FORMATS:
            return UploadResult(
                success=False,
                saved_path=None,
                avatar_type=AvatarType.VRM,
                error=f"只支持.vrm格式",
            )

        dest_path = _VRM_DIR / source_path.name
        try:
            shutil.copy2(source_path, dest_path)
            self._config.vrm.model_path = str(dest_path)
            self._config.avatar_type = AvatarType.VRM
            self._config.updated_at = datetime.now(timezone.utc).isoformat()
            self.save()
            logger.info(f"VRM模型上传成功: {dest_path}")
            return UploadResult(
                success=True,
                saved_path=str(dest_path),
                avatar_type=AvatarType.VRM,
            )
        except Exception as e:
            return UploadResult(
                success=False,
                saved_path=None,
                avatar_type=AvatarType.VRM,
                error=str(e),
            )

    # ── 形象切换 ─────────────────────────────────────────────────────────────

    def switch_avatar(self, avatar_type: AvatarType) -> None:
        """切换形象类型。"""
        self._config.avatar_type = avatar_type
        self._config.updated_at = datetime.now(timezone.utc).isoformat()
        self.save()
        logger.info(f"形象切换为: {avatar_type.value}")

    def set_current_static(self, path_str: str) -> bool:
        """在已上传的静态头像中切换当前使用的头像。"""
        if path_str in self._config.static_avatar_paths:
            self._config.current_avatar_path = path_str
            self.save()
            return True
        # 也接受绝对路径
        p = Path(path_str)
        if p.exists() and p.suffix.lower() in ALLOWED_IMAGE_FORMATS:
            rel = str(p.relative_to(_AVATAR_DIR)) if p.is_relative_to(_AVATAR_DIR) else path_str
            self._config.current_avatar_path = rel
            self.save()
            return True
        return False

    # ── AI自拍配置 ───────────────────────────────────────────────────────────

    def configure_selfie(
        self,
        enabled: Optional[bool] = None,
        mode: Optional[SelfieMode] = None,
        style_prompt: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        periodic_hours: Optional[int] = None,
    ) -> SelfieConfig:
        """更新AI自拍配置。"""
        sc = self._config.selfie
        if enabled is not None:
            sc.enabled = enabled
        if mode is not None:
            sc.mode = mode
        if style_prompt is not None:
            sc.style_prompt = style_prompt
        if negative_prompt is not None:
            sc.negative_prompt = negative_prompt
        if periodic_hours is not None:
            sc.periodic_hours = max(1, periodic_hours)
        self._config.updated_at = datetime.now(timezone.utc).isoformat()
        self.save()
        return sc

    def should_generate_selfie(self, current_entropy: float = 0.0) -> bool:
        """判断是否应该触发AI自拍生成。"""
        sc = self._config.selfie
        if not sc.enabled or self._config.avatar_type != AvatarType.SELFIE:
            return False

        now = time.time()
        if sc.mode == SelfieMode.PERIODIC:
            interval = sc.periodic_hours * 3600
            return (now - self._last_selfie_at) >= interval

        if sc.mode == SelfieMode.ON_MOOD_CHANGE:
            delta = abs(current_entropy - self._last_entropy)
            return delta >= sc.mood_entropy_delta

        return False  # ON_REQUEST: 不自动触发

    def record_selfie_generated(self, path: Path, entropy: float = 0.0) -> None:
        """记录已生成一张AI自拍。"""
        self._last_selfie_at = time.time()
        self._last_entropy = entropy

        # 加入历史列表（超出最大数量时删除最旧的）
        rel = str(path.relative_to(_AVATAR_DIR)) if path.is_relative_to(_AVATAR_DIR) else str(path)
        if rel not in self._config.static_avatar_paths:
            self._config.static_avatar_paths.append(rel)

        max_keep = self._config.selfie.max_selfies_kept
        selfie_paths = [p for p in self._config.static_avatar_paths if "selfie" in p]
        if len(selfie_paths) > max_keep:
            oldest = selfie_paths[0]
            self._config.static_avatar_paths.remove(oldest)
            old_file = _AVATAR_DIR / oldest
            old_file.unlink(missing_ok=True)

        self._config.current_avatar_path = rel
        self.save()

    def get_selfie_prompt(self) -> dict:
        """返回AI自拍用于图像生成的完整提示词配置。"""
        sc = self._config.selfie
        return {
            "prompt": sc.style_prompt,
            "negative_prompt": sc.negative_prompt,
            "width": sc.width,
            "height": sc.height,
        }

    # ── 状态查询 ─────────────────────────────────────────────────────────────

    def list_uploaded_avatars(self) -> list[dict]:
        """列出所有已上传的头像信息。"""
        result = []
        for rel_path in self._config.static_avatar_paths:
            abs_path = _AVATAR_DIR / rel_path
            result.append({
                "path": str(abs_path),
                "rel_path": rel_path,
                "exists": abs_path.exists(),
                "is_current": rel_path == self._config.current_avatar_path,
                "is_selfie": "selfie" in rel_path,
                "size_kb": abs_path.stat().st_size / 1024 if abs_path.exists() else 0,
            })
        return result

    def get_status(self) -> dict:
        """返回当前形象状态摘要。"""
        return {
            "avatar_type": self._config.avatar_type.value,
            "display_name": self._config.display_name,
            "current_avatar": self._config.current_avatar_path,
            "total_avatars": len(self._config.static_avatar_paths),
            "selfie_enabled": self._config.selfie.enabled,
            "selfie_mode": self._config.selfie.mode.value,
            "live2d_model": self._config.live2d.model_file,
            "vrm_model": self._config.vrm.model_path,
            "updated_at": self._config.updated_at,
        }

    # ── 持久化 ───────────────────────────────────────────────────────────────

    def save(self) -> None:
        """保存配置到JSON文件。"""
        _CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self._config.to_dict(), f, ensure_ascii=False, indent=2)
        logger.debug(f"形象配置已保存: {_CONFIG_FILE}")

    def _load(self) -> AvatarConfig:
        """从JSON加载配置。"""
        try:
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            cfg = AvatarConfig.from_dict(data)
            logger.info(f"形象配置已加载: type={cfg.avatar_type.value}")
            return cfg
        except Exception as e:
            logger.warning(f"加载形象配置失败（使用默认值）: {e}")
            return AvatarConfig()

    @staticmethod
    def _ensure_dirs() -> None:
        """确保所有存储目录存在。"""
        for d in [_AVATAR_DIR, _UPLOAD_DIR, _SELFIE_DIR, _LIVE2D_DIR, _VRM_DIR]:
            d.mkdir(parents=True, exist_ok=True)
