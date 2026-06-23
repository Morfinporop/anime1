import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Anime } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { bannerUrl, FALLBACK_BANNER } from '../hooks';
import { StarIcon, HeartIcon } from './icons';

interface Props {
  anime: Anime;
}

export default function VideoCard({ anime }: Props) {
  const { user } = useAuth();
  const [fav, setFav] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (user) {
      api.isFavorite(anime.id).then(setFav).catch(() => {});
    }
  }, [user, anime.id]);

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    try {
      if (fav) { await api.removeFavorite(anime.id); setFav(false); }
      else { await api.addFavorite(anime.id); setFav(true); }
    } catch {}
  };

  const src = imgError ? FALLBACK_BANNER : bannerUrl(anime.id);

  return (
    <Link to={`/anime/${anime.id}`} className="group block">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg sm:rounded-xl bg-zinc-100">
        <img
          src={src}
          alt={anime.title}
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Бейджи — на мобильных чуть меньше */}
        {anime.type === 'season' && (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider">
            Сезонное
          </div>
        )}
        {anime.type === 'single' && (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider">
            Одиночное
          </div>
        )}

        {(anime.rating ?? 0) > 0 && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[10px] sm:text-[11px] font-semibold flex items-center gap-1">
            <StarIcon filled className="w-3 h-3 text-yellow-400" />
            {(anime.rating ?? 0).toFixed(1)}
          </div>
        )}

        {user && (
          <button
            onClick={toggleFav}
            className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-black/60 text-white sm:opacity-0 backdrop-blur-md transition-all duration-300 hover:bg-black/80 group-hover:opacity-100"
            aria-label="В избранное"
          >
            <HeartIcon filled={fav} className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${fav ? 'text-pink-400' : ''}`} />
          </button>
        )}
      </div>

      <div className="mt-1.5 sm:mt-2 px-1">
        <h3 className="text-xs xs:text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug group-hover:text-zinc-600 transition">
          {anime.title}
        </h3>
        <div className="mt-0.5 sm:mt-1 hidden xs:flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-500">
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