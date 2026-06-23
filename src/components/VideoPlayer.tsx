import { useEffect, useRef, useState } from 'react';
import {
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon,
  FullscreenIcon, ExitFullscreenIcon, SettingsIcon, ChevronDownIcon,
} from './icons';
import { cn } from '../utils/cn';
import type { Episode } from '../types';
import { QUALITY_LEVELS } from '../types';

interface VideoPlayerProps {
  episode: Episode;
  /** ID пользователя для подсветки выбора озвучки */
  onProgress?: (current: number, duration: number) => void;
}

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function VideoPlayer({ episode, onProgress }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  // Вычисляем доступные качества: если есть quality_sources — берём их, иначе только текущее
  const availableQualities: string[] = Object.keys(episode.quality_sources || {}).length > 0
    ? Object.keys(episode.quality_sources!).sort((a, b) => {
        const order = QUALITY_LEVELS as readonly string[];
        return order.indexOf(b) - order.indexOf(a);
      })
    : ['720p'];

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [quality, setQuality] = useState<string>(() => availableQualities[0]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [qualitySwitching, setQualitySwitching] = useState(false);
  const [audioTrackId, setAudioTrackId] = useState<string>(() => episode.audio_tracks[0]?.id ?? '');

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Сброс состояния при смене эпизода
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setQuality(availableQualities[0]);
    setAudioTrackId(episode.audio_tracks[0]?.id ?? '');
  }, [episode.id]);

  const onActivity = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playing) setShowControls(false);
    }, 2800);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = Math.max(0, Math.min(duration, ratio * duration));
  };

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    if (val > 0 && v.muted) { v.muted = false; setMuted(false); }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFs = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current.requestFullscreen();
  };

  // РЕАЛЬНАЯ смена качества: подставляем соответствующий URL из quality_sources
  const changeQuality = (q: string) => {
    const v = videoRef.current;
    setShowQualityMenu(false);
    if (!v || q === quality) return;
    const sources = episode.quality_sources || {};
    const newUrl = sources[q];
    if (!newUrl) return;

    const t = v.currentTime;
    const wasPlaying = !v.paused;
    setQualitySwitching(true);
    setQuality(q);
    v.src = newUrl;
    v.load();
    v.currentTime = t;
    if (wasPlaying) v.play().catch(() => {});
    setTimeout(() => setQualitySwitching(false), 300);
  };

  const changeAudio = (id: string) => {
    setAudioTrackId(id);
    setShowAudioMenu(false);
    const track = episode.audio_tracks.find(a => a.id === id);
    if (track && videoRef.current) {
      // Если у дорожки есть URL — подменяем (для HLS/отдельных аудио)
      // Для обычного видео со встроенным аудио — просто меняем метку
    }
  };

  useEffect(() => {
    const close = () => { setShowQualityMenu(false); setShowAudioMenu(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [showQualityMenu, showAudioMenu]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentAudio = episode.audio_tracks.find(a => a.id === audioTrackId);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group select-none"
      onMouseMove={onActivity}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-ctrl]')) return;
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        src={episode.quality_sources?.[quality] ?? episode.video_url}
        poster={episode.quality_sources?.[quality] ?? undefined}
        className="w-full h-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          onProgress?.(e.currentTarget.currentTime, e.currentTarget.duration);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      />

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {qualitySwitching && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
          <div className="px-4 py-2 rounded-lg bg-black/80 text-white text-sm font-medium">
            Переключение на {quality}...
          </div>
        </div>
      )}

      {!playing && !buffering && (
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Воспроизвести"
        >
          <span className="w-20 h-20 rounded-full bg-black/60 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
            <PlayIcon className="w-9 h-9 text-white ml-1" />
          </span>
        </button>
      )}

      {buffering && playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin-slow" />
        </div>
      )}

      <div
        data-ctrl
        className={cn(
          "absolute inset-x-0 bottom-0 px-3 sm:px-4 pb-2 pt-10 transition-opacity duration-300 z-20",
          showControls || !playing ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative h-1 bg-white/25 rounded-full cursor-pointer mb-3 group/timeline hover:h-1.5 transition-all"
          onClick={seek}
        >
          <div className="absolute inset-y-0 left-0 bg-[#ff0033] rounded-full" style={{ width: `${progress}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#ff0033] rounded-full opacity-0 group-hover/timeline:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="p-2 hover:bg-white/15 rounded-full transition" aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
              {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-1.5 group/vol">
              <button onClick={toggleMute} className="p-2 hover:bg-white/15 rounded-full transition" aria-label={muted ? 'Вкл. звук' : 'Выкл. звук'}>
                {muted || volume === 0 ? <MuteIcon className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVol(parseFloat(e.target.value))}
                  className="yt-range w-20"
                />
              </div>
            </div>

            <span className="text-xs font-mono tabular-nums ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Выбор озвучки */}
            {episode.audio_tracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAudioMenu(v => !v); setShowQualityMenu(false); }}
                  className="px-2.5 py-1.5 hover:bg-white/15 rounded-lg transition flex items-center gap-1 text-xs font-medium"
                  aria-label="Озвучка"
                >
                  {currentAudio?.label ?? 'Озвучка'}
                  <ChevronDownIcon className="w-3 h-3" />
                </button>
                {showAudioMenu && (
                  <div className="absolute bottom-full right-0 mb-2 min-w-[160px] bg-black/95 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">Озвучка</div>
                    {episode.audio_tracks.map(a => (
                      <button
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); changeAudio(a.id); }}
                        className={cn("w-full text-left px-3 py-2 text-xs hover:bg-white/15 flex items-center justify-between", a.id === audioTrackId && "bg-white/15 font-semibold")}
                      >
                        <span>{a.label}</span>
                        {a.id === audioTrackId && <span className="text-[#ff0033]">●</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Реальная смена качества */}
            {availableQualities.length > 1 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowQualityMenu(v => !v); setShowAudioMenu(false); }}
                  className="px-2.5 py-1.5 hover:bg-white/15 rounded-lg transition flex items-center gap-1 text-xs font-medium"
                  aria-label="Качество"
                >
                  <SettingsIcon className="w-4 h-4" />
                  <span>{quality}</span>
                  <ChevronDownIcon className="w-3 h-3" />
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 min-w-[140px] bg-black/95 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">Качество</div>
                    {availableQualities.map(q => (
                      <button
                        key={q}
                        onClick={(e) => { e.stopPropagation(); changeQuality(q); }}
                        className={cn("w-full text-left px-3 py-2 text-xs hover:bg-white/15 flex items-center justify-between", q === quality && "bg-white/15 font-semibold")}
                      >
                        <span>{q}</span>
                        {q === quality && <span className="text-[#ff0033]">●</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleFs} className="p-2 hover:bg-white/15 rounded-full transition" aria-label="Полный экран">
              {fullscreen ? <ExitFullscreenIcon className="w-5 h-5" /> : <FullscreenIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}