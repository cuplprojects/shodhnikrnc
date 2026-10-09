import { X, FileText, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiBlob, stripBaseUrl } from '../../../api/apiClient';

export default function ViewManpowerDocumentModal({ isOpen, onClose, documentType, documentTitle, documentUrl }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [isImage, setIsImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && documentUrl) {
      if (documentUrl.startsWith('blob:')) {
        setBlobUrl(documentUrl);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      const path = stripBaseUrl(documentUrl);
      apiBlob(path)
        .then((blob) => {
          const mime = blob.type || '';
          const titleStr = (documentTitle || documentType || '').toLowerCase();
          const detectedImage =
            mime.startsWith('image/') ||
            titleStr.includes('photo') ||
            titleStr.includes('signature') ||
            path.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);

          setIsImage(Boolean(detectedImage));
          const url = window.URL.createObjectURL(
            new Blob([blob], { type: mime || (detectedImage ? 'image/jpeg' : 'application/pdf') })
          );
          setBlobUrl(url);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load document', err);
          setError('Failed to load document. Make sure it has been generated.');
          setIsLoading(false);
        });
    }
    return () => {
      if (blobUrl && !documentUrl?.startsWith('blob:')) window.URL.revokeObjectURL(blobUrl);
    };
  }, [isOpen, documentUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                View Document: {documentTitle || documentType}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-800/50 relative flex">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p>Loading document...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-red-500">
              <p>{error}</p>
            </div>
          ) : blobUrl ? (
            isImage ? (
              <div className="flex-1 flex items-center justify-center p-6 bg-slate-900/90 overflow-auto">
                <img
                  src={blobUrl}
                  alt={documentTitle || documentType}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-slate-700"
                />
              </div>
            ) : (
              <iframe 
                src={blobUrl} 
                className="w-full h-full border-0" 
                title={documentTitle || documentType}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
              <FileText size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-bold text-slate-900 mb-2 dark:text-white">No Document Source</h3>
              <p className="text-sm max-w-sm">No valid URL or generated document found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
