import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { LogOut } from 'lucide-react';

export default function Navbar({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const roleColors = {
    admin:  'bg-purple-100 text-purple-700',
    agent:  'bg-blue-100 text-blue-700',
    client: 'bg-green-100 text-green-700',
  };

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-3 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={34} showText={true} textClass="text-base" />
          <span className="text-gray-200 hidden sm:block">|</span>
          <span className={`hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full capitalize ${roleColors[user?.role] || 'bg-gray-100 text-gray-600'}`}>
            {user?.role}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {children}
          <span className="text-sm text-gray-500 hidden md:block">{user?.name}</span>
          <button onClick={handleLogout} title="Sign out"
            className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}
