import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import HomePage from './pages/HomePage';
import AnimePage from './pages/AnimePage';
import WatchPage from './pages/WatchPage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import UploadPage from './pages/UploadPage';
import SearchPage from './pages/SearchPage';
import SeasonPage from './pages/SeasonPage';
import AdminPage from './pages/AdminPage';
import { DiscordIcon } from './components/icons';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/season/:season" element={<SeasonPage />} />
          <Route path="/id:animeId" element={<AnimePage />} />
          <Route path="/anime/:id" element={<AnimePage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </main>

      {/* Блок "Хотите стать автором своего аниме?" */}
      <section className="mx-auto max-w-[1400px] px-5 sm:px-8 py-8">
        <a
          href="https://discord.gg/fZXn6vjUFb"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 sm:p-6 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center gap-4">
            <DiscordIcon className="w-10 h-10 sm:w-12 sm:h-12 shrink-0" />
            <div>
              <div className="text-display text-xl sm:text-2xl">Хотите стать автором своего аниме?</div>
              <div className="text-sm text-indigo-100 mt-0.5">тебе к нам! — присоединяйтесь к нашему Discord</div>
            </div>
          </div>
          <svg className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
          </svg>
        </a>
      </section>
    </div>
  );
}