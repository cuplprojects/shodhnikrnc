import { Plus, Trash2, Route, Info } from 'lucide-react';
import { LEG_TRAVEL_MODES, BOOKING_PLATFORMS, AIR_BOOKING_PLATFORMS, BOOKING_PLATFORM_DISCLAIMER } from '../../../constants/travelEnums';
import { formatCurrency } from '../../projects/utils/currency';

const FIELD_CLASS =
  'px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ' +
  'dark:text-white text-sm';

/**
 * The legs of a journey. Legacy stored these in travel_journey_details, one row
 * per leg, and summed their amounts into the request's journey total.
 *
 * The booking platform is per leg because a single trip can mix them -- rail
 * through IRCTC and a flight through Balmer Lawrie, for instance.
 *
 * The parent owns all state, matching the field-array contract used elsewhere.
 */
export default function JourneyLegsFieldArray({ items, onChange, minDate, maxDate }) {
  const update = (index, field, value) => {
    onChange(items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'date' && updated.arrivalDate && updated.arrivalDate < value) {
        updated.arrivalDate = value;
      }
      return updated;
    }));
  };

  const handleModeChange = (index, newMode) => {
    const leg = items[index];
    const updatedLeg = { ...leg, mode: newMode };
    if (newMode === 'Air' && leg.platform === 'Other') {
      updatedLeg.platform = 'IRCTC';
    }
    onChange(items.map((item, i) => (i === index ? updatedLeg : item)));
  };

  const add = () =>
    onChange([
      ...items,
      { from: '', to: '', date: minDate ?? '', arrivalDate: '', mode: 'Rail', platform: 'IRCTC', amount: '', remarks: '' },
    ]);

  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  const total = items.reduce((sum, leg) => {
    const amount = Number(leg.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route size={16} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Journey Details <span className="text-red-500">*</span>
          </span>
        </div>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <Plus size={16} /> Add Leg
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>{BOOKING_PLATFORM_DISCLAIMER}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs italic text-slate-400 dark:text-slate-500">
          At least one journey leg is required.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((leg, index) => (
            <div
              key={index}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Leg {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove journey leg ${index + 1}`}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <input
                  required
                  type="text"
                  value={leg.from}
                  onChange={(e) => update(index, 'from', e.target.value)}
                  placeholder="From"
                  aria-label={`Leg ${index + 1} from`}
                  className={FIELD_CLASS}
                />
                <input
                  required
                  type="text"
                  value={leg.to}
                  onChange={(e) => update(index, 'to', e.target.value)}
                  placeholder="To"
                  aria-label={`Leg ${index + 1} to`}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Departure Date</label>
                  <input
                    required
                    type="date"
                    value={leg.date}
                    min={minDate || undefined}
                    max={maxDate || undefined}
                    onChange={(e) => update(index, 'date', e.target.value)}
                    aria-label={`Leg ${index + 1} departure date`}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Arrival Date</label>
                  <input
                    type="date"
                    value={leg.arrivalDate || ''}
                    min={leg.date || minDate || undefined}
                    max={maxDate || undefined}
                    onChange={(e) => update(index, 'arrivalDate', e.target.value)}
                    aria-label={`Leg ${index + 1} arrival date`}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Amount</label>
                  <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={leg.amount}
                  onChange={(e) => update(index, 'amount', e.target.value)}
                  placeholder="Amount (₹)"
                  aria-label={`Leg ${index + 1} amount`}
                  className={FIELD_CLASS}
                />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Mode</label>
                  <select
                    value={leg.mode}
                    onChange={(e) => handleModeChange(index, e.target.value)}
                    aria-label={`Leg ${index + 1} mode`}
                    className={FIELD_CLASS}
                  >
                    {LEG_TRAVEL_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>{mode.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Platform</label>
                  <select
                  value={leg.platform}
                  onChange={(e) => update(index, 'platform', e.target.value)}
                  aria-label={`Leg ${index + 1} booking platform`}
                  className={FIELD_CLASS}
                >
                    {(leg.mode === 'Air' ? AIR_BOOKING_PLATFORMS : BOOKING_PLATFORMS).map((platform) => (
                      <option key={platform.value} value={platform.value}>{platform.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                {leg.mode === 'RoadPrivateTaxi' && (
                  <label className="text-xs font-bold text-red-500 ml-1">
                    Taxi Travel Mandatory Justification / Reason *
                  </label>
                )}
                {leg.mode === 'RoadPrivateTaxi' ? (
                  <textarea
                    required
                    rows="2"
                    value={leg.remarks}
                    onChange={(e) => update(index, 'remarks', e.target.value)}
                    placeholder="Provide a strong mandatory justification reason for taxi travel..."
                    aria-label={`Leg ${index + 1} taxi justification`}
                    className={`${FIELD_CLASS} w-full resize-none custom-scrollbar`}
                  />
                ) : (
                  <input
                    type="text"
                    value={leg.remarks}
                    onChange={(e) => update(index, 'remarks', e.target.value)}
                    placeholder="Remarks (optional)"
                    aria-label={`Leg ${index + 1} remarks`}
                    className={`${FIELD_CLASS} w-full`}
                  />
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-end text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              Journey total:&nbsp;
              <span className="font-bold tabular-nums text-slate-800 dark:text-slate-200">
                {formatCurrency(total)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
