import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Anime, Episode } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { HeartIcon, PlayIcon } from './icons';

interface Props {
  anime: Anime;
}

export default function VideoCard({ anime }: Props) {
  const { user } = useAuth();
  const [fav, setFav] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (user) {
      api.toggleFavorite(anime.id).then(setFav).catch(() => {});
    }
    
    // Получаем первый эпизод для превью
    api.getSeasonEpisodes(anime.id).then(episodes => {
      if (episodes.length > 0) {
        setEpisode(episodes[0]);
      }
    }).catch(() => {});
  }, [user, anime.id]);

  useEffect(() => {
    // Проверяем наличие баннера
    if (anime.banner) {
      setBannerUrl(anime.banner);
    } else if (anime.poster) {
      setBannerUrl(anime.poster);
    } else {
      setBannerUrl('/images/logov.png');
    }
  }, [anime]);

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    try {
      const isFav = await api.toggleFavorite(anime.id);
      setFav(isFav);
    } catch {}
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (episode?.videoUrl) {
      // Задержка перед показом превью
      setTimeout(() => {
        if (isHovering) {
          setShowPreview(true);
        }
      }, 500);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setShowPreview(false);
  };

  return (
    <Link 
      to={`/anime/${anime.id}`} 
      className="group block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg sm:rounded-xl bg-zinc-100">
        {/* Основное изображение */}
        <img
          src={bannerUrl}
          alt={anime.title}
          loading="lazy"
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover transition-all duration-300 ${
            showPreview ? 'opacity-0 scale-110' : 'opacity-100 group-hover:scale-105'
          }`}
        />

        {/* Видео превью */}
        {showPreview && episode?.videoUrl && (
          <div className="absolute inset-0">
            <video
              src={episode.videoUrl}
              className="w-full h-full object-cover"
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <PlayIcon className="w-8 h-8 text-white ml-1" />
              </div>
            </div>
          </div>
        )}

        {imgError && !showPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-200">
            <span className="text-zinc-500 text-sm">Нет баннера</span>
          </div>
        )}

        {/* Рейтинг */}
        {anime.rating > 0 && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 z-10">
            ★ {(anime.rating).toFixed(1)}
          </div>
        )}

        {/* Статистика */}
        <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur text-white text-[10px] font-medium z-10">
          {anime.viewsCount > 0 ? (
            <>{anime.viewsCount.toLocaleString()} просмотров</>
          ) : (
            <>Новые</>
          )}
        </div>

        {user && (
          <button
            onClick={toggleFav}
            className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-black/60 text-white sm:opacity-0 backdrop-blur-md transition-all duration-300 hover:bg-black/80 group-hover:opacity-100"
            aria-label="В избранное"
          >
            <HeartIcon filled={fav} className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${fav ? 'text-pink-400' : ''}`} />
          </button>
        )}

        {/* Индикатор загрузки превью */}
        {isHovering && episode?.videoUrl && !showPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="mt-1.5 sm:mt-2 px-1">
        <h3 className="text-sm sm:text-base font-semibold text-zinc-900 line-clamp-2 leading-snug group-hover:text-zinc-600 transition">
          {anime.title}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-zinc-500">
          <span>{anime.year}</span>
          {anime.genres.length > 0 && (
            <>
              <span>·</span>
              <span className="truncate">{anime.genres.slice(0, 2).join(', ')}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}