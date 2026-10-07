import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ShieldAlert, PlusCircle } from 'lucide-react';

export default function ExpiryCountdownWidget({ expiresAt, onExtend, canExtend = true }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, isExpired: false });
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const calculate = () => {
      const target = new Date(expiresAt).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, isExpired: true });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeLeft({ days, hours, isExpired: false });
      }
    };

    calculate();
    const interval = setInterval(calculate, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const { days, hours, isExpired } = timeLeft;
  
  let colorStyle = 'emerald';
  if (isExpired || days < 3) colorStyle = 'rose';
  else if (days < 7) colorStyle = 'amber';

  const styles = {
    emerald: 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
    amber: 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    rose: 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300',
  };

  const badgeStyles = {
    emerald: 'bg-emerald-500 text-white',
    amber: 'bg-amber-500 text-white',
    rose: 'bg-rose-600 text-white animate-pulse',
  };

  const handleExtend = async () => {
    if (!onExtend || isExtending) return;
    setIsExtending(true);
    try {
      await onExtend();
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <div className={`p-4 rounded-2xl border backdrop-blur-xl shadow-sm transition-all ${styles[colorStyle]}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${badgeStyles[colorStyle]} shadow-md`}>
            {isExpired ? <ShieldAlert size={20} /> : days < 3 ? <AlertTriangle size={20} /> : <Clock size={20} />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">
              Expiry Countdown
            </div>
            <div className="text-base font-extrabold flex items-center gap-2">
              {isExpired ? (
                <span className="text-rose-600 dark:text-rose-400 font-black">EXPIRED / Deadline Reached</span>
              ) : (
                <span>
                  <span className="text-lg font-black">{days}</span> days, <span className="font-bold">{hours}</span> hours remaining
                </span>
              )}
            </div>
          </div>
        </div>

        {canExtend && onExtend && (
          <button
            type="button"
            disabled={isExtending}
            onClick={handleExtend}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all w-fit"
          >
            <PlusCircle size={14} className="text-indigo-600 dark:text-indigo-400" />
            {isExtending ? 'Extending...' : 'Extend to 42 Days (Special Request)'}
          </button>
        )}
      </div>
    </div>
  );
}
