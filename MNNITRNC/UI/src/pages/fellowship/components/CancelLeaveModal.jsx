import { useState } from 'react';
import { X, CalendarOff } from 'lucide-react';
import { raiseLeaveCancellation } from '../../../api/fellowshipApi';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

export default function CancelLeaveModal({ request, onClose, onCancelled }) {
  // Sort the dates
  const sortedDates = [...(request?.dates || [])].sort((a, b) => new Date(a) - new Date(b));
  
  const [selectedDates, setSelectedDates] = useState([...sortedDates]); // By default, select all for full cancellation
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleDate = (date) => {
    setSelectedDates(prev => 
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const selectAll = () => setSelectedDates([...sortedDates]);
  const deselectAll = () => setSelectedDates([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedDates.length === 0) {
      setError('Please select at least one date to cancel.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      await raiseLeaveCancellation(request.id, {
        datesToCancel: selectedDates,
        reason: reason || ''
      });
      onCancelled?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to submit cancellation request.');
      setIsSubmitting(false);
    }
  };

  if (!request) return null;

  const isFullCancellation = selectedDates.length === sortedDates.length;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarOff size={18} className="text-red-500" />
            Cancel Leave
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Select the dates you want to cancel from this approved leave request.
          </p>

          <form id="cancel-leave-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-semibold dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={LABEL_CLASS}>Dates to cancel <span className="text-red-500">*</span></label>
                <div className="flex gap-3 text-xs font-medium">
                  <button type="button" onClick={selectAll} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">Select All</button>
                  <button type="button" onClick={deselectAll} className="text-slate-500 hover:text-slate-700 dark:text-slate-400">Clear</button>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                {sortedDates.map((date) => (
                  <label key={date} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${selectedDates.includes(date) ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' : 'hover:bg-slate-100 border-transparent dark:hover:bg-slate-700'}`}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-red-600 rounded focus:ring-red-500 bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                      checked={selectedDates.includes(date)}
                      onChange={() => toggleDate(date)}
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(date)}
                    </span>
                  </label>
                ))}
              </div>
              
              <div className="text-xs font-medium text-slate-500 flex justify-between px-1">
                <span>{selectedDates.length} of {sortedDates.length} selected</span>
                {isFullCancellation ? (
                  <span className="text-red-600 dark:text-red-400 font-semibold">Full Cancellation</span>
                ) : selectedDates.length > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Partial Cancellation</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-1">
              <label className={LABEL_CLASS}>Reason <span className="text-red-500">*</span></label>
              <textarea
                name="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={FIELD_CLASS + ' resize-none'}
                rows="3"
                placeholder="Why are you cancelling this leave?"
              />
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300">
            Cancel
          </button>
          <button type="submit" form="cancel-leave-form" disabled={isSubmitting || selectedDates.length === 0 || !reason.trim()}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors">
            {isSubmitting ? 'Submitting...' : 'Request Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
