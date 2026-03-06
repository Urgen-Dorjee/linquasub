from pydantic import BaseModel
from typing import Optional


class VideoInfoRequest(BaseModel):
    path: str


class VideoDownloadRequest(BaseModel):
    url: str
    quality: str = "best"
    output_dir: Optional[str] = None


class VideoInfoResponse(BaseModel):
    duration: float
    resolution: str
    fps: float
    codec: str
    audio_codec: str
    file_size_mb: float


class WordTimestamp(BaseModel):
    start: float
    end: float
    word: str
    probability: float = 0.0


class SegmentResponse(BaseModel):
    id: str
    start: float
    end: float
    text: str
    words: list[WordTimestamp]


class TranscribeRequest(BaseModel):
    video_path: str
    model: str = "small"
    language: str = "auto"
    device: str = "auto"
    compute_type: str = "float16"
    vad_filter: bool = True
    engine: str = "whisper"  # "whisper" or "gemini"
    target_lang: str = ""  # When set with Gemini, combines transcription + translation in one call


class TranscribeResult(BaseModel):
    detected_language: str
    segments: list[SegmentResponse]


class TranslateSegmentInput(BaseModel):
    id: str
    text: str


class TranslateRequest(BaseModel):
    segments: list[TranslateSegmentInput]
    source_lang: str = "EN"
    target_lang: str = "DE"
    context_window: int = 3
    engine: str = "gemini"  # "gemini" or "deepl"


class TranslatedSegmentResponse(BaseModel):
    id: str
    original_text: str = ""
    translated_text: str = ""


class TranslateResult(BaseModel):
    translations: list[TranslatedSegmentResponse]
    chars_consumed: int = 0
    total_chars_remaining: int = 0


class ExportSubtitleRequest(BaseModel):
    segments: list[SegmentResponse]
    format: str = "srt"
    use_translation: bool = False
    output_path: str


class SubtitleStyle(BaseModel):
    font_family: str = "Arial"
    font_size: int = 24
    primary_color: str = "#FFFFFF"
    outline_color: str = "#000000"
    outline_width: int = 2
    position: str = "bottom"
    margin_v: int = 30
    bold: bool = False
    italic: bool = False
    background_color: str = "#000000"
    background_opacity: float = 0
    effect: str = "none"


class SubtitleImportRequest(BaseModel):
    file_path: str
    split_dual_language: bool = False


class TimingShiftRequest(BaseModel):
    segments: list["SegmentResponse"]
    shift_ms: float = 0
    fix_overlaps: bool = False


class ExportVideoRequest(BaseModel):
    video_path: str
    segments: list[SegmentResponse]
    subtitle_style: SubtitleStyle = SubtitleStyle()
    karaoke: bool = False
    use_translation: bool = False
    output_path: str
    video_codec: str = "h264"
    crf: int = 23


class EDLClip(BaseModel):
    source_start: float
    source_end: float


class RenderEDLRequest(BaseModel):
    video_path: str
    edl: list[EDLClip]
    output_path: str
    video_codec: str = "h264"
    crf: int = 23


class TrimVideoRequest(BaseModel):
    video_path: str
    start: float
    end: float
    output_path: str
    video_codec: str = "h264"
    crf: int = 23


class SceneDetectRequest(BaseModel):
    video_path: str
    threshold: float = 0.3
    min_scene_duration: float = 1.0


class SilenceDetectRequest(BaseModel):
    video_path: str
    noise_threshold: str = "-30dB"
    min_silence_duration: float = 0.5


class HighlightDetectRequest(BaseModel):
    segments: list["SegmentResponse"]
    max_highlights: int = 5
    min_clip_duration: float = 15.0
    max_clip_duration: float = 60.0
    context: str = ""


class VideoEffectsRequest(BaseModel):
    video_path: str
    output_path: str
    effects: dict  # brightness, contrast, saturation, blur, vignette, speed, volume, etc.


class BackgroundRemovalRequest(BaseModel):
    video_path: str
    output_path: str
    mode: str = "remove"  # "remove" | "blur" | "replace"
    bg_color: str = "#00FF00"
    bg_image_path: Optional[str] = None
    blur_strength: int = 21
    model_name: str = "u2net"


class DiarizeRequest(BaseModel):
    video_path: str
    segments: list["SegmentResponse"]
    num_speakers: int = 0


class AudioProcessRequest(BaseModel):
    video_path: str
    output_path: str
    audio_settings: dict


class ColorGradeRequest(BaseModel):
    video_path: str
    output_path: str
    grade_settings: dict


class TransitionRequest(BaseModel):
    clip_a_path: str
    clip_b_path: str
    output_path: str
    transition_type: str = "fade"
    duration: float = 1.0


class BRollSuggestRequest(BaseModel):
    segments: list["SegmentResponse"]
    max_suggestions: int = 5
    context: str = ""


class BRollSearchRequest(BaseModel):
    query: str
    per_page: int = 6


class BatchJobItem(BaseModel):
    video_path: str
    operations: list[str]  # e.g. ["transcribe", "translate", "export_srt"]
    target_language: str = "EN"
    export_format: str = "srt"


class BatchRequest(BaseModel):
    jobs: list[BatchJobItem]


class TaskResponse(BaseModel):
    task_id: str
