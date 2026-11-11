#!/usr/bin/env python3
"""Resolve local links and fragment targets from the public filing archive as served on a Pages subpath."""
from __future__ import annotations
from html.parser import HTMLParser
import logging
from pathlib import Path
from urllib.parse import unquote, urlsplit
from functools import lru_cache

ROOT = (Path(__file__).resolve().parents[1] / "docs").resolve()


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.refs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str,str | None]]) -> None:
        d = dict(attrs)
        if d.get("id"):
            if d["id"] in self.ids:
                raise ValueError("Duplicate anchor: " + d["id"])
            self.ids.add(d["id"])
        if tag in ("a", "link") and d.get("href"):
            self.refs.append(d["href"])


@lru_cache(maxsize=None)
def parse(path: Path) -> Links:
    links = Links()
    links.feed(path.read_text(encoding="utf-8"))
    return links


def main() -> None:
    pages = sorted((ROOT / "reading").rglob("*.html"))
    if not pages:
        raise ValueError("No pages in archive")
    checked = 0
    for page in pages:
        for ref in parse(page).refs:
            u = urlsplit(ref)
            if u.scheme or u.netloc:
                continue
            path = (page.parent / unquote(u.path)).resolve() if u.path else page
            if path.is_dir():
                path /= "index.html"
            if not path.is_relative_to(ROOT) or not path.is_file():
                raise ValueError(f"{page.relative_to(ROOT)}: broken link {ref}")
            if u.fragment and path.suffix == ".html" and path != ROOT / "index.html" and unquote(u.fragment) not in parse(path).ids:
                raise ValueError(f"{page.relative_to(ROOT)}: unknown target {ref}")
            checked += 1
    logging.warning("%d archive pages; %d local file and fragment links verified", len(pages), checked)


if __name__ == "__main__":
    main()
