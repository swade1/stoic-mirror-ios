import { requireNativeModule } from 'expo-modules-core';

export interface ExportVideoOptions {
  // file:// URIs of the slide images, in order.
  imageUris: string[];
  secondsPerSlide: number;
  transition: 'fade' | 'slide';
  // file:// URIs of the music files, played in order and looped to fit.
  audioUris: string[];
  // 0..1 gain applied to the music.
  audioGain: number;
  // file:// URI the MP4 is written to (replaced if it exists).
  outputUri: string;
  // Small text drawn near the bottom of every frame ('' for none).
  watermark: string;
}

const SlideshowExport = requireNativeModule('SlideshowExport');

// Resolves with the file:// URI of the finished MP4.
export function exportVideo(options: ExportVideoOptions): Promise<string> {
  return SlideshowExport.exportVideo(options);
}
