#!/usr/bin/env python3
"""Generates docs/og-card.png, the 1200x630 social preview card.

    python3 tools/build-og-image.py

The page declared `twitter:card=summary_large_image` with no `og:image` at all, so every share on
Twitter/X, Slack, LinkedIn and iMessage unfurled as a blank or text-only card. This bakes one card
from the same facts data.js holds, so the preview says what the site is instead of nothing.

Committed as a PNG (SVG og:image is unreliable across unfurlers). Regenerate whenever the
masthead facts change; a test asserts the file exists and has the right dimensions.
"""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "og-card.png"
W, H = 1200, 630

# Site palette (docs/css/styles.css)
NAVY = (11, 37, 69)
CREAM = (244, 241, 234)
ACCENT = (91, 141, 199)
MUTED = (158, 173, 194)

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in (FONT_DIR / name, Path("/System/Library/Fonts") / name):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def data_fact(pattern: str, default: str) -> str:
    """Pull a scalar out of data.js so the card cannot drift from the site's own copy."""
    src = (ROOT / "docs" / "js" / "data.js").read_text(encoding="utf-8")
    m = re.search(pattern, src)
    return m.group(1) if m else default


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for w_ in words:
        trial = f"{line} {w_}".strip()
        if draw.textlength(trial, font=f) <= max_w:
            line = trial
        else:
            if line:
                lines.append(line)
            line = w_
    if line:
        lines.append(line)
    return lines


def main() -> None:
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)

    # accent rule down the left edge, echoing the site's masthead
    d.rectangle([0, 0, 14, H], fill=ACCENT)

    pad = 78
    y = 92

    eyebrow = font("Arial Bold.ttf", 25)
    d.text((pad, y), "FEDERAL ENERGY REGULATORY COMMISSION", font=eyebrow, fill=ACCENT)
    y += 56

    title_f = font("Georgia Bold.ttf", 82)
    for line in wrap(d, "Large Load Interconnection", title_f, W - pad * 2):
        d.text((pad, y), line, font=title_f, fill=CREAM)
        y += 92

    y += 12
    sub_f = font("Georgia.ttf", 34)
    subtitle = "Six tailored §206 show cause orders, and the record behind them"
    for line in wrap(d, subtitle, sub_f, W - pad * 2):
        d.text((pad, y), line, font=sub_f, fill=(214, 222, 233))
        y += 46

    # Facts strip, read out of data.js rather than retyped here.
    cite = data_fact(r'citeRange:\s*"([^"]+)"', "195 FERC ¶ 61,211 to 61,216")
    swept = data_fact(r'newsCapture:\s*"([^"]+)"', "")
    meta_f = font("Arial.ttf", 26)
    strip = f"Items E-7 to E-12  ·  Dockets EL26-67-000 to EL26-72-000  ·  {cite}"
    d.text((pad, H - 132), strip, font=meta_f, fill=MUTED)

    foot_f = font("Arial.ttf", 24)
    foot = "Independent analysis, not affiliated with FERC or DOE"
    if swept:
        foot += f"  ·  as of {swept}"
    d.text((pad, H - 88), foot, font=foot_f, fill=(126, 145, 170))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB, {W}x{H})")


if __name__ == "__main__":
    main()
