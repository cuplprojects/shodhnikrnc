import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Check, CheckCircle2, UserCheck, ArrowLeft, Clock } from 'lucide-react';
import { setNomineeAvailability } from '../../api/recruitmentApi';

export default function NomineeAvailabilityPage() {
  const navigate = useNavigate();
  const [memberId, setMemberId] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memberId || !availabilityDate) {
      setError("Please provide Committee Member ID and select an availability date.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setShowSuccess(false);

    try {
      await setNomineeAvailability(memberId, availabilityDate);
      setShowSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error(err);
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full w-full space-y-6 animate-in fade-in duration-500 font-sans">
      
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <UserCheck size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Selection Committee — Availability Portal</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Nominated faculty members can specify their available interview dates for recruitment selection committees.
          </p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {showSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} />
              Availability date recorded successfully! Redirecting...
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Committee Member ID / Reference <span className="text-red-500">*</span>
              </label>
              <input 
                required
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="Enter member ID received in invitation email"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm"
              />
              <p className="text-[11px] text-slate-400">Refer to your committee nomination invitation email from Dean (RNC).</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Date of Availability <span className="text-red-500">*</span>
              </label>
              <input 
                required
                type="date"
                value={availabilityDate}
                min={new Date().toISOString().substring(0, 10)}
                onChange={(e) => setAvailabilityDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm"
              />
              <p className="text-[11px] text-slate-400">Select the date you are available to participate in selection committee interviews.</p>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 pt-4">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
            >
              {isSubmitting ? <Clock size={16} className="animate-spin" /> : <Check size={16} />}
              {isSubmitting ? 'Submitting Availability...' : 'Submit Availability Date'}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
