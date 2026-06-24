import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Settings, ChevronDown, Languages, Subtitles } from 'lucide-react';
import { cn } from '../utils/cn';
import type { Episode, AudioTrack, Subtitle } from '../types';

interface VideoPlayerProps {
  episode: Episode;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ episode }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [quality, setQuality] = useState('720p');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null);

  const videoSrc = episode.videoUrl || '';

  const availableQualities = ['360p', '480p', '720p', '1080p'];
  const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const audioTracks = episode.audioTracks || [];
  const subtitles = episode.subtitles || [];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      video.volume = volume;
      video.muted = isMuted;
      video.playbackRate = playbackRate;
      
      // Устанавливаем выбранную аудио дорожку
      if (selectedAudioTrack?.url && video.audioTracks && video.audioTracks.length > 0) {
        // В реальности нужно работать с аудио дорожками через audioTracks API
        // Но для простоты оставляем как есть
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleEnded = () => setIsPlaying(false);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [volume, isMuted, playbackRate, selectedAudioTrack]);

  useEffect(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }

    if (showControls && isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [showControls, isPlaying]);

  useEffect(() => {
    // Закрываем меню при клике вне их
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.video-settings-menu')) {
        setShowSettings(false);
        setShowAudioMenu(false);
        setShowSubtitleMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const time = percentage * duration;
    
    video.currentTime = Math.max(0, Math.min(time, duration));
  };

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = Math.max(0, Math.min(1, value));
    setVolume(newVolume);
    
    if (newVolume === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const changeQuality = (newQuality: string) => {
    setQuality(newQuality);
    setShowSettings(false);
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const selectAudioTrack = (track: AudioTrack) => {
    setSelectedAudioTrack(track);
    setShowAudioMenu(false);
    
    // В реальности здесь нужно переключать аудио дорожку в видео элементе
    console.log('Selected audio track:', track);
  };

  const selectSubtitle = (subtitle: Subtitle) => {
    setSelectedSubtitle(subtitle);
    setShowSubtitleMenu(false);
    
    // В реальности здесь нужно включать/выключать субтитры
    console.log('Selected subtitle:', subtitle);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg sm:rounded-xl overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) {
          setTimeout(() => setShowControls(false), 1000);
        }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.controls') || 
            (e.target as HTMLElement).closest('.video-settings-menu')) return;
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-contain"
        playsInline
        preload="metadata"
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Big play button when paused */}
      {!isPlaying && !isLoading && (
        <button
          className="absolute inset-0 flex items-center justify-center"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </button>
      )}

      {/* Bottom controls gradient */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 px-3 sm:px-4 pb-3 pt-12 transition-opacity duration-300 controls',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Progress bar */}
        <div
          className="relative h-1.5 mb-4 bg-white/30 rounded-full cursor-pointer group/progress"
          onClick={handleSeek}
        >
          <div
            className="absolute h-full bg-red-600 rounded-full"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute top-1/2 w-3 h-3 bg-red-600 rounded-full -translate-y-1/2 opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg"
               style={{ left: `calc(${progress}% - 6px)` }} />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              className="p-1.5 hover:bg-white/20 rounded-full transition"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            {/* Volume control */}
            <div className="flex items-center gap-1 group/volume">
              <button
                className="p-1.5 hover:bg-white/20 rounded-full transition"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-200">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24 accent-red-600"
                />
              </div>
            </div>

            {/* Time display */}
            <div className="text-xs font-mono ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio tracks menu */}
            {audioTracks.length > 0 && (
              <div className="relative video-settings-menu">
                <button
                  className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/20 rounded text-sm font-medium transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAudioMenu(!showAudioMenu);
                    setShowSettings(false);
                    setShowSubtitleMenu(false);
                  }}
                >
                  <Languages className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showAudioMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-black/95 rounded-lg shadow-xl border border-white/10 z-50 video-settings-menu">
                    <div className="px-3 py-2 border-b border-white/10">
                      <div className="text-xs font-medium text-white/70">Озвучка</div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {audioTracks.map((track) => (
                        <button
                          key={track.id}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm rounded hover:bg-white/10 transition flex items-center justify-between',
                            selectedAudioTrack?.id === track.id && 'bg-white/10 font-medium text-red-500'
                          )}
                          onClick={() => selectAudioTrack(track)}
                        >
                          <div className="flex flex-col items-start">
                            <span>{track.label}</span>
                            <span className="text-xs text-white/50">{track.language}</span>
                          </div>
                          {selectedAudioTrack?.id === track.id && (
                            <span className="text-red-500">●</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Subtitles menu */}
            {subtitles.length > 0 && (
              <div className="relative video-settings-menu">
                <button
                  className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/20 rounded text-sm font-medium transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSubtitleMenu(!showSubtitleMenu);
                    setShowSettings(false);
                    setShowAudioMenu(false);
                  }}
                >
                  <Subtitles className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showSubtitleMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-black/95 rounded-lg shadow-xl border border-white/10 z-50 video-settings-menu">
                    <div className="px-3 py-2 border-b border-white/10">
                      <div className="text-xs font-medium text-white/70">Субтитры</div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/10 transition flex items-center justify-between"
                        onClick={() => selectSubtitle(null)}
                      >
                        <span>Выключить</span>
                        {!selectedSubtitle && <span className="text-red-500">●</span>}
                      </button>
                      {subtitles.map((subtitle) => (
                        <button
                          key={subtitle.id}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm rounded hover:bg-white/10 transition flex items-center justify-between',
                            selectedSubtitle?.id === subtitle.id && 'bg-white/10 font-medium text-red-500'
                          )}
                          onClick={() => selectSubtitle(subtitle)}
                        >
                          <div className="flex flex-col items-start">
                            <span>{subtitle.label}</span>
                            <span className="text-xs text-white/50">{subtitle.language}</span>
                          </div>
                          {selectedSubtitle?.id === subtitle.id && (
                            <span className="text-red-500">●</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings menu */}
            <div className="relative video-settings-menu">
              <button
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/20 rounded text-sm font-medium transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                  setShowAudioMenu(false);
                  setShowSubtitleMenu(false);
                }}
              >
                <Settings className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>

              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-black/95 rounded-lg shadow-xl border border-white/10 z-50 video-settings-menu">
                  {/* Quality */}
                  <div className="px-3 py-2 border-b border-white/10">
                    <div className="text-xs font-medium text-white/70 mb-1">Качество</div>
                    <div className="space-y-1">
                      {availableQualities.map((q) => (
                        <button
                          key={q}
                          className={cn(
                            'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-white/10 transition',
                            quality === q && 'text-red-500 font-medium'
                          )}
                          onClick={() => changeQuality(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Playback speed */}
                  <div className="px-3 py-2">
                    <div className="text-xs font-medium text-white/70 mb-1">Скорость</div>
                    <div className="space-y-1">
                      {playbackRates.map((rate) => (
                        <button
                          key={rate}
                          className={cn(
                            'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-white/10 transition',
                            playbackRate === rate && 'text-red-500 font-medium'
                          )}
                          onClick={() => changePlaybackRate(rate)}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              className="p-1.5 hover:bg-white/20 rounded-full transition"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Custom styles for range input */}
      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 2px;
          background: #4a4a4a;
          outline: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: none;
        }
        
        .accent-red-600 {
          accent-color: #dc2626;
        }
      `}</style>
    </div>
  );
}