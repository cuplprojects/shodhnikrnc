import { useState, useEffect } from 'react';
import { X, Check, FileText, Save, Eye, LayoutTemplate, Trash2, CheckSquare } from 'lucide-react';
import { getOrCreateRecruitment } from '../utils/recruitmentHelper';
import {
  advertise,
  getAdvertisementTokenValues,
  getRecruitment,
  previewAdvertisement,
  saveAdvertisementDraft,
} from '../../../api/recruitmentApi';
import {
  deleteAdvertisementBodyTemplate,
  listMyAdvertisementBodyTemplates,
  saveAdvertisementBodyTemplate,
} from '../../../api/advertisementBodyTemplatesApi';
import AdvertisementRichTextEditor from './AdvertisementRichTextEditor';

/// Mounts the form only while open so its state can be seeded straight from
/// props, instead of syncing props into state with an effect on every open.
export default function GenerateAdvertisementModal({ isOpen, onClose, project, manpower, onGenerateComplete }) {
  if (!isOpen) return null;

  return (
    <GenerateAdvertisementForm
      key={manpower?.id ?? 'new'}
      onClose={onClose}
      project={project}
      manpower={manpower}
      onGenerateComplete={onGenerateComplete}
    />
  );
}

function GenerateAdvertisementForm({ onClose, project, manpower, onGenerateComplete }) {
  const [recruitmentId, setRecruitmentId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tokenValues, setTokenValues] = useState({});

  // editorKey forces AdvertisementRichTextEditor to remount (and reseed its
  // content from `content`) whenever we programmatically overwrite the
  // editor's content -- it only honors `content` on mount, per this
  // component's own contract.
  const [editorKey, setEditorKey] = useState(0);
  const [editorHtml, setEditorHtml] = useState('');

  const [lastDate, setLastDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Candidate Criteria Configuration
  const [selectedQualifications, setSelectedQualifications] = useState({
    '10th': true,
    '12th': true,
    'UG': true,
    'PG': false,
    'PhD': false,
    'GATE/NET': false,
  });
  const [allowDiplomaFor12th, setAllowDiplomaFor12th] = useState(true);
  const [requireExperience, setRequireExperience] = useState(false);
  const [minExperienceMonths, setMinExperienceMonths] = useState(0);
  const [requirePublications, setRequirePublications] = useState(false);
  const [requireResume, setRequireResume] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState(null);

  // Saved advertisement-body templates (private per PI): a "Templates" picker
  // to load one into the editor, and a "Save as Template" action to store the
  // current content under a name for reuse on a future, unrelated recruitment.
  const [bodyTemplates, setBodyTemplates] = useState([]);
  const [isTemplatesMenuOpen, setIsTemplatesMenuOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  // Tracks whether the editor has any content worth confirming before an
  // overwrite -- flips true the first time the user types or a template
  // loads; deliberately not a deep dirty-check against the original seed.
  const [hasEditorContent, setHasEditorContent] = useState(false);

  useEffect(() => {
    listMyAdvertisementBodyTemplates()
      .then(setBodyTemplates)
      .catch((err) => console.error('Failed to load advertisement templates.', err));
  }, []);

  // Resolve/create the recruitment (+ its live token values) once, on mount
  // -- getOrCreateRecruitment is called exactly once here and its id reused
  // for both the token-values fetch and the final submit.
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!project?.id || !manpower?.id) return;
        const id = await getOrCreateRecruitment(project.id, manpower.id);
        if (!mounted) return;
        setRecruitmentId(id);

        const values = await getAdvertisementTokenValues(id);
        if (mounted) setTokenValues(values ?? {});

        // If this recruitment already has an advertisement (e.g. the modal
        // is being reopened to correct one that was returned by Dean/HOD),
        // seed the editor with its existing content instead of opening
        // blank -- otherwise the PI has to retype the whole body from
        // scratch. A saved draft (from "Save as Draft") takes priority over
        // that submitted text when both exist -- it represents newer
        // in-progress work than whatever was last actually submitted; the
        // draft only exists at all once the PI has explicitly saved one.
        // Both `text` and `draftAdvertisementText` are already well-formed
        // sanitized HTML, so either can be dropped straight into the editor
        // with no parsing.
        const recruitment = await getRecruitment(id);
        const seedText = recruitment?.draftAdvertisementText || recruitment?.text;
        const seedClosingDate = recruitment?.draftAdvertisementText
          ? recruitment?.draftClosingDate
          : recruitment?.closingDate;

        const seedReqQuals = recruitment?.draftRequiredQualifications ?? recruitment?.requiredQualifications;
        if (seedReqQuals) {
          const list = seedReqQuals.split(',').map((s) => s.trim());
          setSelectedQualifications({
            '10th': list.includes('10th'),
            '12th': list.includes('12th'),
            'UG': list.includes('UG'),
            'PG': list.includes('PG'),
            'PhD': list.includes('PhD'),
            'GATE/NET': list.includes('GATE/NET'),
          });
        }
        const seedDiploma = recruitment?.draftAllowDiplomaFor12th ?? recruitment?.allowDiplomaFor12th;
        if (seedDiploma !== undefined && seedDiploma !== null) setAllowDiplomaFor12th(seedDiploma);

        const seedExp = recruitment?.draftRequireExperience ?? recruitment?.requireExperience;
        if (seedExp !== undefined && seedExp !== null) setRequireExperience(seedExp);

        const seedExpMonths = recruitment?.draftMinExperienceMonths ?? recruitment?.minExperienceMonths;
        if (seedExpMonths !== undefined && seedExpMonths !== null) setMinExperienceMonths(seedExpMonths);

        const seedPub = recruitment?.draftRequirePublications ?? recruitment?.requirePublications;
        if (seedPub !== undefined && seedPub !== null) setRequirePublications(seedPub);

        const seedRes = recruitment?.draftRequireResume ?? recruitment?.requireResume;
        if (seedRes !== undefined && seedRes !== null) setRequireResume(seedRes);

        if (mounted && seedText) {
          setEditorHtml(seedText);
          setEditorKey((k) => k + 1);
          setHasEditorContent(true);
          if (seedClosingDate) {
            setLastDate(`${seedClosingDate}T00:00`);
          }
        }
      } catch (err) {
        console.error('Failed to prepare advertisement generation', err);
        if (mounted) setError(err.message ?? 'Failed to load recruitment details.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [project?.id, manpower?.id]);

  const handleEditorChange = (html) => {
    setEditorHtml(html);
    if (html && html.trim()) setHasEditorContent(true);
  };

  const handleLoadTemplate = (template) => {
    if (hasEditorContent) {
      const confirmed = window.confirm(
        `Loading "${template.name}" will replace the current content. Continue?`
      );
      if (!confirmed) return;
    }
    setEditorHtml(template.htmlBody);
    setEditorKey((k) => k + 1);
    setHasEditorContent(true);
    setIsTemplatesMenuOpen(false);
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || isSavingTemplate) return;

    setIsSavingTemplate(true);
    setError(null);
    try {
      await saveAdvertisementBodyTemplate(newTemplateName.trim(), editorHtml);
      const refreshed = await listMyAdvertisementBodyTemplates();
      setBodyTemplates(refreshed);
      setIsSaveTemplateOpen(false);
      setNewTemplateName('');
    } catch (apiErr) {
      console.error('Failed to save advertisement template.', apiErr);
      setError('Failed to save template: ' + (apiErr.response?.data?.message || apiErr.response?.data?.title || apiErr.message));
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    const confirmed = window.confirm(`Delete the template "${template.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteAdvertisementBodyTemplate(template.id);
      setBodyTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (apiErr) {
      console.error('Failed to delete advertisement template.', apiErr);
      setError('Failed to delete template: ' + (apiErr.response?.data?.message || apiErr.response?.data?.title || apiErr.message));
    }
  };

  // A remark is required to advertise (RecruitmentService.AdvertiseAsync
  // throws WorkflowTransitionException when Remarks is null/whitespace) --
  // gate the submit button here too so the user sees why it's blocked
  // instead of a failed request.
  const remarksBlank = !remarks.trim();

  const getRequiredQualificationsString = () => {
    return Object.entries(selectedQualifications)
      .filter(([_, checked]) => checked)
      .map(([qual]) => qual)
      .join(',');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (remarksBlank) {
      setError('A remark is required to advertise this recruitment request.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const id = recruitmentId ?? (await getOrCreateRecruitment(project?.id, manpower?.id));

      await advertise(id, {
        publishedOn: new Date().toISOString().split('T')[0],
        closingDate: lastDate ? new Date(lastDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        text: editorHtml,
        remarks,
        requiredQualifications: getRequiredQualificationsString(),
        allowDiplomaFor12th,
        requireExperience,
        minExperienceMonths: parseInt(minExperienceMonths || 0, 10),
        requirePublications,
        requireResume,
      });

      onClose();
      if (onGenerateComplete) {
        onGenerateComplete(id);
      }
    } catch (apiErr) {
      console.error('Failed to generate advertisement via API.', apiErr);
      setError('Failed to generate advertisement: ' + (apiErr.response?.data?.message || apiErr.response?.data?.title || apiErr.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (isSavingDraft || isSubmitting) return;

    setIsSavingDraft(true);
    setError(null);
    try {
      const id = recruitmentId ?? (await getOrCreateRecruitment(project?.id, manpower?.id));
      await saveAdvertisementDraft(id, {
        text: editorHtml,
        closingDate: lastDate ? new Date(lastDate).toISOString().split('T')[0] : null,
        requiredQualifications: getRequiredQualificationsString(),
        allowDiplomaFor12th,
        requireExperience,
        minExperienceMonths: parseInt(minExperienceMonths || 0, 10),
        requirePublications,
        requireResume,
      });
      setDraftSavedAt(new Date());
    } catch (apiErr) {
      console.error('Failed to save advertisement draft.', apiErr);
      setError('Failed to save draft: ' + (apiErr.response?.data?.message || apiErr.response?.data?.title || apiErr.message));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePreview = async () => {
    setIsPreviewOpen(true);
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const id = recruitmentId ?? (await getOrCreateRecruitment(project?.id, manpower?.id));
      const html = await previewAdvertisement(id, {
        text: editorHtml,
        closingDate: lastDate ? new Date(lastDate).toISOString().split('T')[0] : null,
      });
      setPreviewHtml(html);
    } catch (apiErr) {
      console.error('Failed to render advertisement preview.', apiErr);
      setPreviewError('Failed to load preview: ' + (apiErr.response?.data?.message || apiErr.response?.data?.title || apiErr.message));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Generate Advertisement</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Write the advertisement body below.
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

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800/50">
              {error}
            </div>
          )}

          <form id="generateAdForm" onSubmit={handleSubmit} className="space-y-4">
            {/* Rich text editor -- the sole source of the advertisement body */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Advertisement Body <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTemplatesMenuOpen((v) => !v)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <LayoutTemplate size={14} />
                      Templates
                    </button>
                    {isTemplatesMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsTemplatesMenuOpen(false)} />
                        <div className="absolute top-full mt-1 right-0 z-20 w-64 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1">
                          {bodyTemplates.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                              No saved templates yet.
                            </p>
                          ) : (
                            bodyTemplates.map((t) => (
                              <div
                                key={t.id}
                                className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 group"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleLoadTemplate(t)}
                                  className="flex-1 text-left text-xs font-medium text-slate-700 dark:text-slate-200 truncate"
                                  title={t.name}
                                >
                                  {t.name}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(t)}
                                  className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete template"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSaveTemplateOpen(true)}
                    disabled={!hasEditorContent}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Save size={14} />
                    Save as Template
                  </button>
                  <label htmlFor="lastDate" className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Last Date & Time (IST)
                  </label>
                  <input
                    id="lastDate"
                    type="datetime-local"
                    name="lastDate"
                    value={lastDate}
                    onChange={(e) => setLastDate(e.target.value)}
                    className="px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>
              {isSaveTemplateOpen && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <input
                    type="text"
                    autoFocus
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTemplate(); } }}
                    placeholder="Template name, e.g. JRF Ad - Standard"
                    className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={!newTemplateName.trim() || isSavingTemplate}
                    className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {isSavingTemplate ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSaveTemplateOpen(false); setNewTemplateName(''); }}
                    className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <AdvertisementRichTextEditor
                key={editorKey}
                content={editorHtml}
                onChange={handleEditorChange}
                tokenValues={tokenValues}
                placeholder="Start writing the advertisement..."
                recruitmentId={recruitmentId}
              />
            </div>

            {/* Candidate Requirements Configuration Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CheckSquare size={16} className="text-blue-600 dark:text-blue-400" />
                  Candidate Registration Criteria & Requirements (Set by PI)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure mandatory educational qualifications, experience, and document requirements for applicants applying to this advertisement.
                  <span className="text-slate-600 dark:text-slate-300 font-medium"> Note: Personal Details (Name, Gender, DOB, Parents, Address, Mobile, Email, Category, ID Proof) are fixed system defaults.</span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                {/* Qualification Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Mandatory Qualifications
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['10th', '12th', 'UG', 'PG', 'PhD', 'GATE/NET'].map((qual) => (
                      <label key={qual} className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!selectedQualifications[qual]}
                          onChange={(e) =>
                            setSelectedQualifications((prev) => ({
                              ...prev,
                              [qual]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                        />
                        <span>{qual === '10th' ? '10th Standard' : qual === '12th' ? '12th Standard' : qual === 'UG' ? 'Undergraduate (UG)' : qual === 'PG' ? 'Postgraduate (PG)' : qual === 'PhD' ? 'Ph.D.' : 'GATE / NET / GPAT'}</span>
                      </label>
                    ))}
                  </div>

                  {selectedQualifications['12th'] && (
                    <div className="mt-2 pl-2 border-l-2 border-blue-400 dark:border-blue-600">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allowDiplomaFor12th}
                          onChange={(e) => setAllowDiplomaFor12th(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span>Allow Diploma to substitute 12th requirement</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Experience & Documents */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Experience & Document Requirements
                  </label>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={requireExperience}
                          onChange={(e) => setRequireExperience(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                        />
                        <span>Work / Research Experience Required</span>
                      </label>

                      {requireExperience && (
                        <div className="mt-2 pl-6 flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-400">Min Experience (Months):</span>
                          <input
                            type="number"
                            min="0"
                            value={minExperienceMonths}
                            onChange={(e) => setMinExperienceMonths(Math.max(0, parseInt(e.target.value || '0', 10)))}
                            className="w-20 px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={requirePublications}
                        onChange={(e) => setRequirePublications(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                      <span>Research Publications Record Required</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={requireResume}
                        onChange={(e) => setRequireResume(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                      <span>Resume / CV Upload Required</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks -- required before this can be submitted for approval */}
            <div className="space-y-1">
              <label htmlFor="advertiseRemarks" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Remarks <span className="text-red-500">*</span>
              </label>
              <textarea
                id="advertiseRemarks"
                required
                rows="2"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="A remark is required to submit this advertisement for approval"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex-none p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3 z-10">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isSavingDraft
              ? 'Saving draft...'
              : draftSavedAt
                ? `Draft saved at ${draftSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
          </span>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={isLoading}
              className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Eye size={18} />
              Preview
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isLoading || isSubmitting || isSavingDraft}
              className="px-4 py-2 font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Save size={18} />
              {isSavingDraft ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="submit"
              form="generateAdForm"
              disabled={isLoading || isSubmitting || remarksBlank}
              className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm shadow-blue-500/20"
            >
              <Check size={18} />
              {isSubmitting ? 'Submitting...' : isLoading ? 'Loading...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => setIsPreviewOpen(false)}
          ></div>
          <div className="relative w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Advertisement Preview</h3>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
              {isPreviewLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Rendering preview...
                </div>
              ) : previewError ? (
                <div className="h-full flex items-center justify-center p-6 text-sm text-red-600 dark:text-red-400 text-center">
                  {previewError}
                </div>
              ) : (
                <iframe
                  title="Advertisement preview"
                  srcDoc={previewHtml}
                  sandbox=""
                  className="w-full h-full border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
