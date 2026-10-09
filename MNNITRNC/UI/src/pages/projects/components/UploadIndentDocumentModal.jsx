import React, { useState, useRef } from 'react';
import { X, Upload, UploadCloud } from 'lucide-react';
import { actionWorkflow } from '../../../api/workflowApi';
import { uploadDocument } from '../../../api/documentsApi';

export default function UploadIndentDocumentModal({ isOpen, onClose, indentId, indentType, phase, title, workflowInstanceId, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState("");

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError(null);
    setStatusMessage("Preparing upload...");
    try {
      const formData = new FormData();
      formData.append("File", selectedFile);
      
      const computedOwnerType = indentType === 'Travel' ? 'TravelRequest' : `${indentType}Indent`;
      formData.append("OwnerType", computedOwnerType);
      
      formData.append("OwnerId", indentId);
      formData.append("Kind", "SignedCopy");

      setStatusMessage("Uploading document to server...");
      await uploadDocument(formData);

      if (workflowInstanceId) {
        setStatusMessage("Updating workflow stage...");
        try {
          await actionWorkflow(workflowInstanceId, 'upload-signed-copy');
        } catch (err) {
          console.error("Failed to update workflow:", err);
          throw new Error("Failed to update workflow: " + (err.response?.data?.message || err.message || "Server error"));
        }
      }

      setStatusMessage("Upload successful!");
      setIsProcessing(false);

      // Delay closing slightly so user can see the success message
      setTimeout(() => {
        if (onComplete) {
          // Fire onComplete without awaiting so it doesn't block closing
          onComplete();
        }
        onClose();
      }, 500);
    } catch (err) {
      // Error is shown via the global toast notification
      setIsProcessing(false);
      setError(err.message || "Failed to upload document");
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
    event.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title || 'Upload Document'}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-full transition-colors"
            disabled={isProcessing}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex flex-col gap-3">
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors duration-200 ${isDragOver
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500"
                    : selectedFile
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400"
                      : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" hidden onChange={handleFileInputChange} disabled={isProcessing} />
                <div className="flex flex-col items-center justify-center gap-2">
                  <UploadCloud size={32} className={isDragOver ? "text-blue-600 dark:text-blue-500" : selectedFile ? "text-emerald-500" : "text-slate-400"} />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <p className="font-semibold text-sm">Selected File: {selectedFile.name}</p>
                      <p className="text-xs opacity-75">Click or drag again to change file</p>
                    </div>
                  ) : (
                    <p className="font-medium text-sm">Drag & drop a file here, or click to browse</p>
                  )}
                </div>
              </div>
              {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile || isProcessing}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {statusMessage || "Uploading..."}
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
