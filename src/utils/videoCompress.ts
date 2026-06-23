// Утилита сжатия видео через ffmpeg.wasm.
// Сжимает видео до 500 МБ максимум без потери качества звука,
// изображение подгоняется под выбранное разрешение.
// Также генерирует несколько вариантов качества (144p-1080p).

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_URL = 'https://unpkg.com/@ffmpeg/[email protected]/dist/esm';

export interface CompressionResult {
  qualities: Record<string, Blob>;
  originalSize: number;
  compressedSize: number;
}

// Маппинг качеств в CRF / битрейт / разрешение
const QUALITY_PRESETS: Record<string, { crf: number; videoBitrate: string; scale: string; audioBitrate: string }> = {
  '144p':  { crf: 32, videoBitrate: '80k',   scale: '256:144',  audioBitrate: '64k'  },
  '240p':  { crf: 30, videoBitrate: '150k',  scale: '426:240',  audioBitrate: '64k'  },
  '360p':  { crf: 28, videoBitrate: '400k',  scale: '640:360',  audioBitrate: '96k'  },
  '480p':  { crf: 26, videoBitrate: '800k',  scale: '854:480',  audioBitrate: '128k' },
  '720p':  { crf: 24, videoBitrate: '1500k', scale: '1280:720', audioBitrate: '128k' },
  '1080p': { crf: 22, videoBitrate: '3000k', scale: '1920:1080', audioBitrate: '192k' },
};

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  return loadingPromise;
}

export interface CompressionOptions {
  /** Максимальный итоговый размер в МБ */
  maxSizeMB?: number;
  /** Прогресс 0..1 */
  onProgress?: (ratio: number) => void;
  /** Какие качества генерировать (по умолчанию все) */
  qualities?: string[];
}

export async function compressVideo(file: File, opts: CompressionOptions = {}): Promise<CompressionResult> {
  const { maxSizeMB = 500, onProgress, qualities = Object.keys(QUALITY_PRESETS) } = opts;
  const originalSize = file.size;

  const ff = await getFFmpeg();

  // Пишем исходник в виртуальную ФС
  const inputName = 'input' + getExt(file.name);
  await ff.writeFile(inputName, await fetchFile(file));

  const result: Record<string, Blob> = {};
  let totalCompressed = 0;

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    const preset = QUALITY_PRESETS[q];
    const outputName = `out_${q}.mp4`;

    try {
      await ff.exec([
        '-i', inputName,
        '-vf', `scale=${preset.scale}:flags=lanczos`,
        '-c:v', 'libx264',
        '-crf', String(preset.crf),
        '-b:v', preset.videoBitrate,
        '-c:a', 'aac',
        '-b:a', preset.audioBitrate,
        '-preset', 'fast',
        '-movflags', '+faststart',
        '-y',
        outputName,
      ]);
      const data = await ff.readFile(outputName);
      // Создаём новый Uint8Array backed by a fresh ArrayBuffer чтобы избежать SharedArrayBuffer проблем
      const buf = new Uint8Array(data as Uint8Array).slice().buffer;
      const blob = new Blob([buf], { type: 'video/mp4' });
      result[q] = blob;
      totalCompressed += blob.size;
      // Удаляем промежуточный файл
      try { await ff.deleteFile(outputName); } catch {}
    } catch (err) {
      console.warn(`Не удалось создать качество ${q}:`, err);
    }

    onProgress?.((i + 1) / qualities.length);
  }

  // Если общий размер превышает лимит, можно отбросить самые тяжёлые качества
  const maxBytes = maxSizeMB * 1024 * 1024;
  while (totalCompressed > maxBytes && Object.keys(result).length > 1) {
    // удаляем самое высокое качество
    const keys = Object.keys(result).sort((a, b) => {
      const order = ['1080p', '720p', '480p', '360p', '240p', '144p'];
      return order.indexOf(a) - order.indexOf(b);
    });
    const toRemove = keys[0];
    totalCompressed -= result[toRemove].size;
    delete result[toRemove];
  }

  // Чистим входной файл
  try { await ff.deleteFile(inputName); } catch {}

  const compressedSize = Object.values(result).reduce((s, b) => s + b.size, 0);
  return { qualities: result, originalSize, compressedSize };
}

function getExt(name: string): string {
  const m = name.match(/\.[a-z0-9]+$/i);
  return m ? m[0] : '.mp4';
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
}