import { useState } from 'react';
import { Save, X, Plus } from 'lucide-react';
import { updateAdvertisementTemplate } from '../../../api/advertisementTemplatesApi';
import { ADVERTISEMENT_TOKENS } from '../../../constants/advertisementTokens';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm';

/**
 * The 8 AdvertisementSectionKey values (API.Domain.Enums.AdvertisementSectionKey),
 * in the fixed order the reference application form prints them. Structural
 * rows (project file no., title, position count, etc.) are entity-bound and
 * never appear here -- only the wording a PI can actually edit.
 */
const SECTION_KEYS = [
  { key: 'EssentialQualifications', label: 'Essential Qualifications' },
  { key: 'Salary', label: 'Salary' },
  { key: 'OtherBenefits', label: 'Other Benefits' },
  { key: 'AgeLimit', label: 'Age Limit' },
  { key: 'TenureOfAppointment', label: 'Tenure of Appointment' },
  { key: 'DesirableQualifications', label: 'Desirable Qualifications' },
  { key: 'HowToApply', label: 'How to Apply' },
  { key: 'Notes', label: 'Notes' },
];

function buildInitialSections(template) {
  const byKey = new Map((template?.sections ?? []).map((s) => [s.key, s]));
  return SECTION_KEYS.map(({ key }, index) => {
    const existing = byKey.get(key);
    return {
      key,
      content: existing?.content ?? '',
      isIncluded: existing?.isIncluded ?? true,
      sortOrder: existing?.sortOrder ?? index,
    };
  });
}

/**
 * Edits one advertisement template's name and its 8 fixed sections. Save
 * calls PUT /api/advertisement-templates/{id} (owner-only on the server;
 * this component assumes the caller already checked ownership before
 * rendering it -- see AdvertisementTemplatesPage).
 */
export default function AdvertisementTemplateEditor({ template, onSaved, onCancel }) {
  const [name, setName] = useState(template.name);
  const [sections, setSections] = useState(() => buildInitialSections(template));
  const [tokenTargetKey, setTokenTargetKey] = useState(SECTION_KEYS[0].key);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const updateSection = (key, patch) => {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const insertToken = (token) => {
    setSections((prev) =>
      prev.map((s) => (s.key === tokenTargetKey ? { ...s, content: `${s.content}{{${token}}}` } : s))
    );
  };

  const handleSave = async () => {
    if (isSaving || !name.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await updateAdvertisementTemplate(template.id, {
        name: name.trim(),
        sections: sections.map((s) => ({
          key: s.key,
          content: s.content,
          isIncluded: s.isIncluded,
          sortOrder: s.sortOrder,
        })),
      });
      onSaved?.();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
      {error && (
        <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Template Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex items-end gap-2 flex-wrap p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Insert token into
          </label>
          <select
            value={tokenTargetKey}
            onChange={(e) => setTokenTargetKey(e.target.value)}
            className={FIELD_CLASS}
          >
            {SECTION_KEYS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ADVERTISEMENT_TOKENS.map(({ key }) => (
            <button
              key={key}
              type="button"
              onClick={() => insertToken(key)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 hover:border-blue-300"
              title={`Insert {{${key}}}`}
            >
              <Plus size={12} /> {key}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const meta = SECTION_KEYS.find((s) => s.key === section.key);
          return (
            <div key={section.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {meta?.label ?? section.key}
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={section.isIncluded}
                    onChange={(e) => updateSection(section.key, { isIncluded: e.target.checked })}
                  />
                  Include in advertisement
                </label>
              </div>
              <textarea
                value={section.content}
                onChange={(e) => updateSection(section.key, { content: e.target.value })}
                rows={3}
                disabled={!section.isIncluded}
                className={`${FIELD_CLASS} custom-scrollbar disabled:opacity-50`}
                placeholder="Use {{TokenName}} for values filled in automatically at advertise time."
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X size={16} className="inline -mt-0.5 mr-1" /> Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Save size={16} /> {isSaving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
