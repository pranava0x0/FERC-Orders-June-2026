// Regenerate page-separated OCR for image-only PDF exhibits. Requires macOS PDFKit and Vision.
// swift tools/ocr-filing-exhibits.swift original.pdf > exhibit.ocr.txt
import Foundation
import PDFKit
import Vision
guard CommandLine.arguments.count == 2,
      let document = PDFDocument(url:URL(fileURLWithPath:CommandLine.arguments[1])) else { exit(2) }
for index in 0..<document.pageCount {
    guard let page = document.page(at:index) else { exit(1) }
    let rect = page.bounds(for:.mediaBox)
    let factor = min(3.0, 3600 / max(rect.width,rect.height))
    let image = page.thumbnail(of:CGSize(width:rect.width*factor,height:rect.height*factor),for:.mediaBox)
    guard let cg = image.cgImage(forProposedRect:nil, context:nil, hints:nil) else { exit(1) }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    request.revision = VNRecognizeTextRequestRevision3
    do { try VNImageRequestHandler(cgImage:cg,options:[:]).perform([request]) } catch { fputs("Vision failed: \(error)\n",stderr); exit(1) }
    print("--- PAGE \(index + 1) ---")
    for result in request.results ?? [] { if let line = result.topCandidates(1).first { print(line.string) } }
}
