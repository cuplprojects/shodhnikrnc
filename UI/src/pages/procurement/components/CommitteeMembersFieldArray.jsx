import { Plus, Trash2, Users } from 'lucide-react';
import { COMMITTEE_ROLES } from '../../../constants/procurementEnums';

/**
 * Roster for the market-survey committee printed on Annexure 11.
 *
 * Legacy carried a single free-text "one faculty/Official" field; the spec
 * replaces it with named members and roles. The parent owns all state, matching
 * the field-array contract used elsewhere in the project forms.
 */
export default function CommitteeMembersFieldArray({ items, onChange }) {
  const update = (index, field, value) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const add = () => onChange([...items, { name: '', role: 'Chairperson' }]);

  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Committee Members
          </span>
        </div>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <Plus size={16} /> Add Member
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Required for the ₹2,00,001–₹25,00,000 non-GeM tier, which prints a market
        survey and quotation evaluation committee on Annexure 11.
      </p>

      {items.length === 0 ? (
        <p className="text-xs italic text-slate-400 dark:text-slate-500">
          No members added yet.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((member, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={member.name}
                onChange={(e) => update(index, 'name', e.target.value)}
                placeholder="Member name"
                aria-label={`Committee member ${index + 1} name`}
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm"
              />
              <select
                value={member.role}
                onChange={(e) => update(index, 'role', e.target.value)}
                aria-label={`Committee member ${index + 1} role`}
                className="sm:w-56 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm"
              >
                {COMMITTEE_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove committee member ${index + 1}`}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors self-start sm:self-auto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
