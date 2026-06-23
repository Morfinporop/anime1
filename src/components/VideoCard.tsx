import { Link } from 'react-router-dom';
import { StarIcon, HeartIcon } from './icons';
import type { Anime } from '../types';
import { store } from '../store';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';

interface VideoCardProps {
  anime: Anime;
}

export default function VideoCard({ anime }: VideoCardProps) {
  const { user } = useAuth();
  const [fav, setFav] = useState(false);
  const rating = store.avgRating(anime.id);

  useEffect(() => {
    if (user) setFav(store.isFavorite(user.id, anime.id));
  }, [user, anime.id]);

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    const newState = store.toggleFavorite(user.id, anime.id);
    setFav(newState);
  };

  return (
    <Link to={`/anime/${anime.id}`} className="group block">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-zinc-100">
        <img
          src={anime.banner}
          alt={anime.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Бейдж "Сезонное" слева вверху в черном полупрозрачном */}
        {anime.type === 'season' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[10px] font-semibold uppercase tracking-wider">
            Сезонное
          </div>
        )}
        {anime.type === 'single' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[10px] font-semibold uppercase tracking-wider">
            Одиночное
          </div>
        )}

        {rating > 0 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[11px] font-semibold flex items-center gap-1">
            <StarIcon filled className="w-3 h-3 text-yellow-400" />
            {rating.toFixed(1)}
          </div>
        )}

        {user && (
          <button
            onClick={toggleFav}
            className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-md transition-all duration-300 hover:bg-black/80 group-hover:opacity-100"
            aria-label="В избранное"
          >
            <HeartIcon filled={fav} className={`h-3.5 w-3.5 ${fav ? 'text-pink-400' : ''}`} />
          </button>
        )}
      </div>

      <div className="mt-2 px-1">
        <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug group-hover:text-zinc-600 transition">
          {anime.title}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
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