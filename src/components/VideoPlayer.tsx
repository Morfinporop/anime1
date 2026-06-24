import { useEffect, useRef, useState } from 'react';
import { videoUrl } from '../api';
import {
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon,
  FullscreenIcon, ExitFullscreenIcon, SettingsIcon, ChevronDownIcon,
} from './icons';
import { cn } from '../utils/cn';
import type { Episode } from '../types';

interface VideoPlayerProps {
  episode: Episode;
}

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function VideoPlayer({ episode }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const availableQualities: string[] = Object.keys(episode.quality_sources || {}).length > 0
    ? Object.keys(episode.quality_sources!)
    : ['720p'];

  const [playing, setPlaying] = useState(false);
  const [buffered, setBuffered] = useState(0);
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
  const [, setAudioTrack] = useState<string>('default');

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setQuality(availableQualities[0]);
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

  const onProgress = () => {
    const v = videoRef.current;
    if (!v || !v.buffered.length) return;
    const bufferedEnd = v.buffered.end(v.buffered.length - 1);
    const duration = v.duration || 1;
    setBuffered((bufferedEnd / duration) * 100);
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

  const changeQuality = (q: string) => {
    setShowQualityMenu(false);
    if (q === quality) return;
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    const wasPlaying = !v.paused;
    setQuality(q);
    v.src = videoUrl(episode.id, q);
    v.load();
    v.currentTime = t;
    if (wasPlaying) v.play().catch(() => {});
  };

  useEffect(() => {
    const close = () => { setShowQualityMenu(false); setShowAudioMenu(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const audioTracks = episode.voiceovers || [];

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg sm:rounded-2xl overflow-hidden group select-none"
      onMouseMove={onActivity}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-ctrl]')) return;
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl(episode.id, quality)}
        playsInline
        className="w-full h-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onProgress={onProgress}
      />

      <div className="absolute inset-x-0 bottom-0 h-20 sm:h-24 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {!playing && !buffering && (
        <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="absolute inset-0 flex items-center justify-center">
          <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
            <PlayIcon className="w-7 h-7 sm:w-9 sm:h-9 text-white ml-1" />
          </span>
        </button>
      )}

      {buffering && playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-white/20 border-t-white animate-spin-slow" />
        </div>
      )}

      <div
        data-ctrl
        className={cn(
          "absolute inset-x-0 bottom-0 px-2 sm:px-4 pb-2 pt-10 transition-opacity duration-300 z-20",
          showControls || !playing ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Timeline */}
        <div
          ref={progressRef}
          className="relative h-1.5 sm:h-2 bg-white/20 rounded-full cursor-pointer mb-3 sm:mb-4 group/timeline hover:h-2.5 sm:hover:h-3 transition-all"
          onClick={seek}
        >
          {/* Buffered */}
          <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${buffered}%` }} />
          {/* Progress */}
          <div className="absolute inset-y-0 left-0 bg-[#ff0033] rounded-full" style={{ width: `${progress}%` }} />
          {/* Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-[#ff0033] rounded-full opacity-0 group-hover/timeline:opacity-100 transition-opacity shadow-lg"
            style={{ left: `calc(${progress}% - 6px)` }} />
        </div>

        <div className="flex items-center justify-between text-white gap-1">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button onClick={togglePlay} className="p-1.5 sm:p-2 hover:bg-white/15 rounded-full transition shrink-0">
              {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>

            {/* Звук — на мобильном без слайдера */}
            <div className="hidden sm:flex items-center gap-1.5 group/vol">
              <button onClick={toggleMute} className="p-2 hover:bg-white/15 rounded-full transition">
                {muted || volume === 0 ? <MuteIcon className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                <input type="range" min={0} max={1} step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVol(parseFloat(e.target.value))}
                  className="yt-range w-20" />
              </div>
            </div>

            {/* На мобильном — только иконка mute */}
            <button onClick={toggleMute} className="sm:hidden p-1.5 hover:bg-white/15 rounded-full transition shrink-0">
              {muted || volume === 0 ? <MuteIcon className="w-4 h-4" /> : <VolumeIcon className="w-4 h-4" />}
            </button>

            <span className="text-[10px] sm:text-xs font-mono tabular-nums ml-1 truncate">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Озвучка */}
            {audioTracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAudioMenu(v => !v); setShowQualityMenu(false); }}
                  className="hidden sm:flex px-2.5 py-1.5 hover:bg-white/15 rounded-lg text-xs font-medium transition items-center gap-1">
                  {audioTracks[0]}
                  <ChevronDownIcon className="w-3 h-3" />
                </button>
                {showAudioMenu && (
                  <div className="absolute bottom-full right-0 mb-2 min-w-[140px] bg-black/95 rounded-lg overflow-hidden border border-white/10 z-30">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">Озвучка</div>
                    {audioTracks.map(a => (
                      <button key={a} onClick={(e) => { e.stopPropagation(); setAudioTrack(a); setShowAudioMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/15">{a}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Качество */}
            {availableQualities.length > 1 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowQualityMenu(v => !v); setShowAudioMenu(false); }}
                  className="px-2 sm:px-2.5 py-1 sm:py-1.5 hover:bg-white/15 rounded-lg transition flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-medium"
                >
                  <SettingsIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{quality}</span>
                  <ChevronDownIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 min-w-[120px] bg-black/95 rounded-lg overflow-hidden border border-white/10 z-30">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10">Качество</div>
                    {availableQualities.map(q => (
                      <button key={q} onClick={(e) => { e.stopPropagation(); changeQuality(q); }}
                        className={cn("w-full text-left px-3 py-2 text-xs hover:bg-white/15 flex items-center justify-between", q === quality && "bg-white/15 font-semibold")}>
                        <span>{q}</span>
                        {q === quality && <span className="text-[#ff0033]">●</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleFs} className="p-1.5 sm:p-2 hover:bg-white/15 rounded-full transition">
              {fullscreen ? <ExitFullscreenIcon className="w-5 h-5" /> : <FullscreenIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}