"""
Subtitle effects for ASS format.
Generates ASS override tags for fade, typewriter, and pop-in effects.
"""


def apply_effect(text: str, effect: str, duration_ms: int) -> str:
    """Apply ASS animation tags to subtitle text based on the effect type."""
    if effect == "fade":
        # Fade in 300ms, fade out 200ms
        return f"{{\\fad(300,200)}}{text}"
    elif effect == "typewriter":
        # Reveal one character at a time using \t and \clip
        # Calculate per-char duration
        char_count = len(text)
        if char_count == 0:
            return text
        per_char = max(30, min(duration_ms // char_count, 150))
        # Use alpha fade per character approximation
        # ASS doesn't natively support typewriter, use \k (karaoke) with syllable timing
        parts = []
        for i, ch in enumerate(text):
            # \k tag: duration in centiseconds
            cs = per_char // 10
            parts.append(f"{{\\k{cs}}}{ch}")
        return "".join(parts)
    elif effect == "pop":
        # Scale from 0 to 100 quickly, then settle
        return f"{{\\fscx0\\fscy0\\t(0,150,\\fscx110\\fscy110)\\t(150,250,\\fscx100\\fscy100)}}{text}"
    else:
        return text


def get_effect_duration_ms(start: float, end: float) -> int:
    """Get duration in milliseconds for effect calculations."""
    return max(0, int((end - start) * 1000))
