import { useAuth } from '../auth/useAuth';
import { useTheme } from '../layout/useTheme';
import { Clock, LogOut } from 'lucide-react';

export default function RegistrationPendingPage() {
  useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] dark:bg-[#030712] px-6">
      <div className="w-full w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock size={28} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Registration pending approval
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {user?.fullName ? `Hi ${user.fullName}, your` : 'Your'} registration is awaiting
            approval from your HOD or the R&amp;C office. You'll be able to sign in fully
            once approved — check back later.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 font-bold text-white hover:hover:rounded-2xl transition-all"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </div>
  );
}
