// Утилита для работы с видео.
// Сжатие на клиенте отключено - видео загружается как есть.

export interface CompressionResult {
  qualities: Record<string, Blob>;
  originalSize: number;
  compressedSize: number;
}

export interface CompressionOptions {
  maxSizeMB?: number;
  onProgress?: (ratio: number) => void;
  qualities?: string[];
}

// Заглушка - возвращает видео как есть без сжатия
export async function compressVideo(file: File, opts: CompressionOptions = {}): Promise<CompressionResult> {
  const { onProgress } = opts;
  
  // Просто возвращаем файл как есть без сжатия
  if (onProgress) {
    onProgress(0.3);
  }
  
  const result: Record<string, Blob> = {
    'original': file
  };
  
  if (onProgress) {
    onProgress(1);
  }
  
  return {
    qualities: result,
    originalSize: file.size,
    compressedSize: file.size,
  };
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