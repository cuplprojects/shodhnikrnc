import { useCallback, useEffect, useRef, useState } from "react";
import { getChecklist, uploadDocument, deleteDocument, documentDownloadPath } from "../api/documentsApi";
import { apiBlob, stripBaseUrl } from "../api/apiClient";
import { CheckCircle2, XCircle, Minus, UploadCloud, Eye, Trash2, Download } from "lucide-react";
import ViewManpowerDocumentModal from "../pages/projects/components/ViewManpowerDocumentModal";

/**
 * Checklist plus drag-and-drop upload for one request.
 *
 * The API keys documents by (ownerType, ownerId) and classifies them by
 * DocumentKind, and the checklist endpoint additionally needs the request type
 * and phase.
 */
export default function DocumentUploader({
  ownerType,
  ownerId,
  requestType,
  phase,
  onUploaded,
  allowDelete = false,
  // DocumentKind values to treat as mandatory right now -- for a document
  // that becomes required by other data on the request (e.g. a proposal's
  // Co-PI consent, mandatory only once a Co-PI is declared) rather than by
  // the checklist row's own static IsMandatory flag, which
  // SubmitForApprovalAsync enforces server-side but the checklist item
  // itself can't express. Implies both visible (even before upload) and
  // styled as mandatory (red icon, "Mandatory" badge) -- a conditionally
  // required document is never shown as merely optional.
  conditionallyMandatoryKinds = [],
  readOnly = false,
}) {
  const [checklist, setChecklist] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  // Which checklist row the next upload satisfies. The API classifies by
  // DocumentKind, so the row's kind is what actually gets sent.
  const [pendingItem, setPendingItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canQuery = Boolean(ownerType && ownerId && requestType && phase);

  const refreshChecklist = useCallback(async () => {
    if (!canQuery) return;
    const result = await getChecklist({ requestType, phase, requestId: ownerId, ownerType });
    setChecklist(result);
  }, [canQuery, requestType, phase, ownerId, ownerType]);

  useEffect(() => {
    if (!canQuery) return undefined;
    let ignore = false;
    getChecklist({ requestType, phase, requestId: ownerId, ownerType })
      .then((result) => {
        if (!ignore) setChecklist(result);
      })
      .catch(() => {
        if (!ignore) setChecklist(null);
      });
    return () => {
      ignore = true;
    };
  }, [canQuery, requestType, phase, ownerId, ownerType]);

  const uploadFile = useCallback(
    async (file, item) => {
      if (!item) {
        setError('Choose which checklist item this file satisfies first.');
        return;
      }

      setIsUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("File", file);
        formData.append("OwnerType", ownerType);
        formData.append("OwnerId", ownerId);
        formData.append("Kind", item.documentKind);

        const document = await uploadDocument(formData);
        await refreshChecklist();
        setPendingItem(null);
        onUploaded?.(document);
      } catch (err) {
        // Error is shown via the global toast notification
      } finally {
        setIsUploading(false);
      }
    },
    [ownerType, ownerId, refreshChecklist, onUploaded]
  );

  const handleDelete = useCallback(
    async (item) => {
      if (isDeleting || !item.documentId) return;
      setIsDeleting(true);
      setError(null);
      try {
        await deleteDocument(item.documentId);
        await refreshChecklist();
      } catch (err) {
        // Error is shown via the global toast notification
      } finally {
        setIsDeleting(false);
      }
    },
    [isDeleting, refreshChecklist]
  );

  const handleDownload = async (url, title) => {
    try {
      const path = stripBaseUrl(url);
      const blob = await apiBlob(path);
      const downloadUrl = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${title || "Document"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to download document", err);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadFile(file, pendingItem);
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadFile(file, pendingItem);
    event.target.value = "";
  };

  // Deduplicate items by name & filter checklist items:
  // - Filter out "Generated Indent Form"
  // - Hide optional items if they are not uploaded (only show mandatory items or uploaded optional items)
  const deduplicatedMap = new Map();
  (checklist?.items || []).forEach((item) => {
    const key = (item.name || "").trim().toLowerCase();
    if (!key) return;
    const existing = deduplicatedMap.get(key);
    if (!existing) {
      deduplicatedMap.set(key, item);
    } else if (item.isSatisfied && !existing.isSatisfied) {
      deduplicatedMap.set(key, item);
    }
  });

  const isEffectivelyMandatory = (item) => item.isMandatory || conditionallyMandatoryKinds.includes(item.documentKind);

  const displayItems = Array.from(deduplicatedMap.values())
    .filter((item) => {
      const lowerName = (item.name || "").toLowerCase();
      if (lowerName.includes("generated indent form")) return false;
      if (readOnly && !item.isSatisfied) return false;
      // Show item if it is (effectively) Mandatory or already Satisfied (uploaded).
      return isEffectivelyMandatory(item) || item.isSatisfied;
    })
    .map((item) => ({ ...item, isMandatory: isEffectivelyMandatory(item) }));

  if (displayItems.length === 0 && readOnly) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {checklist && (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {displayItems.map((item) => {
            const lowerName = (item.name || "").toLowerCase();
            const isSignedCopy = lowerName.includes("signed indent copy") || lowerName.includes("signed copy");

            return (
              <li
                key={item.checklistItemId}
                className={`flex flex-wrap items-center gap-2 text-sm p-2 rounded-lg border border-slate-100 dark:border-slate-800 ${
                  item.isSatisfied
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                    : "text-slate-800 dark:text-slate-200"
                }`}
              >
                <span className="flex-shrink-0">
                  {item.isSatisfied ? (
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-500" />
                  ) : item.isMandatory ? (
                    <XCircle size={16} className="text-rose-500 dark:text-rose-400" />
                  ) : (
                    <Minus size={16} className="text-slate-400" />
                  )}
                </span>
                <span className="font-medium">{item.name}</span>
                {item.isMandatory && (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                    Mandatory
                  </span>
                )}

                <div className="flex items-center gap-2.5 ml-auto">
                  {/* For Signed Indent Copy: ALWAYS give View, Download, and Upload/Replace */}
                  {isSignedCopy ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const url = item.documentId
                            ? documentDownloadPath(item.documentId)
                            : requestType === 'Travel'
                              ? `/api/v1/travel/dynamic/${ownerId}/document`
                              : `/api/v1/indents/dynamic/${ownerId}/document`;
                          setPreviewItem({ ...item, customUrl: url });
                        }}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        <Eye size={13} /> View
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const url = item.documentId
                            ? documentDownloadPath(item.documentId)
                            : requestType === 'Travel'
                              ? `/api/v1/travel/dynamic/${ownerId}/document`
                              : `/api/v1/indents/dynamic/${ownerId}/document`;
                          handleDownload(url, item.name);
                        }}
                        className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                      >
                        <Download size={13} /> Download
                      </button>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingItem(item);
                            fileInputRef.current?.click();
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition font-semibold"
                        >
                          <UploadCloud size={13} /> {item.isSatisfied ? "Replace Signed Copy" : "Upload Signed Copy"}
                        </button>
                      )}
                    </>
                  ) : (
                    /* For all other uploaded documents: View and Download options */
                    <>
                      {item.isSatisfied && item.documentId && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            <Eye size={13} /> View
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(documentDownloadPath(item.documentId), item.name)}
                            className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            <Download size={13} /> Download
                          </button>

                          {allowDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={isDeleting}
                              className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold disabled:opacity-50"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </>
                      )}

                      {(!item.isSatisfied && !readOnly) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingItem(item);
                            fileInputRef.current?.click();
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          Upload this
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors duration-200 ${
            isDragOver 
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500" 
              : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" hidden onChange={handleFileInputChange} />
          <div className="flex flex-col items-center justify-center gap-2">
            <UploadCloud size={32} className={isDragOver ? "text-blue-600 dark:text-blue-500" : "text-slate-400"} />
            <p className="font-medium text-sm">
              {isUploading ? "Uploading…" : "Drag & drop a file here, or click to browse"}
            </p>
          </div>
          {pendingItem && (
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-2">
              Uploading for: {pendingItem.name}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

      <ViewManpowerDocumentModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        documentTitle={previewItem?.name}
        documentUrl={
          previewItem?.customUrl
            ? previewItem.customUrl
            : previewItem
            ? documentDownloadPath(previewItem.documentId)
            : null
        }
      />
    </div>
  );
}
