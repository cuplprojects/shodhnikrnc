import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, CheckCircle2, XCircle, Eye, Download, Trash2, UploadCloud } from 'lucide-react';
import { recordAgencySubmission, recordSanction, recordNotFunded } from '../../../api/proposalsApi';
import { getChecklist, uploadDocument, deleteDocument, documentDownloadPath } from '../../../api/documentsApi';
import { apiBlob } from '../../../api/apiClient';
import ViewManpowerDocumentModal from '../../projects/components/ViewManpowerDocumentModal';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
  'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white text-sm';

const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

/**
 * The actions that happen after the internal chain has concluded:
 * record-agency-submission, record-sanction, record-not-funded. The server
 * is the real gate -- reachable by the RnC office for any proposal, or by
 * the PI for their own (they sometimes handle the agency submission and its
 * outcome themselves; see ResearchProposalService.RequireOfficeOrOwnerAsync).
 *
 * ProposalDetailPage only renders this component for a Faculty caller (the
 * PI role) -- the agency-facing steps are the PI's own business once the
 * Dean/Director has approved, not something an HOD/Dean/office viewer needs
 * cluttering their view of a proposal they no longer act on. The frontend
 * still has no reliable way to know the viewer is the SPECIFIC PI who owns
 * this proposal (vs. some other Faculty account), so the server's own
 * ownership check remains the real gate; a Faculty viewer who isn't this
 * proposal's PI gets the server's rejection surfaced inline rather than the
 * form being hidden and guessing wrong.
 *
 * record-sanction is the only path anywhere that creates a Project; its
 * response is the new Project's id, surfaced as a link to the project detail
 * page so the acting user can jump straight to it.
 */
