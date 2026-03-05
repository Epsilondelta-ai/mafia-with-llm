import { Routes, Route } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Spectator from './pages/Spectator';
import History from './pages/History';
import Navigation from './components/Navigation';

export default function App() {
  return (
    <div className="min-h-screen bg-mafia-bg flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-4 max-w-lg">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/spectate/:gameId" element={<Spectator />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  );
}
