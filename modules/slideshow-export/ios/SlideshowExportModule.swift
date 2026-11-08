import ExpoModulesCore
import AVFoundation
import UIKit

struct ExportOptions: Record {
  @Field var imageUris: [String] = []
  @Field var secondsPerSlide: Double = 7
  @Field var transition: String = "fade"
  @Field var audioUris: [String] = []
  @Field var audioGain: Double = 0.8
  @Field var outputUri: String = ""
  @Field var watermark: String = ""
}

public class SlideshowExportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SlideshowExport")

    AsyncFunction("exportVideo") { (options: ExportOptions, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let url = try SlideshowExporter(options: options).run()
          promise.resolve(url.absoluteString)
        } catch {
          promise.reject("E_EXPORT", error.localizedDescription)
        }
      }
    }
  }
}

enum ExportError: LocalizedError {
  case noSlides
  case failed(String)

  var errorDescription: String? {
    switch self {
    case .noSlides: return "There are no slides to export."
    case .failed(let message): return message
    }
  }
}

// Renders each frame with Core Graphics (so fades/slides are exact and
// independent of what the app is showing) and muxes the music in a single
// AVAssetWriter pass: H.264 video + AAC audio into an MP4.
final class SlideshowExporter {
  private let options: ExportOptions
  private let width = 1080
  private let height = 1920
  private let fps = 30
  private var slideCache: [Int: CGImage] = [:]

  init(options: ExportOptions) {
    self.options = options
  }

  private func fileURL(_ string: String) -> URL {
    return URL(string: string) ?? URL(fileURLWithPath: string)
  }

