import json
import os
import sys
from pydantic_settings import BaseSettings


def _is_packaged() -> bool:
    """Detect if running in a packaged Electron app."""
    return bool(os.environ.get("LINGUASUB_PACKAGED")) or getattr(sys, "frozen", False)


def _get_data_dir() -> str:
    """Get the LinguaSub data directory in APPDATA."""
    return os.path.join(
        os.environ.get("APPDATA", os.path.expanduser("~")),
        "LinguaSub",
    )


def _get_temp_dir() -> str:
    """Use a writable temp directory. In packaged builds,
    the app may be in a read-only location, so use APPDATA."""
    if _is_packaged():
        base = _get_data_dir()
    else:
        base = os.path.join(os.path.dirname(__file__), "..", "resources")
    return os.path.join(base, "temp")


def _get_model_dir() -> str:
    """Whisper models go in APPDATA so they persist across updates."""
    return os.path.join(_get_data_dir(), "models")


def _get_settings_file() -> str:
    """Path to the persisted settings JSON file."""
    return os.path.join(_get_data_dir(), "settings.json")


class Settings(BaseSettings):
    backend_port: int = 8321
    ffmpeg_path: str = os.environ.get("FFMPEG_PATH", "ffmpeg")
    deepl_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    whisper_model_dir: str = _get_model_dir()
    temp_dir: str = _get_temp_dir()

    class Config:
        env_prefix = ""
        env_file = ".env"


settings = Settings()


def load_persisted_settings():
    """Load persisted settings (API keys) from disk."""
    settings_file = _get_settings_file()
    try:
        if os.path.exists(settings_file):
            with open(settings_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("gemini_api_key"):
                settings.gemini_api_key = data["gemini_api_key"]
            if data.get("deepl_api_key"):
                settings.deepl_api_key = data["deepl_api_key"]
            if data.get("gemini_model"):
                settings.gemini_model = data["gemini_model"]
    except Exception:
        pass


def save_persisted_settings():
    """Save current API keys to disk so they survive restarts."""
    settings_file = _get_settings_file()
    try:
        os.makedirs(os.path.dirname(settings_file), exist_ok=True)
        data = {
            "gemini_api_key": settings.gemini_api_key,
            "deepl_api_key": settings.deepl_api_key,
            "gemini_model": settings.gemini_model,
        }
        with open(settings_file, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except Exception:
        pass


# Load saved settings on import
load_persisted_settings()
