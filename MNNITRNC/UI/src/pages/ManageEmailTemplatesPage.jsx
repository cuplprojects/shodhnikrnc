import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../layout/useTheme';
import { listEmailTemplates, updateEmailTemplate } from '../api/emailTemplatesApi';
import RichTextEditor from '../components/RichTextEditor';
import { Mail, Save, Check } from 'lucide-react';

export default function ManageEmailTemplatesPage() {
  useTheme();
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const loadTemplates = useCallback(async () => {
    const data = await listEmailTemplates();
    setTemplates(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const selected = templates.find((t) => t.id === selectedId);

  const handleSelect = (template) => {
    setSelectedId(template.id);
    setSubject(template.subject);
    setHtmlBody(template.htmlBody);
    setError(null);
  };

  const handleInsertPlaceholder = (name) => {
    setSubject((prev) => prev); // placeholders are inserted into the body via the editor; subject gets a manual click-setHtmlBody((prev) => prev + `{{${name}}}`);
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateEmailTemplate(selected.id, subject, htmlBody);
      setToastMessage('Template saved.');
      await loadTemplates();
    } catch (err) {
      setError(err.message ?? 'Save failed — check for an unrecognized placeholder.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Manage Email Templates</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Edit the subject and body sent for each approval outcome.
        </p>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <Check size={16} />{toastMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelect(t)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                selectedId === t.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Mail size={14} />{t.name}
              </span>
              {t.isSystemDefault && (
                <span className="block text-[10px] font-bold opacity-70 mt-0.5">System default</span>
              )}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {!selected ? (
            <p className="text-slate-500 dark:text-slate-400">Select a template to edit.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Body</label>
                <RichTextEditor key={selected.id} content={htmlBody} onChange={setHtmlBody} height={350} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Insert variable</label>
                <div className="flex flex-wrap gap-2">
                  {selected.placeholders.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleInsertPlaceholder(name)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                      {`{{${name}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl text-sm font-semibold text-rose-700 dark:text-rose-400">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
              >
                <Save size={16} />{isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
