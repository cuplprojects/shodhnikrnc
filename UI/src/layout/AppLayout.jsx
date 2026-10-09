import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from './useTheme';
import { Sun, Moon, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useState } from 'react';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors duration-200">
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-slate-800 dark:bg-slate-950 shadow-sm border-b border-slate-700 dark:border-slate-800 transition-colors duration-200">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                {/* Dynamic Title can go here, leaving blank for now */}
              </h1>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-slate-300 hover:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              {user && (
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => navigate('/profile')}
                    className="flex items-center gap-3 hover:bg-slate-700/50 dark:hover:bg-slate-800/50 py-1 px-2 pr-3 rounded-full transition-all group"
                  >
                    <div className="flex flex-col text-right">
                      <span className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors leading-tight">{user.fullName}</span>
                      <span className="text-xs text-slate-400 leading-tight">{user.roles?.join(', ')}</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 dark:bg-blue-900 flex items-center justify-center text-blue-300 dark:text-blue-300 font-bold border border-blue-500/30 group-hover:border-blue-400 transition-colors shadow-inner">
                      {user.fullName?.charAt(0).toUpperCase()}
                    </div>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="ml-4 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
