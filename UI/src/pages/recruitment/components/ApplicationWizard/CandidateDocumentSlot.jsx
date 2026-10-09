import { useRef, useState } from 'react';
import { CheckCircle2, Download, Eye, Trash2, UploadCloud } from 'lucide-react';
import { uploadDocument, deleteDocument, documentDownloadPath } from '../../../../api/documentsApi';
import ViewManpowerDocumentModal from '../../../projects/components/ViewManpowerDocumentModal';
import AuthenticatedDocumentImage from '../AuthenticatedDocumentImage';

/**
 * One document-upload slot for the application wizard.
 *
 * `DocumentUploader.jsx` (the checklist-driven uploader used by procurement,
 * proposals and travel) is keyed off a `RequestType`/`WorkflowPhase` pair that
 * has to be pre-configured with `DocumentChecklistItem` rows -- the candidate
 * application flow has no such RequestType/WorkflowPhase and none are
 * configured, so that component's checklist query would always come back
 * empty and its "Upload this" affordance (which only appears per checklist
 * item) would never render. This slot talks to the same underlying
 * `/api/documents/upload` and `/api/documents/{id}/download` endpoints
 * directly instead, for one fixed `ownerType`/`ownerId`/`kind` triple, which is
 * exactly what every candidate document field (photo, category certificate,
 * per-row education/experience certificates) needs.
 */
export default function CandidateDocumentSlot({
  ownerType,
  ownerId,
  kind,
  label,
  documentId,
  onChange,
  required = false,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef(null);

  const canUpload = Boolean(ownerType && ownerId && kind);
  const isImageKind = kind === 'CandidatePhoto' || kind === 'CandidateSignature';

  const handleFile = async (file) => {
    if (!file || !canUpload) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('File', file);
      formData.append('OwnerType', ownerType);
      formData.append('OwnerId', ownerId);
      formData.append('Kind', kind);
      const newDocumentId = await uploadDocument(formData);
      onChange?.(newDocumentId);
    } catch (err) {
      // Error is shown via the global toast notification
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!documentId || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteDocument(documentId);
      onChange?.(null);
    } catch (err) {
      // Candidate-owned documents deletion error handling
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {documentId ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10 text-sm flex-wrap">
          {isImageKind ? (
            <AuthenticatedDocumentImage
              documentId={documentId}
              alt={label || 'Uploaded Image'}
              className="w-12 h-14 object-cover rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-sm shrink-0 bg-white"
            />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-500 shrink-0" />
          )}

          <div className="flex-1 min-w-[80px]">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 block">Uploaded</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{label || kind}</span>
          </div>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            <Eye size={13} /> View
          </button>
          <a
            href={documentDownloadPath(documentId)}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
          >
            <Download size={13} /> Download
          </a>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold disabled:opacity-50"
          >
            <Trash2 size={13} /> {isUploading ? 'Uploading…' : 'Replace'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-colors border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          <UploadCloud size={18} />
          <span className="text-sm font-medium">
            {isUploading ? 'Uploading…' : 'Click to upload a file'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

      <ViewManpowerDocumentModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        documentTitle={label}
        documentUrl={documentId ? documentDownloadPath(documentId) : null}
      />
    </div>
  );
}
