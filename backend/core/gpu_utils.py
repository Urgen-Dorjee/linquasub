import shutil


def get_gpu_info() -> dict:
    """Detect GPU information and CUDA availability."""
    try:
        import torch

        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            vram_total = props.total_mem // (1024 * 1024)
            vram_used = torch.cuda.memory_allocated(0) // (1024 * 1024)

            # Recommend model based on VRAM
            if vram_total >= 3000:
                recommended = "large"
            elif vram_total >= 1500:
                recommended = "medium"
            elif vram_total >= 500:
                recommended = "small"
            elif vram_total >= 150:
                recommended = "base"
            else:
                recommended = "tiny"

            return {
                "gpu_name": props.name,
                "vram_total_mb": vram_total,
                "vram_used_mb": vram_used,
                "cuda_available": True,
                "cuda_version": torch.version.cuda or "unknown",
                "recommended_model": recommended,
            }
    except ImportError:
        pass

    # Try ctranslate2 for CUDA detection (faster-whisper dependency)
    try:
        import ctranslate2

        if "cuda" in ctranslate2.get_supported_compute_types("cuda"):
            return {
                "gpu_name": "NVIDIA GPU (detected via CTranslate2)",
                "vram_total_mb": 0,
                "vram_used_mb": 0,
                "cuda_available": True,
                "cuda_version": "unknown",
                "recommended_model": "small",
            }
    except Exception:
        pass

    return {
        "gpu_name": "None",
        "vram_total_mb": 0,
        "vram_used_mb": 0,
        "cuda_available": False,
        "cuda_version": "N/A",
        "recommended_model": "small",
    }


def select_device(model_size: str) -> tuple[str, str]:
    """Select optimal device and compute type for a given Whisper model size."""
    info = get_gpu_info()

    if not info["cuda_available"]:
        return ("cpu", "int8")

    vram = info["vram_total_mb"]

    # VRAM thresholds for GPU usage (with int8 quantization)
    gpu_thresholds = {
        "tiny": 200,
        "base": 300,
        "small": 600,
        "medium": 2000,
        "large": 3500,
    }

    threshold = gpu_thresholds.get(model_size, 99999)

    if vram >= threshold:
        compute = "int8" if model_size in ("small", "medium") else "float16"
        return ("cuda", compute)

    return ("cpu", "int8")
