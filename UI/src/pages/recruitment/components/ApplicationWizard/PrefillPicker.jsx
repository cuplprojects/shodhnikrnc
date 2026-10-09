import { useEffect, useState } from 'react';
import { History, AlertCircle } from 'lucide-react';
import { listMyApplications, prefillDraft, startOrResumeDraft } from '../../../../api/recruitmentApi';
import { FIELD_CLASS, LABEL_CLASS } from './wizardStyles';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Shown before Step 1 of a brand-new application: lets the applicant copy an
 * earlier application's details (Submitted or Draft) into this recruitment's
 * new draft, or skip straight to a blank one.
 *
 * `PrefillFromPreviousApplicationAsync` resumes rather than always creating a
 * fresh draft, so if the applicant already has an in-progress draft for THIS
 * recruitment, prefilling silently overwrites it. `hasExistingDraftHere` lets
 * the caller warn about that before the picker is even shown that option.
 */
export default function PrefillPicker({ recruitmentId, onReady }) {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [confirmingPrefill, setConfirmingPrefill] = useState(false);

  useEffect(() => {
    let ignore = false;
    listMyApplications()
      .then((apps) => {
        if (!ignore) setApplications(apps ?? []);
      })
      .catch((err) => {
        if (!ignore) setError(err.message ?? 'Failed to load your previous applications.');
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const runPrefill = async () => {
    setIsWorking(true);
    setError(null);
    try {
      const candidateId = await prefillDraft(recruitmentId, selectedId);
      // `prefilled` tells the wizard this draft now holds copied data it must
      // load before mounting the steps.
      onReady(candidateId, { prefilled: true });
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsWorking(false);
      setConfirmingPrefill(false);
    }
  };

  const handleUsePrevious = () => {
    if (!selectedId) return;
    // StartOrResumeDraftAsync (called internally by prefill) resumes any
    // existing draft for this recruitment rather than starting fresh, so a
    // prefill here would silently overwrite it. Confirm first.
    setConfirmingPrefill(true);
  };

  const handleSkip = async () => {
    setIsWorking(true);
    setError(null);
    try {
      const candidateId = await startOrResumeDraft(recruitmentId);
      // "Blank form" is a misnomer when a draft for this recruitment already
      // exists: StartOrResumeDraftAsync resumes it rather than creating a fresh
      // one, so its stored data must still be loaded before the steps mount.
      onReady(candidateId, { prefilled: true });
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsWorking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500" />
        <span className="text-sm font-semibold">Checking your previous applications…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {applications.length > 0 ? (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20 space-y-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
              Copy details from a previous application?
            </span>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLASS}>Previous application</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">-- Choose an application --</option>
              {applications.map((a, idx) => (
                <option key={a.id} value={a.id}>
                  Application #{idx + 1} — {a.fullName || 'Unnamed'} ({formatDate(a.appliedAt)})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-300/90">
            This copies every field, education row, and experience row into a new
            draft for this recruitment. Your earlier application is not changed.
          </p>

          {confirmingPrefill ? (
            <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 space-y-2">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                If you already have an in-progress draft for this recruitment, this will
                replace its data with the copied application. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={runPrefill}
                  disabled={isWorking}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {isWorking ? 'Copying…' : 'Yes, replace and copy'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingPrefill(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleUsePrevious}
              disabled={!selectedId || isWorking}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all"
            >
              {isWorking ? 'Copying…' : 'Use this application'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You have no previous applications to copy from.
        </p>
      )}

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isWorking}
          className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {isWorking ? 'Starting…' : 'Skip — start with a blank form'}
        </button>
      </div>
    </div>
  );
}
