// OCR a scanned PDF with macOS Vision and print its text as "--- PAGE n ---" blocks.
// Usage: swift tools/ocr-pdf.swift FILE.pdf > out.txt
// Used by tools/ingest-record-tier.py for filings whose PDF has no text layer. macOS only.
import Foundation
import PDFKit
import Vision

guard CommandLine.arguments.count == 2, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
    FileHandle.standardError.write("usage: swift tools/ocr-pdf.swift FILE.pdf\n".data(using: .utf8)!)
    exit(2)
}
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { exit(1) }
    let box = page.bounds(for: .mediaBox)
    let scale: CGFloat = 300 / 72
    let image = page.thumbnail(of: CGSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
    guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: cg).perform([request])
    let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    print("--- PAGE \(i + 1) ---\n" + lines.joined(separator: "\n"))
}
