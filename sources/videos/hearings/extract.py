"""Rebuild a GPO hearing text layer. Image inserts require macOS Vision revision 3 and Swift."""
import argparse
import json
import logging
from pathlib import Path
import subprocess
import tempfile

import fitz

HERE = Path(__file__).resolve().parent


def extract(path: Path, check: bool) -> None:
    with tempfile.TemporaryDirectory() as tmp, fitz.open(path) as doc:
        scratch = Path(tmp)
        images = {}
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text().strip()
            pages.append(text)
            # GPO prints page numbers on otherwise scanned pages. Do not mistake them for testimony.
            if len(text) < 120 and page.get_images():
                image = scratch / f"{i:03d}.png"
                page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csGRAY).save(image)
                images[i] = image
        if images:
            program = scratch / "recognize"
            subprocess.run(["swiftc", str(HERE / "recognize.swift"), "-o", str(program)], check=True)
            subprocess.run([str(program), *map(str, images.values())], check=True)
            for i, image in images.items():
                ocr = Path(str(image) + ".txt").read_text().strip()
                if len(ocr) > len(pages[i]):
                    pages[i] = ocr
        body = "".join(f"--- PAGE {i+1} ---\n{text}\n\n" for i, text in enumerate(pages))
        output = path.with_suffix(".txt")
        if check:
            if output.read_text() != body:
                raise ValueError(f"{output}: differs from current extraction")
        else:
            output.write_text(body)
        logging.info("%s: %s pages, inspected %s image pages (Vision revision 3)", path.name, len(pages), len(images))


if __name__ == "__main__":
    arg = argparse.ArgumentParser(description=__doc__)
    arg.add_argument("--check", action="store_true")
    arg.add_argument("--pdf", type=Path, action="append", help="Also usable on filings with scanned inserts; writes a sibling .txt")
    args = arg.parse_args()
    logging.basicConfig(level=logging.INFO)
    paths = args.pdf or [HERE / h["filename"] for h in json.loads((HERE / "manifest.json").read_text())]
    for path in paths:
        extract(path, args.check)