export default function ProposalAgencyActions({ proposal, onActed }) {
  const navigate = useNavigate();
  const { id, status } = proposal;

  const [submittedOn, setSubmittedOn] = useState('');
  const [sanction, setSanction] = useState({
    sanctionNo: '', sanctionDate: '', projectStartDate: '', totalSanctioned: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdProjectId, setCreatedProjectId] = useState(null);

  // Sanction Letter Document State
  const [sanctionDoc, setSanctionDoc] = useState(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileInputRef = useRef(null);

  const fetchSanctionLetterDoc = useCallback(async () => {
    if (!id) return;
    try {
      const checklist = await getChecklist({
        requestType: 'ResearchProposal',
        phase: 'Indent',
        requestId: id,
        ownerType: 'ResearchProposal',
      });
      const item = (checklist?.items || []).find(
        (i) => i.documentKind === 'SanctionLetter' || (i.name || '').toLowerCase() === 'sanction letter'
      );
      if (item) {
        setSanctionDoc({ id: item.documentId || null, isSatisfied: Boolean(item.isSatisfied) });
      } else {
        setSanctionDoc(null);
      }
    } catch {
      setSanctionDoc(null);
    }
  }, [id]);

  useEffect(() => {
    if (status === 'SubmittedToAgency') {
      void fetchSanctionLetterDoc();
    }
  }, [status, fetchSanctionLetterDoc]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('File', file);
      formData.append('OwnerType', 'ResearchProposal');
      formData.append('OwnerId', id);
      formData.append('Kind', 'SanctionLetter');

      await uploadDocument(formData);
      await fetchSanctionLetterDoc();
    } catch (err) {
      setError(err.message || 'Failed to upload Sanction Letter.');
    } finally {
      setIsUploadingDoc(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDocDelete = async () => {
    if (!sanctionDoc?.id || isDeletingDoc) return;
    setIsDeletingDoc(true);
    setError(null);
    try {
      await deleteDocument(sanctionDoc.id);
      await fetchSanctionLetterDoc();
    } catch (err) {
      setError(err.message || 'Failed to delete Sanction Letter.');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleDocDownload = async () => {
    if (!sanctionDoc?.id) return;
    try {
      const path = documentDownloadPath(sanctionDoc.id);
      const blob = await apiBlob(path);
      const downloadUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'Sanction_Letter.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError('Failed to download Sanction Letter.');
    }
  };

  const handleAgencySubmission = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await recordAgencySubmission(id, submittedOn);
      onActed?.();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSanctionDateChange = (newSanctionDate) => {
    setSanction((s) => {
      const updated = { ...s, sanctionDate: newSanctionDate };
      if (s.projectStartDate && newSanctionDate && s.projectStartDate < newSanctionDate) {
        updated.projectStartDate = newSanctionDate;
      }
      return updated;
    });
  };

  const handleSanction = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!sanctionDoc?.isSatisfied) {
      setError('Sanction Letter is mandatory. Please upload the Sanction Letter before recording sanction.');
      return;
    }

    const startDate = sanction.projectStartDate || sanction.sanctionDate;
    if (sanction.sanctionDate && startDate < sanction.sanctionDate) {
      setError('Project start date cannot be earlier than sanction date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const projectId = await recordSanction(id, {
        sanctionNo: sanction.sanctionNo,
        sanctionDate: sanction.sanctionDate,
        projectStartDate: startDate || null,
        totalSanctioned: Number(sanction.totalSanctioned) || 0,
      });
      setCreatedProjectId(projectId);
      onActed?.();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotFunded = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await recordNotFunded(id);
      onActed?.();
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!['Approved', 'SubmittedToAgency'].includes(status)) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Landmark size={16} className="text-slate-500 dark:text-slate-400" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Funding Agency</h2>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {createdProjectId && (
        <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-900/20 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            Sanction recorded — a Project was created.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/projects/${createdProjectId}`)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            Open project
          </button>
        </div>
      )}

      {status === 'Approved' && (
        <form onSubmit={handleAgencySubmission} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Record that the approved proposal has been sent to the funding agency.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="space-y-1 flex-1">
              <label className={LABEL_CLASS}>Submitted on <span className="text-red-500">*</span></label>
              <input required type="date" value={submittedOn}
                onChange={(e) => setSubmittedOn(e.target.value)} className={FIELD_CLASS} />
            </div>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
              Record submission
            </button>
          </div>
        </form>
      )}

      {status === 'SubmittedToAgency' && (
        <div className="space-y-5">
          <form onSubmit={handleSanction} className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Record sanction</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Sanction No. <span className="text-red-500">*</span></label>
                <input required value={sanction.sanctionNo}
                  onChange={(e) => setSanction((s) => ({ ...s, sanctionNo: e.target.value }))}
                  className={FIELD_CLASS} />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Total sanctioned (₹) <span className="text-red-500">*</span></label>
                <input required type="number" min="0" step="0.01" value={sanction.totalSanctioned}
                  onChange={(e) => setSanction((s) => ({ ...s, totalSanctioned: e.target.value }))}
                  className={FIELD_CLASS} />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Sanction date <span className="text-red-500">*</span></label>
                <input required type="date" value={sanction.sanctionDate}
                  onChange={(e) => handleSanctionDateChange(e.target.value)}
                  className={FIELD_CLASS} />
              </div>
              <div className="space-y-1">
                <label className={LABEL_CLASS}>Project start date</label>
                <input type="date" value={sanction.projectStartDate}
                  min={sanction.sanctionDate || undefined}
                  onChange={(e) => setSanction((s) => ({ ...s, projectStartDate: e.target.value }))}
                  className={FIELD_CLASS} />
              </div>
            </div>

            {/* Mandatory Sanction Letter Upload Slot */}
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className={LABEL_CLASS}>
                Sanction Letter <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex flex-wrap items-center gap-2 text-sm p-3 rounded-xl border ${
                  sanctionDoc?.isSatisfied
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <span className="flex-shrink-0">
                  {sanctionDoc?.isSatisfied ? (
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-500" />
                  ) : (
                    <XCircle size={18} className="text-rose-500 dark:text-rose-400" />
                  )}
                </span>
                <span className="font-semibold text-slate-800 dark:text-white">Sanction Letter</span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                  Mandatory
                </span>

                <div className="flex items-center gap-3 ml-auto">
                  {sanctionDoc?.isSatisfied && sanctionDoc?.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(documentDownloadPath(sanctionDoc.id))}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        type="button"
                        onClick={handleDocDownload}
                        className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        type="button"
                        onClick={handleDocDelete}
                        disabled={isDeletingDoc}
                        className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold disabled:opacity-50"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        hidden
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        disabled={isUploadingDoc}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition disabled:opacity-50"
                      >
                        <UploadCloud size={14} />
                        {isUploadingDoc ? 'Uploading...' : 'Upload Sanction Letter'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
                Record sanction — create project
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The agency declined, or did not respond.
            </p>
            <button type="button" disabled={isSubmitting} onClick={handleNotFunded}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/30">
              Record not funded
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal for Sanction Letter */}
      <ViewManpowerDocumentModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        documentTitle="Sanction Letter"
        documentUrl={previewDoc}
      />
    </div>
  );
}

