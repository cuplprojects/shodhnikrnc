import { useState, useEffect } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

export default function ReappropriationForm({
  budgetHeads = [],
  effectiveReceivedByHeadName = {},
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  const [reason, setReason] = useState(initialData?.reason || '');
  const [remarks, setRemarks] = useState('');
  const [sources, setSources] = useState(
    initialData?.sources?.length ? initialData.sources : [{ budgetHeadId: '', amount: '' }]
  );
  const [destinations, setDestinations] = useState(
    initialData?.destinations?.length ? initialData.destinations : [{ budgetHeadId: '', amount: '' }]
  );
  const [error, setError] = useState(null);

  const totalSourceAmount = sources.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalDestAmount = destinations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // Autofill destination amount if there is exactly 1 destination
  useEffect(() => {
    if (destinations.length === 1 && totalSourceAmount > 0) {
      if (Number(destinations[0].amount) !== totalSourceAmount) {
        const newDests = [...destinations];
        newDests[0].amount = totalSourceAmount.toString();
        setDestinations(newDests);
      }
    }
  }, [totalSourceAmount, destinations]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!reason.trim()) {
      setError('Reason for reappropriation is mandatory.');
      return;
    }

    if (totalSourceAmount <= 0) {
      setError('Total source amount must be greater than zero.');
      return;
    }

    if (totalSourceAmount !== totalDestAmount) {
      setError(`Source total (${formatCurrency(totalSourceAmount)}) and destination total (${formatCurrency(totalDestAmount)}) must match.`);
      return;
    }

    const invalidSource = sources.some(s => !s.budgetHeadId || !s.amount || Number(s.amount) <= 0);
    const invalidDest = destinations.some(d => !d.budgetHeadId || !d.amount || Number(d.amount) <= 0);

    if (invalidSource || invalidDest) {
      setError('Please fill all selected heads and ensure amounts are greater than zero.');
      return;
    }

    const mapLine = (line) => {
      const head = budgetHeads.find(b => b.id === line.budgetHeadId);
      return {
        budgetHeadId: head.id,
        headName: head.headName,
        amount: Number(line.amount)
      };
    };

    if (initialData && !remarks.trim()) {
      setError('Remarks are mandatory when resubmitting a returned request.');
      return;
    }

    setError(null);
    try {
      const payload = {
        reason,
        sources: sources.map(mapLine),
        destinations: destinations.map(mapLine),
      };
      
      if (initialData) {
        payload.remarks = remarks.trim();
      }
      
      await onSubmit(payload);
      // Do not clear form here, parent handles success
    } catch (err) {
      setError('Reappropriation request failed. ' + (err.message || ''));
    }
  };

  const renderHeadSelect = (line, index, isSource) => {
    const arr = isSource ? sources : destinations;
    const setArr = isSource ? setSources : setDestinations;

    const updateLine = (field, value) => {
      const newArr = [...arr];
      newArr[index][field] = value;
      setArr(newArr);
    };

    const removeLine = () => {
      if (arr.length <= 1) return;
      const newArr = [...arr];
      newArr.splice(index, 1);
      setArr(newArr);
    };

    return (
      <div key={index} className="flex gap-2 mb-2 items-center">
        <select
          value={line.budgetHeadId}
          onChange={(e) => updateLine('budgetHeadId', e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
        >
          <option value="">Select Head</option>
          {budgetHeads.map((b) => {
            const effectiveReceived = effectiveReceivedByHeadName[b.headName];
            return (
              <option key={b.id} value={b.id}>
                {b.headName} {effectiveReceived !== undefined
                  ? `(Received ${formatCurrency(effectiveReceived)})`
                  : `(Sanctioned ${formatCurrency(b.total)})`}
              </option>
            );
          })}
        </select>
        <input
          required
          type="number"
          min="0.01"
          step="0.01"
          value={line.amount}
          onChange={(e) => updateLine('amount', e.target.value)}
          placeholder="Amount"
          className="w-32 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
        />
        {arr.length > 1 && (
          <button
            type="button"
            onClick={removeLine}
            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex flex-col gap-4">
      <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
        {initialData ? 'Edit Reappropriation Request' : 'New Reappropriation Request'}
      </h3>
      
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {/* Sources */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Sources <span className="text-rose-500 font-normal normal-case">(Deduct From)</span>
            </label>
            <div className="text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              Total: <span className="text-rose-600 dark:text-rose-400">{formatCurrency(totalSourceAmount)}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {sources.map((s, i) => renderHeadSelect(s, i, true))}
          </div>
          
          <button
            type="button"
            onClick={() => setSources([...sources, { budgetHeadId: '', amount: '' }])}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors w-max"
          >
            <PlusCircle size={16} /> Add Source Head
          </button>
        </div>

        {/* Destinations */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Destinations <span className="text-emerald-500 font-normal normal-case">(Add To)</span>
            </label>
            <div className="text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              Total: <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalDestAmount)}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {destinations.map((d, i) => renderHeadSelect(d, i, false))}
          </div>
          
          <button
            type="button"
            onClick={() => setDestinations([...destinations, { budgetHeadId: '', amount: '' }])}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 rounded-lg transition-colors w-max"
          >
            <PlusCircle size={16} /> Add Destination Head
          </button>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-extrabold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
            Reason for Reappropriation
          </label>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Please justify the need for this budget transfer..."
            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-none"
          />
        </div>

        {!!initialData && (
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Remarks for Resubmission <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Please provide remarks to address the return reason..."
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-none"
            />
          </div>
        )}
      </div>
      
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700/60">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Submit Changes' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
}
