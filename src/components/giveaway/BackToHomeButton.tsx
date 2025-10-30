import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function BackToHomeButton() {
  return (
    <Link
      to="/"
      className="fixed top-4 left-4 z-50 bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-full hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20"
    >
      <Home className="w-4 h-4" />
      <span className="hidden sm:inline">Back to Home</span>
    </Link>
  );
}
