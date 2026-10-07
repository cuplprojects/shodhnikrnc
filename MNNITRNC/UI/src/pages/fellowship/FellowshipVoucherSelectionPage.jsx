import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReadyToVoucherClaims } from '../../api/fellowshipApi';
import { listNotings } from '../../api/notingApi';
import { getPaymentVouchers } from '../../api/paymentVoucherApi';
import { formatCurrency } from '../projects/utils/currency';
import { FileText, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * The DA/Superintendent/DR/Dean "ready to voucher" list: Dean-approved
 * fellowship claims not yet linked to a PaymentVoucherItem. Selecting
 * claims here does not consume them -- a claim only leaves this list once
 * it actually has a PaymentVoucherItemId (set by voucher creation, not by
 * noting creation).
 */
export default function FellowshipVoucherSelectionPage() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rawClaims, notingsRes, vouchersRes] = await Promise.all([
        listReadyToVoucherClaims(),
        listNotings({ pageSize: 0 }).catch(() => []),
        getPaymentVouchers({ pageSize: 0 }).catch(() => []),
      ]);

      const notings = notingsRes?.items || (Array.isArray(notingsRes) ? notingsRes : []);
      const vouchers = vouchersRes?.items || (Array.isArray(vouchersRes) ? vouchersRes : []);

      const notedClaimIds = new Set();
      notings.forEach((n) => {
        (n.items || []).forEach((item) => {
          if (item.fellowshipClaimId) {
            notedClaimIds.add(String(item.fellowshipClaimId).toLowerCase());
          }
        });
      });

      const voucheredClaimIds = new Set();
      vouchers.forEach((v) => {
        (v.items || []).forEach((item) => {
          if (item.fellowshipClaimId) {
            voucheredClaimIds.add(String(item.fellowshipClaimId).toLowerCase());
          }
        });
      });

      const processedClaims = (rawClaims || [])
        .map((c) => {
          const claimIdLower = String(c.id).toLowerCase();
          return {
            ...c,
            hasNoting: notedClaimIds.has(claimIdLower),
            hasVoucher: Boolean(c.paymentVoucherItemId) || voucheredClaimIds.has(claimIdLower),
          };
        })
        .filter((c) => !(c.hasNoting && c.hasVoucher));

      setClaims(processedClaims);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = claims.length > 0 && claims.every((c) => selectedIds.has(c.id));
  const someSelected = claims.some((c) => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(claims.map((c) => c.id)));
  };

  const selectedClaims = claims.filter((c) => selectedIds.has(c.id));
  const selectedHasNoting = selectedClaims.some((c) => c.hasNoting);
  const selectedHasVoucher = selectedClaims.some((c) => c.hasVoucher);

  const goToVoucher = () => {
    if (selectedHasVoucher) {
      toast.error('Payment Voucher has already been created for one or more selected claims.');
      return;
    }
    navigate('/payment-voucher', { state: { fellowshipClaimIds: Array.from(selectedIds) } });
  };

  const goToNoting = () => {
    if (selectedHasNoting) {
      toast.error('Noting has already been created for one or more selected claims.');
      return;
    }
    navigate('/noting-page', { state: { fellowshipClaimIds: Array.from(selectedIds) } });
  };

  if (isLoading) {
    return <div className="text-slate-500 dark:text-slate-400">Loading claims ready to voucher...</div>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-800 dark:text-white">Ready to Voucher / Noting Queue</h2>
      {claims.length === 0 ? (
        <div className="p-6 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-white/20 dark:border-slate-800/50 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
          No approved fellowship claims in queue.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-white/20 dark:border-slate-800/50">
        <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-800/80">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-bold">Scholar</th>
              <th className="px-4 py-3 font-bold">Project</th>
              <th className="px-4 py-3 font-bold">Month</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {claims.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelected(c.id)}
                    aria-label={`Select ${c.scholarName}`}
                  />
                </td>
                <td className="px-4 py-3 font-semibold">{c.scholarName}</td>
                <td className="px-4 py-3">{c.projectTitle}</td>
                <td className="px-4 py-3">{c.claimMonth}/{c.claimYear}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.hasNoting && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                        Noting Created
                      </span>
                    )}
                    {c.hasVoucher && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        Voucher Created
                      </span>
                    )}
                    {!c.hasNoting && !c.hasVoucher && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Ready
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(c.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={selectedHasVoucher}
            onClick={goToVoucher}
            title={selectedHasVoucher ? "Voucher already created for one or more selected claims" : ""}
            className={`px-5 py-2.5 text-sm font-bold rounded-2xl flex items-center gap-2 transition-all ${
              selectedHasVoucher
                ? 'bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            }`}
          >
            <CreditCard className={`w-4 h-4 ${selectedHasVoucher ? 'text-slate-400 dark:text-slate-500' : 'text-white'}`} />
            <span>{selectedHasVoucher ? 'Voucher Created (Disabled)' : `Create Voucher (${selectedIds.size})`}</span>
          </button>
          <button
            type="button"
            disabled={selectedHasNoting}
            onClick={goToNoting}
            title={selectedHasNoting ? "Noting already created for one or more selected claims" : ""}
            className={`px-5 py-2.5 text-sm font-bold rounded-2xl flex items-center gap-2 transition-all ${
              selectedHasNoting
                ? 'bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
            }`}
          >
            <FileText className={`w-4 h-4 ${selectedHasNoting ? 'text-slate-400 dark:text-slate-500' : 'text-white'}`} />
            <span>{selectedHasNoting ? 'Noting Created (Disabled)' : `Create Noting (${selectedIds.size})`}</span>
          </button>
        </div>
      )}
    </div>
  );
}

