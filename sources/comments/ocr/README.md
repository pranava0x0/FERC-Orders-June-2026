# Reading the four scanned RM26-4 comments

These are machine transcriptions of the original filings. The PDFs in `sources/comments/files/` remain the authority for wording, names and signatures. The four older extracts beside those PDFs reproduce the original text layer; for these filings it is empty or nearly empty. Each OCR sidecar preserves the physical page breaks and identifies the source PDF by path and SHA-256. OCR can misread letters, numbers and quotations.

| Filer | Filing | Pages | OCR text |
| --- | --- | ---: | --- |
| Confederated Tribes and Bands of the Yakama Nation | [Comments, Nov. 21](https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5140) | 3 | [20251121-5140.txt](20251121-5140.txt) |
| Oklahoma Corporation Commission and Oklahoma Attorney General | [Initial comments, Nov. 21](https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5224) | 11 | [20251121-5224.txt](20251121-5224.txt) |
| Data Center Coalition | [Comments, Nov. 21](https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251121-5521) | 14 | [20251121-5521.txt](20251121-5521.txt) |
| Oklahoma Attorney General and Oklahoma Corporation Commission | [Reply comments, Dec. 5](https://elibrary.ferc.gov/eLibrary/filelist?accession_Number=20251205-5005) | 4 | [20251205-5005.txt](20251205-5005.txt) |

From the repository root, run `python3 tools/revalidate-archive.py --check` to compare the archive against its saved report. For one filing, use e.g. `python3 tools/revalidate-archive.py --comment 20251121-5521`; this also checks each attachment and available summary under that accession. To rerun recognition and compare the text itself, use `python3 tools/revalidate-archive.py --check-ocr` on macOS with Swift, Vision and PyMuPDF. This also rechecks the separate printed Senate hearing's OCR. `--write-ocr` rebuilds only these four sidecars; compare against the scanned pages before accepting changes. After reviewed updates, `--write` regenerates the archival checksums and coverage report.
