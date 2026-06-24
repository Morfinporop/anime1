import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useNotify } from '../notify';
import { api } from '../api';
import { formatSize } from '../utils/videoCompress';
import type { Anime } from '../types';
import { CloseIcon, ChevronDownIcon, UploadIcon } from '../components/icons';

const GENRES = ['Экшен', 'Драма', 'Комедия', 'Фэнтези', 'Романтика', 'Приключения', 'Повседневность', 'Фантастика', 'Ужасы', 'Детектив'];

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();

  // АНИМЕ
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [ageRating, setAgeRating] = useState('12+');
  const [genres, setGenres] = useState<string[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  
  // СЕЗОН / СЕРИЯ
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState('');

  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState<'anime' | 'season' | 'episode'>('anime');

  useEffect(() => {
    api.loadCatalog('new').then(setAnimeList).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedAnimeId === '') return;
    api.getSeasonEpisodes(Number(selectedAnimeId)).then(episodes => {
      if (episodes.length > 0) {
        const last = episodes[episodes.length - 1];
        setEpisodeNumber(last.episodeNumber + 1);
      } else {
        setEpisodeNumber(1);
      }
    }).catch(() => {});
  }, [selectedAnimeId]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.isAdmin && !user.canUpload) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <h1 className="text-display text-2xl text-zinc-900">Нет прав на загрузку</h1>
        <p className="mt-2 text-sm text-zinc-500">Свяжитесь с администратором.</p>
      </div>
    );
  }

  const handleBanner = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify.error('Баннер должен быть изображением'); return; }
    if (file.size > 10 * 1024 * 1024) { notify.error('Баннер слишком большой (макс. 10 МБ)'); return; }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handlePoster = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify.error('Постер должен быть изображением'); return; }
    if (file.size > 5 * 1024 * 1024) { notify.error('Постер слишком большой (макс. 5 МБ)'); return; }
    setPosterFile(file);
    setPosterPreview(URL.createObjectURL(file));
  };

  const handleVideo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { notify.error('Файл должен быть видео'); return; }
    if (file.size > 500 * 1024 * 1024) { 
      notify.error('Видео слишком большое (макс. 500 МБ). Используйте сжатие или выберите другой файл'); 
      return; 
    }
    setVideoFile(file);
  };

  const resetForm = () => {
    setSelectedAnimeId('');
    setTitle('');
    setDescription('');
    setYear(new Date().getFullYear());
    setAgeRating('12+');
    setGenres([]);
    setBannerFile(null);
    setBannerPreview('');
    setSeasonNumber(1);
    setEpisodeNumber(1);
    setEpisodeTitle('');
    setVideoFile(null);
    setPosterFile(null);
    setPosterPreview('');
    setStep('anime');
  };

  const toggleGenre = (g: string) => {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const createAnime = async () => {
    if (!title.trim()) { notify.error('Введите название аниме'); return; }
    if (!bannerFile) { notify.error('Загрузите баннер для аниме'); return; }

    setBusy(true);
    setUploadProgress(10);
    
    try {
      setUploadProgress(30);
      
      // Создаём аниме с баннером
      const animeId = await api.createAnime({
        title: title.trim(),
        description: description.trim() || '',
        year,
        ageRating,
        genres: genres.join(', '),
        banner: bannerFile,
        poster: bannerFile // Используем баннер и как постер если нет отдельного постера
      });

      setUploadProgress(100);
      notify.success('Аниме создано успешно!');
      
      setSelectedAnimeId(animeId);
      setStep('season');
      setUploadProgress(0);
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка создания аниме');
      setUploadProgress(0);
    } finally {
      setBusy(false);
    }
  };

  const createSeason = async () => {
    if (!selectedAnimeId) { notify.error('Сначала создайте аниме'); return; }

    setBusy(true);
    setUploadProgress(10);
    
    try {
      setUploadProgress(50);
      
      const seasonId = await api.createSeason({
        animeId: Number(selectedAnimeId),
        seasonNumber,
        description: `Сезон ${seasonNumber}`,
        poster: posterFile || bannerFile // Используем постер или баннер
      });

      setUploadProgress(100);
      notify.success(`Сезон ${seasonNumber} создан!`);
      
      setStep('episode');
      setUploadProgress(0);
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка создания сезона');
      setUploadProgress(0);
    } finally {
      setBusy(false);
    }
  };

  const uploadEpisode = async () => {
    if (!selectedAnimeId) { notify.error('Сначала создайте аниме'); return; }
    if (!videoFile) { notify.error('Выберите видеофайл'); return; }
    if (videoFile.size > 500 * 1024 * 1024) { 
      notify.error('Видео слишком большое (макс. 500 МБ). Используйте сжатие или выберите другой файл'); 
      return; 
    }

    setBusy(true);
    setUploadProgress(0);
    
    try {
      // Находим seasonId (создаем сезон если нужно)
      let seasonId = null;
      if (step === 'episode') {
        // Используем последний сезон
        const seasons = await api.getSeasonEpisodes(Number(selectedAnimeId));
        if (seasons.length > 0) {
          seasonId = seasons[0].seasonId; // Используем первый сезон
        }
      }

      if (!seasonId) {
        // Создаем сезон
        const newSeasonId = await api.createSeason({
          animeId: Number(selectedAnimeId),
          seasonNumber,
          description: `Сезон ${seasonNumber}`,
          poster: posterFile || bannerFile
        });
        seasonId = newSeasonId;
      }

      // Загружаем эпизод с прогрессом
      await api.uploadEpisode({
        seasonId,
        episodeNumber,
        title: episodeTitle || `Эпизод ${episodeNumber}`,
        video: videoFile,
        poster: posterFile,
        onProgress: (pct) => {
          setUploadProgress(pct);
        }
      });

      setUploadProgress(100);
      notify.success(`Эпизод ${episodeNumber} успешно загружен!`);
      
      setTimeout(() => navigate(`/anime/${selectedAnimeId}`), 800);
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка загрузки эпизода');
      setUploadProgress(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 mb-1">
          <UploadIcon className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-900" />
          <h1 className="text-display text-2xl sm:text-3xl text-zinc-900">Загрузить аниме</h1>
        </div>
        <p className="text-sm text-zinc-600 mt-2">
          Шаг {step === 'anime' ? '1' : step === 'season' ? '2' : '3'} из 3: {step === 'anime' ? 'Создание аниме' : step === 'season' ? 'Создание сезона' : 'Загрузка эпизода'}
        </p>
      </div>

      <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Шаг 1: Создание аниме */}
        {step === 'anime' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Название аниме *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
                placeholder="Например: Наруто" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Описание</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm resize-none"
                placeholder="Описание аниме..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Год выпуска</label>
                <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Возрастной рейтинг</label>
                <select value={ageRating} onChange={(e) => setAgeRating(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm">
                  <option>0+</option><option>6+</option><option>12+</option><option>16+</option><option>18+</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Жанры</label>
              <div className="flex flex-wrap gap-1.5">
                {GENRES.map(g => (
                  <button key={g} type="button" onClick={() => toggleGenre(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      genres.includes(g) ? 'bg-black text-white border-black' : 'bg-white text-zinc-700 border-zinc-200'
                    }`}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Баннер аниме * (макс. 10 МБ)</label>
              {bannerPreview ? (
                <div className="relative">
                  <img src={bannerPreview} alt="" className="rounded-xl max-h-48 w-full object-cover" />
                  <button onClick={() => { setBannerFile(null); setBannerPreview(''); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black">
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-full h-32 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition flex flex-col items-center justify-center gap-1 text-zinc-500 cursor-pointer">
                  <UploadIcon className="w-6 h-6" />
                  <span className="text-xs font-medium">Выберите баннер</span>
                  <input type="file" accept="image/*" onChange={(e) => handleBanner(e.target.files?.[0])} className="hidden" />
                </label>
              )}
            </div>
          </>
        )}

        {/* Шаг 2: Создание сезона */}
        {step === 'season' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Аниме</label>
              <div className="px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm">
                <span className="font-semibold">{title}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Номер сезона</label>
              <input type="number" min={1} value={seasonNumber} onChange={(e) => setSeasonNumber(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Постер сезона (опционально, макс. 5 МБ)</label>
              {posterPreview ? (
                <div className="relative">
                  <img src={posterPreview} alt="" className="rounded-xl max-h-48 w-full object-cover" />
                  <button onClick={() => { setPosterFile(null); setPosterPreview(''); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black">
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-full h-32 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition flex flex-col items-center justify-center gap-1 text-zinc-500 cursor-pointer">
                  <UploadIcon className="w-6 h-6" />
                  <span className="text-xs font-medium">Выберите постер сезона</span>
                  <input type="file" accept="image/*" onChange={(e) => handlePoster(e.target.files?.[0])} className="hidden" />
                </label>
              )}
            </div>
          </>
        )}

        {/* Шаг 3: Загрузка эпизода */}
        {step === 'episode' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Аниме</label>
              <div className="px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm">
                <span className="font-semibold">{title}</span> • Сезон {seasonNumber}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Номер эпизода</label>
                <input type="number" min={1} value={episodeNumber} onChange={(e) => setEpisodeNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Название эпизода</label>
                <input type="text" value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
                  placeholder={`Эпизод ${episodeNumber}`} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Видеофайл * (макс. 500 МБ)</label>
              {videoFile ? (
                <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <UploadIcon className="w-5 h-5 text-zinc-900" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-zinc-900 truncate">{videoFile.name}</div>
                    <div className="text-xs text-zinc-500">{formatSize(videoFile.size)}</div>
                  </div>
                  <button onClick={() => setVideoFile(null)}
                    className="p-1.5 rounded-full hover:bg-zinc-200">
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-full h-32 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition flex flex-col items-center justify-center gap-1 text-zinc-500 cursor-pointer">
                  <UploadIcon className="w-6 h-6" />
                  <span className="text-xs font-medium">Выберите видео</span>
                  <input type="file" accept="video/*" onChange={(e) => handleVideo(e.target.files?.[0])} className="hidden" />
                </label>
              )}
            </div>
          </>
        )}

        {/* Прогресс загрузки */}
        {busy && uploadProgress > 0 && (
          <div className="pt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-zinc-700">Загрузка...</span>
              <span className="font-semibold text-zinc-900">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {uploadProgress < 30 ? 'Подготовка файлов...' : 
               uploadProgress < 70 ? 'Отправка на сервер...' : 
               uploadProgress < 90 ? 'Сжатие видео...' : 
               'Финальная обработка...'}
            </p>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-2 pt-4">
          {step !== 'anime' && (
            <button onClick={() => setStep(step === 'episode' ? 'season' : 'anime')} 
              className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Назад
            </button>
          )}
          
          <button onClick={resetForm} 
            className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Очистить всё
          </button>
          
          {step === 'anime' && (
            <button onClick={createAnime} disabled={busy || !title.trim() || !bannerFile}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {busy ? (
                <><div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />Создание {uploadProgress}%...</>
              ) : (
                <>Создать аниме</>
              )}
            </button>
          )}
          
          {step === 'season' && (
            <button onClick={createSeason} disabled={busy}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {busy ? (
                <><div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />Создание сезона...</>
              ) : (
                <>Создать сезон</>
              )}
            </button>
          )}
          
          {step === 'episode' && (
            <button onClick={uploadEpisode} disabled={busy || !videoFile}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {busy ? (
                <><div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />Загрузка {uploadProgress}%...</>
              ) : (
                <>Загрузить эпизод</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}