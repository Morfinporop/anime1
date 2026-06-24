import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Anime } from '../types';
import { getBannerUrl } from '../hooks';

interface RecommendationsProps {
  currentAnimeId: number;
  maxItems?: number;
}

export function Recommendations({ currentAnimeId, maxItems = 6 }: RecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerUrls, setBannerUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    const loadRecommendations = async () => {
      setLoading(true);
      try {
        // Сначала получаем текущее аниме
        const currentAnime = await api.getAnimeById(currentAnimeId);
        if (!currentAnime) {
          setLoading(false);
          return;
        }

        // Получаем весь каталог
        const allAnime = await api.loadCatalog('popular');
        
        // Фильтруем по жанрам и рейтингу
        const similarGenres = currentAnime.genres || [];
        const recommendationsList = allAnime
          .filter(anime => anime.id !== currentAnimeId) // Исключаем текущее
          .map(anime => {
            // Считаем схожесть по жанрам
            const genreMatch = anime.genres
              ? anime.genres.filter(g => similarGenres.includes(g)).length
              : 0;
            
            // Считаем схожесть по рейтингу
            const ratingScore = anime.rating || 0;
            const ratingMatch = ratingScore > 7 ? 2 : ratingScore > 5 ? 1 : 0;
            
            // Популярность
            const popularityScore = anime.viewsCount ? Math.log10(anime.viewsCount + 1) : 0;
            
            // Общий скор
            const totalScore = (genreMatch * 3) + ratingMatch + (popularityScore * 0.5);
            
            return {
              ...anime,
              score: totalScore
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, maxItems)
          .map(({ score, ...anime }) => anime); // Убираем score из результата

        setRecommendations(recommendationsList);

        // Загружаем баннеры для рекомендаций
        const bannerPromises = recommendationsList.map(async (anime) => {
          const bannerUrl = await getBannerUrl(anime.banner, anime.poster);
          return { id: anime.id, bannerUrl };
        });

        const banners = await Promise.all(bannerPromises);
        const bannerMap = banners.reduce((acc, { id, bannerUrl }) => {
          acc[id] = bannerUrl;
          return acc;
        }, {} as Record<number, string>);

        setBannerUrls(bannerMap);
      } catch (error) {
        console.error('Error loading recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, [currentAnimeId, maxItems]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: maxItems }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] bg-zinc-200 rounded-lg sm:rounded-xl" />
            <div className="mt-2 h-4 bg-zinc-200 rounded" />
            <div className="mt-1 h-3 bg-zinc-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">Пока нет рекомендаций</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-zinc-900 text-lg mb-4">Рекомендуем посмотреть</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
        {recommendations.map(anime => (
          <Link
            key={anime.id}
            to={`/anime/${anime.id}`}
            className="group block hover:opacity-90 transition-opacity"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg sm:rounded-xl bg-zinc-100">
              <img
                src={bannerUrls[anime.id] || '/images/logov.png'}
                alt={anime.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              
              {/* Рейтинг */}
              {anime.rating > 0 && (
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[10px] font-semibold">
                  ★ {anime.rating.toFixed(1)}
                </div>
              )}
            </div>
            
            <div className="mt-1.5 sm:mt-2">
              <h4 className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug">
                {anime.title}
              </h4>
              <div className="mt-1 text-xs text-zinc-500">
                {anime.year} · {anime.genres?.slice(0, 1).join(', ')}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}