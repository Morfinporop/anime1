import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useNotify } from '../notify';
import { api } from '../api';
import { blobToDataUrl, formatSize } from '../utils/videoCompress';
import type { Anime } from '../types';
import { CloseIcon, ChevronDownIcon, UploadIcon } from '../components/icons';

type UploadType = 'season' | 'single';
type Mode = 'new' | 'existing';

const GENRES = ['Экшен', 'Драма', 'Комедия', 'Фэнтези', 'Романтика', 'Приключения', 'Повседневность', 'Фантастика', 'Ужасы', 'Детектив'];

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();

  const [uploadType, setUploadType] = useState<UploadType>('season');

  // АНИМЕ
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | ''>('');
  const [mode, setMode] = useState<Mode>('new');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [ageRating, setAgeRating] = useState('12+');
  const [genres, setGenres] = useState<string[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [creatingAnime, setCreatingAnime] = useState(false);

  // СЕЗОН / СЕРИЯ
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);

  // СЕРИЯ — файлы
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioTracks, setAudioTracks] = useState<{ label: string; file?: File }[]>([]);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listAnime('newest').then(setAnimeList).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedAnimeId === '' || mode !== 'existing') return;
    api.getSeasons(Number(selectedAnimeId)).then(async ss => {
      if (ss.length === 0) {
        setSeasonNumber(1);
        setEpisodeNumber(1);
        return;
      }
      const last = ss[ss.length - 1];
      setSeasonNumber(last.season_number);
      setCurrentSeasonId(last.id);
      const eps = await api.getSeasonEpisodes(last.id);
      setEpisodeNumber(eps.length > 0 ? Math.max(...eps.map((e: any) => e.episode_number)) + 1 : 1);
    });
  }, [selectedAnimeId, mode]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_admin && !user.isAdmin && !user.can_upload && !user.canUpload) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <h1 className="text-display text-2xl text-zinc-900">Нет прав на загрузку</h1>
        <p className="mt-2 text-sm text-zinc-500">Свяжитесь с администратором.</p>
      </div>
    );
  }

  const handleBanner = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify.error('Превью должно быть изображением'); return; }
    if (file.size > 10 * 1024 * 1024) { notify.error('Превью слишком большое'); return; }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleVideo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { notify.error('Файл должен быть видео'); return; }
    if (file.size > 1024 * 1024 * 1024) { notify.error('Файл слишком большой (макс. 1 ГБ)'); return; }
    setVideoFile(file);
  };

  const resetForm = () => {
    setUploadType('season');
    setMode('new');
    setTitle('');
    setDescription('');
    setYear(new Date().getFullYear());
    setAgeRating('12+');
    setGenres([]);
    setBannerFile(null);
    setBannerPreview('');
    setSeasonNumber(1);
    setEpisodeNumber(1);
    setCurrentSeasonId(null);
    setVideoFile(null);
    setAudioTracks([]);
  };

  const handleAudio = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) { notify.error('Озвучка должна быть аудиофайлом'); return; }
    const label = file.name.replace(/\.[^.]+$/, '');
    setAudioTracks(prev => [...prev, { label, file }]);
  };

  const toggleGenre = (g: string) => {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const handleCreateAndUpload = async () => {
    // Валидация
    if (!bannerFile) { notify.error('Загрузите превью-баннер'); return; }
    if (!title.trim()) { notify.error('Введите название'); return; }
    if (!description.trim()) { notify.error('Введите описание'); return; }

    // Для одиночного - нужно видео сразу
    if (uploadType === 'single' && !videoFile) { notify.error('Выберите видеофайл'); return; }

    setBusy(true);
    try {
      const poster_data = await fileToDataUrl(bannerFile);
      
      // Создаём аниме
      const r = await api.uploadAnime({
        title: title.trim(),
        description: description.trim(),
        poster_data,
        poster_mime: bannerFile.type,
        banner_data: poster_data,
        banner_mime: bannerFile.type,
        genres, year, age_rating: ageRating, type: uploadType,
        voiceovers: audioTracks.map(a => a.label),
      });

      // Если есть видео - загружаем сразу (для одиночного или если сезонное с видео)
      if (videoFile) {
        const ss = await api.getSeasons(r.anime_id);
        let seasonId = currentSeasonId;
        
        if (!seasonId && ss.length > 0) {
          seasonId = ss[ss.length - 1].id;
        } else if (!seasonId) {
          // Создаём сезон
          const sr = await api.uploadSeason({ anime_id: r.anime_id, season_number: 1 });
          seasonId = sr.season_id;
        }

        const video_data = await fileToDataUrl(videoFile);

        // Конвертируем озвучки в data URL
        const audioTracksData: { label: string; url: string; lang: string }[] = [];
        for (const a of audioTracks) {
          if (a.file) {
            const url = await fileToDataUrl(a.file);
            audioTracksData.push({ label: a.label, url, lang: 'ru' });
          }
        }

        // Качество sources - для совместимости
        const quality_sources: Record<string, string> = {
          '720p': video_data
        };

        await api.uploadEpisode({
          season_id: seasonId,
          episode_number: uploadType === 'single' ? 1 : episodeNumber,
          title: '',
          video_data,
          video_mime: videoFile.type,
          size_bytes: videoFile.size,
          voiceovers: audioTracks.map(a => a.label),
          audio_tracks: audioTracksData,
          quality_sources,
        });

        notify.success('Аниме и серия опубликованы');
        setTimeout(() => navigate(`/anime/${r.anime_id}`), 800);
      } else {
        // Только создали аниме, без серии (сезонное)
        setSelectedAnimeId(r.anime_id);
        const ss = await api.getSeasons(r.anime_id);
        if (ss[0]) setCurrentSeasonId(ss[0].id);
        setAnimeList(await api.listAnime('newest'));
        notify.success('Аниме создано. Теперь можете добавить серию.');
      }
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const submitEpisode = async () => {
    if (!videoFile) { notify.error('Выберите видеофайл'); return; }
    setBusy(true);
    try {
      const video_data = await fileToDataUrl(videoFile);

      // Конвертируем озвучки в data URL
      const audioTracksData: { label: string; url: string; lang: string }[] = [];
      for (const a of audioTracks) {
        if (a.file) {
          const url = await fileToDataUrl(a.file);
          audioTracksData.push({ label: a.label, url, lang: 'ru' });
        }
      }

      // Находим или создаём сезон
      let seasonId = currentSeasonId;
      if (!seasonId) {
        const ss = await api.getSeasons(Number(selectedAnimeId));
        if (ss.length > 0) {
          seasonId = ss[ss.length - 1].id;
        } else {
          const sr = await api.uploadSeason({ anime_id: Number(selectedAnimeId), season_number: 1 });
          seasonId = sr.season_id;
        }
      }

      const quality_sources: Record<string, string> = {
        '720p': video_data
      };

      const r = await api.uploadEpisode({
        season_id: seasonId,
        episode_number: episodeNumber,
        title: '',
        video_data,
        video_mime: videoFile.type,
        size_bytes: videoFile.size,
        voiceovers: audioTracks.map(a => a.label),
        audio_tracks: audioTracksData,
        quality_sources,
      });

      notify.success('Серия опубликована');
      setTimeout(() => navigate(`/anime/${r.anime_id}`), 800);
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  // Проверяем, можем ли мы загрузить (для кнопки)
  const canUpload = bannerFile && title.trim() && description.trim() && !busy;
  const canUploadSingle = canUpload && videoFile && !busy;
  const canSubmitEpisode = selectedAnimeId !== '' && videoFile && !busy;

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 mb-1">
          <UploadIcon className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-900" />
          <h1 className="text-display text-2xl sm:text-3xl text-zinc-900">Загрузить аниме</h1>
        </div>
      </div>

      <div className="rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Тип */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Тип</label>
          <div className="flex bg-zinc-100 rounded-full p-1">
            <button type="button" onClick={() => setUploadType('season')}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${uploadType === 'season' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>
              Сезонное
            </button>
            <button type="button" onClick={() => { setUploadType('single'); setMode('new'); }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${uploadType === 'single' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>
              Одиночное
            </button>
          </div>
        </div>

        {uploadType === 'season' && (
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Что делаем</label>
            <div className="flex bg-zinc-100 rounded-full p-1">
              <button type="button" onClick={() => setMode('new')}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${mode === 'new' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>
                Новый тайтл
              </button>
              <button type="button" onClick={() => setMode('existing')}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${mode === 'existing' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>
                В существующий
              </button>
            </div>
          </div>
        )}

        {mode === 'existing' && uploadType === 'season' && (
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Тайтл</label>
            <div className="relative">
              <select value={selectedAnimeId} onChange={(e) => setSelectedAnimeId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm appearance-none pr-10">
                <option value="">— выберите —</option>
                {animeList.filter(a => a.type === 'season').map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        )}

        {(mode === 'new' || uploadType === 'single') && (
          <>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Название</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
                placeholder="Например: Сакура: Путь Весны" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Описание</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm resize-none"
                placeholder="О чём аниме..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Год</label>
                <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Возраст</label>
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
          </>
        )}

        {/* Превью */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Превью-баннер</label>
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
              <span className="text-xs font-medium">Выберите превью</span>
              <input type="file" accept="image/*" onChange={(e) => handleBanner(e.target.files?.[0])} className="hidden" />
            </label>
          )}
        </div>

        {/* Видео - показываем для одиночного или для сезонного в существующий */}
        {(uploadType === 'single' || (mode === 'existing' && uploadType === 'season')) && (
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Видеофайл (макс. 1 ГБ)</label>
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
        )}

        {/* Для сезонного нового - показываем видео после создания аниме */}
        {mode === 'new' && uploadType === 'season' && selectedAnimeId !== '' && (
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Видеофайл (макс. 1 ГБ)</label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Сезон</label>
                <input type="number" min={1} value={seasonNumber} onChange={(e) => setSeasonNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Серия</label>
                <input type="number" min={1} value={episodeNumber} onChange={(e) => setEpisodeNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm" />
              </div>
            </div>
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
        )}

        {/* Озвучка */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Озвучка (опционально)</label>
          <label className="w-full h-24 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition flex flex-col items-center justify-center gap-1 text-zinc-500 cursor-pointer">
            <UploadIcon className="w-5 h-5" />
            <span className="text-xs font-medium">Добавить озвучку (аудиофайл)</span>
            <input type="file" accept="audio/*" onChange={(e) => handleAudio(e.target.files?.[0])} className="hidden" />
          </label>
          {audioTracks.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {audioTracks.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                  <span className="flex-1 text-sm font-medium text-zinc-900">{a.label}</span>
                  <button onClick={() => setAudioTracks(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-1 rounded-full hover:bg-zinc-200">
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-2">
          <button onClick={resetForm} className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Очистить
          </button>
          
          {/* Логика кнопки: */}
          {/* 1. Для одиночного - одна кнопка создать и загрузить */}
          {uploadType === 'single' && (
            <button onClick={handleCreateAndUpload} disabled={!canUploadSingle}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {busy ? (
                <><div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />Загрузка...</>
              ) : (
                <>Загрузить аниме</>
              )}
            </button>
          )}
          
          {/* 2. Для сезонного нового - если аниме уже создано, показываем кнопку загрузки серии */}
          {mode === 'new' && uploadType === 'season' && selectedAnimeId !== '' && (
            <button onClick={submitEpisode} disabled={!canSubmitEpisode}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {busy ? (
                <><div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />Загрузка...</>
              ) : (
                <>Опубликовать серию</>
              )}
            </button>
          )}

          {/* 3. Для сезонного нового - если аниме ещё не создано */}
          {mode === 'new' && uploadType === 'season' && selectedAnimeId === '' && (
            <button onClick={handleCreateAndUpload} disabled={!canUpload}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {busy ? (
                <><div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />Создание...</>
              ) : (
                <>Создать аниме</>
              )}
            </button>
          )}

          {/* 4. Для сезонного в существующий - сразу загружаем серию */}
          {mode === 'existing' && uploadType === 'season' && (
            <button onClick={submitEpisode} disabled={!canSubmitEpisode}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {busy ? (
                <><div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />Загрузка...</>
              ) : (
                <>Опубликовать серию</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}