import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getRemainingWorkingDays(expiresAt) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  const now = new Date();
  if (expiry <= now) return 0;

  let days = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryDate = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  while (cursor < expiryDate) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) days += 1;
  }
  return days;
}

export default function CountdownTimer({ expiresAt, totalDays }) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => forceTick((tick) => tick + 1), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  if (!expiresAt) {
    return null;
  }

  const remainingDays = getRemainingWorkingDays(expiresAt);
  const isExpired = remainingDays === 0;
  const progressRatio = totalDays ? Math.max(0, Math.min(1, 1 - remainingDays / totalDays)) : null;

  return (
    <div className={`flex flex-col gap-2 p-4 rounded-xl border transition-colors ${
      isExpired 
        ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50" 
        : "bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700"
    }`}>
      <div className="flex items-center gap-2">
        <Clock size={16} className={isExpired ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"} />
        <span className={`font-semibold text-sm ${isExpired ? "text-rose-700 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`}>
          {isExpired ? "Expired" : `${remainingDays} working day${remainingDays === 1 ? "" : "s"} remaining`}
        </span>
      </div>
      
      {progressRatio !== null && (
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${isExpired ? "bg-rose-500" : "bg-blue-600 dark:bg-blue-500"}`} 
            style={{ width: `${progressRatio * 100}%` }} 
          />
        </div>
      )}
      
      <div className={`text-xs ${isExpired ? "text-rose-600/80 dark:text-rose-400/80" : "text-slate-500 dark:text-slate-400"}`}>
        Expires {new Date(expiresAt).toLocaleDateString()}
      </div>
    </div>
  );
}