  // Aspect-FITs the image (nothing cropped, black bars if the aspect differs)
  // into the video frame size once, so per-frame
  // drawing is just a cheap blit.
  private func slideImage(_ index: Int) -> CGImage? {
    if let cached = slideCache[index] { return cached }
    let url = fileURL(options.imageUris[index])
    guard let image = UIImage(contentsOfFile: url.path) else { return nil }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let size = CGSize(width: width, height: height)
    let rendered = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
      UIColor.black.setFill()
      ctx.fill(CGRect(origin: .zero, size: size))
      let scale = min(size.width / image.size.width, size.height / image.size.height)
      let w = image.size.width * scale
      let h = image.size.height * scale
      image.draw(in: CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h))
    }
    guard let cg = rendered.cgImage else { return nil }
    slideCache[index] = cg
    return cg
  }

  private func trimCache(keeping keep: Set<Int>) {
    for key in slideCache.keys where !keep.contains(key) {
      slideCache.removeValue(forKey: key)
    }
  }

  private func drawFrame(_ frame: Int, totalSlides: Int, into pixelBuffer: CVPixelBuffer) {
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard let ctx = CGContext(
      data: CVPixelBufferGetBaseAddress(pixelBuffer),
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
      space: CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { return }

    let w = CGFloat(width)
    let h = CGFloat(height)
    let rect = CGRect(x: 0, y: 0, width: w, height: h)
    ctx.setFillColor(UIColor.black.cgColor)
    ctx.fill(rect)

    let duration = options.secondsPerSlide
    let t = Double(frame) / Double(fps)
    let s = min(Int(t / duration), totalSlides - 1)
    let u = t - Double(s) * duration
    let transitionLength = min(1.2, duration * 0.4)

    var blend = 0.0
    if s < totalSlides - 1 && u > duration - transitionLength {
      let p = (u - (duration - transitionLength)) / transitionLength
      blend = p * p * (3 - 2 * p)
    }

    trimCache(keeping: [s, s + 1])
    let current = slideImage(s)

    if blend > 0, let next = slideImage(s + 1) {
      if options.transition == "slide" {
        let offset = CGFloat(blend) * w
        if let current = current {
          ctx.draw(current, in: rect.offsetBy(dx: -offset, dy: 0))
        }
        ctx.draw(next, in: rect.offsetBy(dx: w - offset, dy: 0))
      } else {
        if let current = current { ctx.draw(current, in: rect) }
        ctx.setAlpha(CGFloat(blend))
        ctx.draw(next, in: rect)
        ctx.setAlpha(1)
      }
    } else if let current = current {
      ctx.draw(current, in: rect)
    }

    drawWatermark(in: ctx)
  }

  private func drawWatermark(in ctx: CGContext) {
    let text = options.watermark
    if text.isEmpty { return }
    ctx.saveGState()
    // UIKit text drawing expects a top-left origin.
    ctx.translateBy(x: 0, y: CGFloat(height))
    ctx.scaleBy(x: 1, y: -1)
    UIGraphicsPushContext(ctx)

    let shadow = NSShadow()
    shadow.shadowColor = UIColor.black.withAlphaComponent(0.6)
    shadow.shadowBlurRadius = 6
    shadow.shadowOffset = CGSize(width: 0, height: 2)
    let font = UIFont(name: "Georgia-Italic", size: 34) ?? UIFont.italicSystemFont(ofSize: 34)
    let attributes: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: UIColor(white: 1, alpha: 0.8),
      .shadow: shadow,
    ]
    let string = NSAttributedString(string: text, attributes: attributes)
    let size = string.size()
    // Above Instagram/TikTok's bottom controls.
    string.draw(at: CGPoint(x: (CGFloat(width) - size.width) / 2, y: CGFloat(height) - 230))

    UIGraphicsPopContext()
    ctx.restoreGState()
  }

  // Music files played back to back and looped until the video ends, with a
  // short fade-in and a longer fade-out. nil when there is nothing playable.
  private func buildAudio(totalSeconds: Double) -> (AVMutableComposition, AVMutableAudioMix)? {
    let assets = options.audioUris
      .map { AVURLAsset(url: fileURL($0)) }
      .filter { $0.duration.seconds > 0 && !$0.tracks(withMediaType: .audio).isEmpty }
    if assets.isEmpty { return nil }

    let composition = AVMutableComposition()
    guard let track = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      return nil
    }

    let total = CMTime(seconds: totalSeconds, preferredTimescale: 600)
    var cursor = CMTime.zero
    var i = 0
    while cursor < total && i < 500 {
      let asset = assets[i % assets.count]
      let source = asset.tracks(withMediaType: .audio)[0]
      let length = min(asset.duration, total - cursor)
      try? track.insertTimeRange(CMTimeRange(start: .zero, duration: length), of: source, at: cursor)
      cursor = cursor + length
      i += 1
    }

    let gain = Float(max(0, min(1, options.audioGain)))
    let params = AVMutableAudioMixInputParameters(track: track)
    let fadeIn = min(1.0, totalSeconds / 4)
    let fadeOut = min(2.5, totalSeconds / 3)
    params.setVolumeRamp(
      fromStartVolume: 0, toEndVolume: gain,
      timeRange: CMTimeRange(start: .zero, duration: CMTime(seconds: fadeIn, preferredTimescale: 600))
    )
    params.setVolumeRamp(
      fromStartVolume: gain, toEndVolume: 0,
      timeRange: CMTimeRange(
        start: CMTime(seconds: totalSeconds - fadeOut, preferredTimescale: 600),
        duration: CMTime(seconds: fadeOut, preferredTimescale: 600)
      )
    )
    let mix = AVMutableAudioMix()
    mix.inputParameters = [params]
    return (composition, mix)
  }

  func run() throws -> URL {
    let slideCount = options.imageUris.count
    if slideCount == 0 { throw ExportError.noSlides }

    let outputURL = fileURL(options.outputUri)
    try? FileManager.default.removeItem(at: outputURL)
    try? FileManager.default.createDirectory(
      at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)

    let totalSeconds = Double(slideCount) * options.secondsPerSlide
    let totalFrames = Int((totalSeconds * Double(fps)).rounded())

    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

    let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      // Slides are mostly still pictures, so a low bitrate and a long gap
      // between full reference frames keep the file small (roughly 0.3 MB
      // per second) while text stays sharp. Cross-fades are the only motion.
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 2_500_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: 90,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoAllowFrameReorderingKey: true,
      ],
    ])
    videoInput.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: videoInput,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ]
    )
    writer.add(videoInput)

    var audioInput: AVAssetWriterInput?
    var audioReader: AVAssetReader?
    var audioOutput: AVAssetReaderAudioMixOutput?
    if let (composition, mix) = buildAudio(totalSeconds: totalSeconds) {
      let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVNumberOfChannelsKey: 2,
        AVSampleRateKey: 44100,
        AVEncoderBitRateKey: 128_000,
      ])
      input.expectsMediaDataInRealTime = false
      writer.add(input)
      audioInput = input

      let reader = try AVAssetReader(asset: composition)
      let output = AVAssetReaderAudioMixOutput(
        audioTracks: composition.tracks(withMediaType: .audio),
        audioSettings: [
          AVFormatIDKey: kAudioFormatLinearPCM,
          AVLinearPCMBitDepthKey: 16,
          AVLinearPCMIsFloatKey: false,
          AVLinearPCMIsBigEndianKey: false,
          AVLinearPCMIsNonInterleaved: false,
          AVSampleRateKey: 44100,
          AVNumberOfChannelsKey: 2,
        ]
      )
      output.audioMix = mix
      reader.add(output)
      audioReader = reader
      audioOutput = output
    }

    guard writer.startWriting() else {
      throw ExportError.failed(writer.error?.localizedDescription ?? "Could not start writing the video.")
    }
    writer.startSession(atSourceTime: .zero)
    audioReader?.startReading()

    let group = DispatchGroup()

    group.enter()
    var frame = 0
    videoInput.requestMediaDataWhenReady(on: DispatchQueue(label: "slideshow-export.video")) {
      while videoInput.isReadyForMoreMediaData {
        if frame >= totalFrames {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        var buffer: CVPixelBuffer?
        if let pool = adaptor.pixelBufferPool {
          CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
        }
        guard let pixelBuffer = buffer else {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        self.drawFrame(frame, totalSlides: slideCount, into: pixelBuffer)
        let time = CMTime(value: Int64(frame), timescale: Int32(self.fps))
        if !adaptor.append(pixelBuffer, withPresentationTime: time) {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        frame += 1
      }
    }

    if let audioInput = audioInput, let audioOutput = audioOutput {
      group.enter()
      audioInput.requestMediaDataWhenReady(on: DispatchQueue(label: "slideshow-export.audio")) {
        while audioInput.isReadyForMoreMediaData {
          if let sample = audioOutput.copyNextSampleBuffer() {
            if !audioInput.append(sample) {
              audioInput.markAsFinished()
              group.leave()
              return
            }
          } else {
            audioInput.markAsFinished()
            group.leave()
            return
          }
        }
      }
    }

    group.wait()

    let finished = DispatchSemaphore(value: 0)
    writer.finishWriting { finished.signal() }
    finished.wait()

    if writer.status != .completed {
      throw ExportError.failed(writer.error?.localizedDescription ?? "The video could not be written.")
    }
    return outputURL
  }
}
