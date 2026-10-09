import { useState, useEffect } from 'react';
import { LayoutTemplate, Save, Trash2, Eye, X, Printer, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CertificateTemplateToolbar({
  storageKey,
  defaultTemplates = [],
  currentBody,
  onSelectTemplate,
  documentTitle = 'CERTIFICATE PREVIEW',
  certificateTypeLabel = 'Certificate',
}) {
  const [templates, setTemplates] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Load custom templates from localStorage + default templates
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const customTemplates = saved ? JSON.parse(saved) : [];
      setTemplates([...defaultTemplates, ...customTemplates]);
    } catch (e) {
      console.warn('Failed to load certificate templates from localStorage', e);
      setTemplates(defaultTemplates);
    }
  }, [storageKey, defaultTemplates]);

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name.');
      return;
    }
    if (!currentBody || !currentBody.trim()) {
      toast.error('Editor body is empty. Type some content first.');
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      const customTemplates = saved ? JSON.parse(saved) : [];
      const newEntry = {
        id: 'custom-' + Date.now(),
        name: newTemplateName.trim(),
        htmlBody: currentBody,
        isCustom: true,
        createdAt: new Date().toISOString(),
      };
      const updated = [newEntry, ...customTemplates];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setTemplates([...defaultTemplates, ...updated]);
      setIsSaveOpen(false);
      setNewTemplateName('');
      toast.success(`Template "${newEntry.name}" saved successfully!`);
    } catch (e) {
      console.error('Failed to save template', e);
      toast.error('Failed to save template to local storage.');
    }
  };

  const handleDeleteTemplate = (e, templateId, templateName) => {
    e.stopPropagation();
    if (!window.confirm(`Delete the template "${templateName}"?`)) return;

    try {
      const saved = localStorage.getItem(storageKey);
      const customTemplates = saved ? JSON.parse(saved) : [];
      const filtered = customTemplates.filter((t) => t.id !== templateId);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      setTemplates([...defaultTemplates, ...filtered]);
      toast.success(`Template "${templateName}" deleted.`);
    } catch (err) {
      console.error('Failed to delete template', err);
      toast.error('Failed to delete template.');
    }
  };

  const handleSelect = (template) => {
    if (currentBody && currentBody.trim() && currentBody !== '<p></p>') {
      const confirmReplace = window.confirm(
        `Loading "${template.name}" will replace your current editor text. Continue?`
      );
      if (!confirmReplace) return;
    }
    onSelectTemplate(template.htmlBody);
    setIsMenuOpen(false);
    toast.success(`Loaded "${template.name}"`);
  };

  const hasContent = Boolean(currentBody && currentBody.trim() && currentBody !== '<p></p>');

  return (
    <>
      {/* Top Toolbar Actions */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {/* Templates Picker Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <LayoutTemplate size={14} className="text-blue-600 dark:text-blue-400" />
            Templates ({templates.length})
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute top-full mt-1 left-0 z-50 w-72 max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 custom-scrollbar">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                  Select a Template
                </div>
                {templates.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    No saved templates available.
                  </p>
                ) : (
                  templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleSelect(t)}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer group transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                          {t.isCustom ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Custom Template" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" title="System Standard" />
                          )}
                          {t.name}
                        </div>
                        {t.isCustom && (
                          <div className="text-[10px] text-slate-400">
                            Saved template
                          </div>
                        )}
                      </div>
                      {t.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(e, t.id, t.name)}
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                          title="Delete template"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Save as Template Button */}
        <button
          type="button"
          onClick={() => setIsSaveOpen(true)}
          disabled={!hasContent}
          className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Save size={14} className="text-emerald-600 dark:text-emerald-400" />
          Save as Template
        </button>
      </div>

      {/* Save Template Prompt Row */}
      {isSaveOpen && (
        <div className="flex items-center gap-2 p-2.5 mb-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg animate-in fade-in duration-150">
          <input
            type="text"
            autoFocus
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveTemplate();
              }
            }}
            placeholder={`Template name, e.g. Standard ${certificateTypeLabel}`}
            className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
          />
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={!newTemplateName.trim()}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <Check size={13} /> Save
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSaveOpen(false);
              setNewTemplateName('');
            }}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Embedded Floating Preview Modal Trigger (Exposed via Window/Export) */}
    </>
  );
}

export function CertificatePreviewModal({
  isOpen,
  onClose,
  title = 'Certificate Preview',
  certificateTypeLabel = 'Certificate',
  certificateBodyHtml = '',
  extraDetails = {},
}) {
  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const content = document.getElementById('cert-preview-printable-area')?.innerHTML || '';
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; padding: 40px; color: #000; }
            .preview-card { border: none !important; box-shadow: none !important; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Eye size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Official Document Layout Preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Certificate View Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 flex justify-center custom-scrollbar">
          <div
            id="cert-preview-printable-area"
            className="w-full max-w-3xl bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 my-auto min-h-[600px] flex flex-col justify-between"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            {/* Letterhead Header */}
            <div>
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6 gap-4">
                <img
                  src="/images/MNNIT_LOGO.png"
                  alt="MNNIT Logo"
                  className="w-20 h-auto object-contain shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="text-center flex-1">
                  <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">
                    Motilal Nehru National Institute of Technology Allahabad
                  </h2>
                  <p className="text-xs font-semibold text-slate-700">
                    Prayagraj - 211004, Uttar Pradesh, India
                  </p>
                  <p className="text-xs italic text-slate-600 mt-0.5">
                    Office of Research & Consultancy (R&C)
                  </p>
                </div>
              </div>

              {/* Reference & Date */}
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-6">
                <span>Ref No: MNNIT/RNC/{certificateTypeLabel.toUpperCase().replace(/\s+/g, '_')}/2026/PREVIEW</span>
                <span>Date: {todayStr}</span>
              </div>

              {/* Document Title Banner */}
              <div className="text-center my-6">
                <h1 className="text-xl font-bold uppercase underline tracking-wider text-slate-900">
                  {certificateTypeLabel.toUpperCase()}
                </h1>
              </div>

              {/* Formatted Certificate Body */}
              <div
                className="text-base leading-relaxed text-justify space-y-4 my-8 text-slate-900 min-h-[200px]"
                dangerouslySetInnerHTML={{
                  __html: certificateBodyHtml && certificateBodyHtml.trim()
                    ? certificateBodyHtml
                    : '<p className="italic text-slate-400 text-center">(No content typed in editor body yet)</p>',
                }}
              />
            </div>

            {/* Signature Footer Blocks */}
            <div className="pt-12 mt-12 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-8 text-xs font-bold text-slate-800">
                <div className="text-left">
                  <div className="h-12" />
                  <p className="border-t border-slate-400 pt-1 inline-block min-w-[160px]">
                    Head of Department
                  </p>
                  <p className="text-[11px] font-normal text-slate-600">Department of MNNIT</p>
                </div>
                <div className="text-right">
                  <div className="h-12" />
                  <p className="border-t border-slate-400 pt-1 inline-block min-w-[160px]">
                    Dean (Research & Consultancy)
                  </p>
                  <p className="text-[11px] font-normal text-slate-600">MNNIT Allahabad</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 z-10">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2 transition-colors text-xs sm:text-sm"
          >
            <Printer size={16} /> Print Preview
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm transition-colors shadow-sm"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
