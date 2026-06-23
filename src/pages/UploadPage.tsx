import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { fileToDataUrl, store } from '../store';
import { compressVideo, blobToDataUrl, formatSize, type CompressionResult } from '../utils/videoCompress';
import type { Anime } from '../types';
import { ChevronDownIcon, CloseIcon, UploadIcon } from '../components/icons';

type UploadType = 'season' | 'single';
type Mode = 'new' | 'existing';

const GENRES = ['Экшен', 'Драма', 'Комедия', 'Фэнтези', 'Романтика', 'Приключения', 'Повседневность', 'Фантастика', 'Ужасы', 'Детектив'];

export default function UploadPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // СТЕПЫ
  const [step, setStep] = useState<'anime' | 'episode'>('anime');
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
  const [bannerData, setBannerData] = useState('');
  const [bannerName, setBannerName] = useState('');
  const [creatingAnime, setCreatingAnime] = useState(false);

  // СЕЗОН / СЕРИЯ
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);

  // СЕРИЯ — файлы
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeDesc, setEpisodeDesc] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioTracks, setAudioTracks] = useState<{ id: string; label: string; url: string; lang: string }[]>([]);
  const [audioLabel, setAudioLabel] = useState('');

  // СЖАТИЕ
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [selectedQualities, setSelectedQualities] = useState<string[]>(['360p', '720p', '1080p']);

  // ОБЩЕЕ
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setAnimeList(store.listAnime('newest', null));
  }, []);

  useEffect(() => {
    if (selectedAnimeId === '' || mode !== 'existing') return;
    const eps = store.listEpisodes(Number(selectedAnimeId));
    if (eps.length > 0) {
      const maxSeason = Math.max(...eps.map(e => e.season));
      setSeasonNumber(maxSeason);
      const seasonEps = eps.filter(e => e.season === maxSeason);
      setEpisodeNumber(Math.max(...seasonEps.map(e => e.episode_number)) + 1);
    } else {
      setSeasonNumber(1);
      setEpisodeNumber(1);
    }
  }, [selectedAnimeId, mode]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== 'admin' && !user.can_upload) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <h1 className="text-display text-2xl text-zinc-900">Нет прав на загрузку</h1>
        <p className="mt-2 text-sm text-zinc-500">Свяжитесь с администратором для получения доступа.</p>
      </div>
    );
  }

  

  const handleBanner = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Превью должно быть изображением'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Превью слишком большое (макс. 10 МБ)'); return; }
    setBannerName(file.name);
    setBannerData(await fileToDataUrl(file));
  };

  const handleVideo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { setError('Файл должен быть видео'); return; }
    if (file.size > 1024 * 1024 * 1024) { setError('Файл слишком большой (макс. 1 ГБ)'); return; }
    setVideoFile(file);
    setCompressionResult(null);
    setCompressionProgress(0);
  };

  const handleAudio = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) { setError('Озвучка должна быть аудиофайлом'); return; }
    const url = await fileToDataUrl(file);
    const label = file.name.replace(/\.[^.]+$/, '');
    setAudioTracks(prev => [...prev, { id: 'a' + Date.now() + prev.length, label, url, lang: 'ru' }]);
    if (!audioLabel) setAudioLabel(label);
  };

  const startCompression = async () => {
    if (!videoFile) { setError('Сначала выберите видеофайл'); return; }
    setCompressing(true);
    setCompressionProgress(0);
    setError('');
    try {
      const result = await compressVideo(videoFile, {
        maxSizeMB: 500,
        onProgress: setCompressionProgress,
        qualities: selectedQualities,
      });
      setCompressionResult(result);
    } catch (err: any) {
      setError('Ошибка сжатия: ' + (err.message ?? 'неизвестно'));
    } finally {
      setCompressing(false);
    }
  };

  const toggleGenre = (g: string) => {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const toggleQuality = (q: string) => {
    setSelectedQualities(prev =>
      prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q]
    );
  };

  const handleCreateAnimeAndContinue = async () => {
    setError('');
    if (!bannerData) { setError('Загрузите превью-баннер'); return; }
    if (!title.trim()) { setError('Введите название'); return; }
    if (!description.trim()) { setError('Введите описание'); return; }

    if (mode === 'new' || uploadType === 'single') {
      setCreatingAnime(true);
      try {
        const anime = store.createAnime({
          title: title.trim(),
          description: description.trim(),
          banner: bannerData,
          type: uploadType === 'single' ? 'single' : 'season',
          year,
          age_rating: ageRating,
          genres,
        });
        setSelectedAnimeId(anime.id);
        setAnimeList(store.listAnime('newest', null));
        setStep('episode');
      } finally {
        setCreatingAnime(false);
      }
    } else {
      // existing
      if (selectedAnimeId === '') { setError('Выберите тайтл'); return; }
      setStep('episode');
    }
  };

  

  const submitEpisode = async () => {
    setError('');
    if (!episodeTitle.trim()) { setError('Введите название серии'); return; }
    if (!videoFile) { setError('Выберите видеофайл'); return; }
    if (!compressionResult || Object.keys(compressionResult.qualities).length === 0) {
      setError('Сначала сожмите видео в выбранных качествах'); return;
    }
    setBusy(true);
    try {
      // Конвертируем все качества в data URL (для эмулятора)
      const qualitySources: Record<string, string> = {};
      for (const [q, blob] of Object.entries(compressionResult.qualities)) {
        qualitySources[q] = await blobToDataUrl(blob);
      }
      // Если есть только одно качество, оставляем video_url для совместимости
      const mainUrl = qualitySources['720p'] ?? qualitySources[Object.keys(qualitySources)[0]];

      const episode = store.createEpisode({
        anime_id: Number(selectedAnimeId),
        season: uploadType === 'single' ? 1 : seasonNumber,
        episode_number: uploadType === 'single' ? 1 : episodeNumber,
        title: episodeTitle.trim(),
        description: episodeDesc.trim() || 'Новая серия',
        video_url: mainUrl,
        quality_sources: qualitySources,
        audio_tracks: audioTracks.length > 0 ? audioTracks : [],
        audio_label: audioLabel || 'Оригинал',
        duration: 0,
      });

      setMessage({ type: 'success', text: 'Серия успешно загружена!' });
      setTimeout(() => navigate(`/anime/${episode.anime_id}`), 1000);
    } catch (err: any) {
      setError(err.message ?? 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const totalCompressedSize = compressionResult
    ? Object.values(compressionResult.qualities).reduce((s, b) => s + b.size, 0)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
      <div className="bg-black rounded-3xl shadow-xl p-6 sm:p-8 text-white mb-6">
        <div className="flex items-center gap-3 mb-2">
          <UploadIcon className="w-7 h-7" />
          <h1 className="text-display text-3xl">Загрузить аниме</h1>
        </div>
        <p className="text-zinc-400 text-sm">Видео автоматически сжимается до 500 МБ без потери качества звука.</p>
      </div>

      {/* Прогресс шагов */}
      <div className="mb-5 flex items-center justify-center gap-2 text-xs">
        <div className={`flex items-center gap-2 ${step === 'anime' ? 'text-zinc-900 font-semibold' : 'text-emerald-600'}`}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${step === 'anime' ? 'bg-zinc-900 text-white' : 'bg-emerald-500 text-white'} font-bold`}>1</span>
          Аниме
        </div>
        <ChevronDownIcon className="h-3 w-3 text-zinc-300 -rotate-90" />
        <div className={`flex items-center gap-2 ${step === 'episode' ? 'text-zinc-900 font-semibold' : 'text-zinc-400'}`}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${step === 'episode' ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'} font-bold`}>2</span>
          Серия
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <CloseIcon className="h-4 w-4" />{error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {message.text}
        </div>
      )}

      {step === 'anime' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-lg font-bold text-zinc-900">Шаг 1. Аниме</h2>

          {/* Тип */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Тип</label>
            <div className="flex bg-zinc-100 rounded-full p-1">
              <button type="button" onClick={() => setUploadType('season')}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${uploadType === 'season' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>
                Сезонное аниме
              </button>
              <button type="button" onClick={() => setUploadType('single')}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${uploadType === 'single' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>
                Одиночное аниме
              </button>
            </div>
          </div>

          {/* Режим выбора */}
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
                <select
                  value={selectedAnimeId}
                  onChange={(e) => setSelectedAnimeId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm appearance-none pr-10"
                >
                  <option value="">— выберите —</option>
                  {animeList.filter(a => a.type === 'season').map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Поля для нового тайтла */}
          {(mode === 'new' || uploadType === 'single') && (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Название</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
                  placeholder="Например: Сакура: Путь Весны"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm resize-none"
                  placeholder="О чём аниме..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Год</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Возраст</label>
                  <select
                    value={ageRating}
                    onChange={(e) => setAgeRating(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
                  >
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
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Превью баннер */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Превью-баннер</label>
            <BannerUpload bannerData={bannerData} bannerName={bannerName} onPick={handleBanner} onClear={() => { setBannerData(''); setBannerName(''); }} />
          </div>

          <button
            type="button"
            onClick={handleCreateAnimeAndContinue}
            disabled={creatingAnime}
            className="w-full py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition"
          >
            {creatingAnime ? 'Создание...' : 'Далее: загрузить серию →'}
          </button>
        </div>
      )}

      {step === 'episode' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-lg font-bold text-zinc-900">Шаг 2. Серия</h2>

          {uploadType === 'season' && (
            <div className="grid grid-cols-2 gap-3">
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
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Название серии</label>
            <input
              type="text"
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
              placeholder="Например: Пробуждение"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Описание</label>
            <textarea
              value={episodeDesc}
              onChange={(e) => setEpisodeDesc(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm resize-none"
              placeholder="Краткое описание..."
            />
          </div>

          {/* ВИДЕОФАЙЛ */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Видеофайл (макс. 1 ГБ)</label>
            <FileUploadBox
              file={videoFile}
              preview={null}
              accept="video/*"
              onPick={handleVideo}
              onClear={() => { setVideoFile(null); setCompressionResult(null); }}
              label="Видео"
            />
            {videoFile && (
              <div className="mt-2 text-xs text-zinc-500">
                {videoFile.name} · {formatSize(videoFile.size)}
              </div>
            )}
          </div>

          {/* ВЫБОР КАЧЕСТВ ДЛЯ СЖАТИЯ */}
          {videoFile && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Какие качества сгенерировать?</label>
              <div className="flex flex-wrap gap-1.5">
                {['144p', '240p', '360p', '480p', '720p', '1080p'].map(q => (
                  <button key={q} type="button" onClick={() => toggleQuality(q)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      selectedQualities.includes(q) ? 'bg-black text-white border-black' : 'bg-white text-zinc-700 border-zinc-200'
                    }`}>
                    {q}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={startCompression}
                disabled={compressing || selectedQualities.length === 0}
                className="mt-3 w-full py-3 rounded-xl bg-zinc-900 text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {compressing ? (
                  <>
                    <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />
                    Сжатие видео... {Math.round(compressionProgress * 100)}%
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4" />
                    Сжать видео (макс. 500 МБ)
                  </>
                )}
              </button>
              {compressing && (
                <div className="mt-2 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all" style={{ width: `${compressionProgress * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {/* РЕЗУЛЬТАТ СЖАТИЯ */}
          {compressionResult && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="text-sm font-semibold text-emerald-900 mb-2">
                Готово: {Object.keys(compressionResult.qualities).length} качеств, {formatSize(totalCompressedSize)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(compressionResult.qualities).map(([q, b]) => (
                  <div key={q} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5">
                    <span className="font-semibold text-zinc-900">{q}</span>
                    <span className="text-zinc-500">{formatSize(b.size)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-emerald-700">
                Исходник: {formatSize(compressionResult.originalSize)} → Итого: {formatSize(totalCompressedSize)}
              </div>
            </div>
          )}

          {/* ОЗВУЧКА */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wider">Озвучка (необязательно)</label>
            <AudioTrackInput audioTracks={audioTracks} audioLabel={audioLabel} setAudioLabel={setAudioLabel} onAdd={handleAudio} onRemove={(id) => setAudioTracks(prev => prev.filter(a => a.id !== id))} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep('anime')} className="px-5 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Назад
            </button>
            <button
              onClick={submitEpisode}
              disabled={busy || !compressionResult}
              className="flex-1 py-3 rounded-xl bg-black text-white font-semibold hover:bg-zinc-800 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />
                  Публикация...
                </>
              ) : (
                <>
                  <UploadIcon className="w-4 h-4" />
                  Опубликовать
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BannerUpload({ bannerData, bannerName, onPick, onClear }: { bannerData: string; bannerName: string; onPick: (f: File) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} className="hidden" />
      {bannerData ? (
        <div className="relative">
          <img src={bannerData} alt="" className="rounded-xl max-h-48 w-full object-cover" />
          <button onClick={onClear} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="w-full h-32 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition flex flex-col items-center justify-center gap-1 text-zinc-500"
        >
          <UploadIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Выберите превью</span>
          <span className="text-[10px] text-zinc-400">{bannerName}</span>
        </button>
      )}
    </div>
  );
}

function FileUploadBox({ file, preview, accept, onPick, onClear, label }: { file: File | null; preview: string | null; accept: string; onPick: (f: File) => void; onClear: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={ref} type="file" accept={accept} onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} className="hidden" />
      {file || preview ? (
        <div className="relative h-32 rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 px-4 text-center">
              <UploadIcon className="h-6 w-6 text-zinc-900" />
              <div className="line-clamp-1 text-xs font-semibold text-zinc-900">{file?.name}</div>
              <div className="text-[10px] text-zinc-500">{file && formatSize(file.size)}</div>
            </div>
          )}
          <button onClick={onClear} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="w-full h-32 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition flex flex-col items-center justify-center gap-1 text-zinc-500"
        >
          <UploadIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Выберите {label.toLowerCase()}</span>
        </button>
      )}
    </div>
  );
}

function AudioTrackInput({ audioTracks, audioLabel, setAudioLabel, onAdd, onRemove }: { audioTracks: { id: string; label: string; url: string; lang: string }[]; audioLabel: string; setAudioLabel: (v: string) => void; onAdd: (f: File) => void; onRemove: (id: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={ref} type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && onAdd(e.target.files[0])} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full h-24 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-400 transition flex flex-col items-center justify-center gap-1 text-zinc-500"
      >
        <UploadIcon className="w-5 h-5" />
        <span className="text-xs font-medium">Добавить озвучку (аудиофайл)</span>
      </button>
      {audioTracks.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {audioTracks.map(t => (
            <div key={t.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
              <span className="flex-1 text-sm font-medium text-zinc-900">{t.label}</span>
              <button onClick={() => onRemove(t.id)} className="p-1 rounded-full hover:bg-zinc-200">
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {audioTracks.length > 0 && (
        <div className="mt-2">
          <input
            type="text"
            value={audioLabel}
            onChange={(e) => setAudioLabel(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm"
            placeholder="Основное название дорожки"
          />
        </div>
      )}
    </div>
  );
}