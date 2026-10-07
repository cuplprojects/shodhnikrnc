import { useEffect, useState } from 'react';
import { apiBlob, stripBaseUrl } from '../../../api/apiClient';
import { documentDownloadPath } from '../../../api/documentsApi';

export default function AuthenticatedDocumentImage({
  documentId,
  documentUrl,
  alt = 'Document Image',
  className = '',
  fallback = null,
}) {
  const [src, setSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    const path = documentUrl || (documentId ? documentDownloadPath(documentId) : null);
    if (!path) {
      setSrc(null);
      setIsLoading(false);
      return;
    }

    if (path.startsWith('blob:') || path.startsWith('data:')) {
      setSrc(path);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);
    const cleanPath = stripBaseUrl(path);

    apiBlob(cleanPath)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setIsLoading(false);
        setError(false);
      })
      .catch((err) => {
        console.error('Failed to load authenticated document blob image:', err);
        if (!active) return;
        setError(true);
        setIsLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, documentUrl]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent" />
      </div>
    );
  }

  if (error || !src) {
    return fallback;
  }

  return <img src={src} alt={alt} className={className} />;
}
