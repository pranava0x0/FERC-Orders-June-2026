// Read text from a single image-backed PDF page. Called by extract.py on macOS.
import Foundation
import Vision

for path in CommandLine.arguments.dropFirst() {
    let request = VNRecognizeTextRequest()
    request.revision = VNRecognizeTextRequestRevision3
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
    let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    try lines.joined(separator: "\n").write(toFile: path + ".txt", atomically: true, encoding: .utf8)
}
