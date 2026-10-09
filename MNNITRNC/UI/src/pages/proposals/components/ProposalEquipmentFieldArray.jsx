import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../projects/utils/currency';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 ' +
  'rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-sm shadow-sm';

/** Optional, zero-or-more equipment rows -- mirrors Project's SanctionedEquipment shape exactly. */
export default function ProposalEquipmentFieldArray({ items, onChange }) {
  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => onChange([...items, { name: '', unit: '', amount: '' }]);
  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));

  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col sm:flex-row gap-3">
          <input
            required value={item.name} placeholder="Equipment name"
            onChange={(e) => updateItem(index, 'name', e.target.value)}
            className={`${FIELD_CLASS} flex-1`} aria-label={`Equipment ${index + 1} name`}
          />
          <input
            required value={item.unit} placeholder="Unit"
            onChange={(e) => updateItem(index, 'unit', e.target.value)}
            className={`${FIELD_CLASS} sm:w-32`} aria-label={`Equipment ${index + 1} unit`}
          />
          <input
            required type="number" min="0" step="0.01" value={item.amount} placeholder="Amount"
            onChange={(e) => updateItem(index, 'amount', e.target.value)}
            className={`${FIELD_CLASS} sm:w-40`} aria-label={`Equipment ${index + 1} amount`}
          />
          <button
            type="button" onClick={() => removeItem(index)}
            aria-label={`Remove equipment ${index + 1}`}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button" onClick={addItem}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <Plus size={14} /> Add Equipment
        </button>
        {items.length > 0 && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md">
            Total: {formatCurrency(total)}
          </span>
        )}
      </div>
    </div>
  );
}
