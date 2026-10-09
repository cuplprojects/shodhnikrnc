import { AlertTriangle, FileText } from 'lucide-react';
import { computeTierPreview, PROCUREMENT_TIERS } from '../../../constants/procurementEnums';

/**
 * Shows which annexure the current GeM/cost combination will generate.
 *
 * Legacy let the user pick the mode of purchase from a dropdown, which meant the
 * form and its approval routing could be chosen by whoever submitted it. The
 * server now derives the tier on every raise; this panel only reflects that
 * derivation so the choice is visible before submitting.
 */
export default function IndentTierPreview({ gemAvailability, estimatedCost }) {
  const tier = computeTierPreview(gemAvailability, estimatedCost);

  if (!tier) return null;

  if (tier === 'BiddingRequired') {
    return (
      <div className="flex gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Bidding process required
          </p>
          <p className="text-xs mt-1 text-amber-800 dark:text-amber-300/90">
            Non-GeM purchases above ₹25,00,000 must go through the bidding process
            and cannot be raised here. Reduce the estimated cost or procure through GeM.
          </p>
        </div>
      </div>
    );
  }

  const { label, annexure } = PROCUREMENT_TIERS[tier];

  return (
    <div className="flex gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-900/20">
      <FileText size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div>
        <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
          {annexure} — {label}
        </p>
        <p className="text-xs mt-1 text-blue-800 dark:text-blue-300/90">
          The applicable procurement route is determined by the server based on GeM availability and total estimated cost.
        </p>
      </div>
    </div>
  );
}
