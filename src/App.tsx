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
import UserPage from './pages/UserPage';
import { DiscordIcon } from './components/icons';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/season/:season" element={<SeasonPage />} />
          <Route path="/id/:animeId" element={<AnimePage />} />
          <Route path="/anime/:id" element={<AnimePage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/user/:id" element={<UserPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<HomePage />} /> {/* Fallback route for SPA */}
        </Routes>
      </main>

      <footer className="mx-auto max-w-[1400px] w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col xs:flex-row items-center justify-between gap-3">
          <a
            href="https://discord.gg/fZXn6vjUFb"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 sm:gap-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 transition pl-2 pr-3 sm:pr-4 py-1.5 sm:py-2 text-white shadow-md shadow-indigo-300/50 max-w-full"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <DiscordIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-xs sm:text-sm font-semibold truncate">Хотите стать автором своего аниме? тебе к нам!</span>
          </a>
          <div className="text-[10px] sm:text-xs text-zinc-500">©{new Date().getFullYear()} AnimeWorld · все права защищены</div>
        </div>
      </footer>
    </div>
  );
}