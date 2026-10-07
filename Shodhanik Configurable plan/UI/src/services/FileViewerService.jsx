import { useState } from 'react';
import getBaseFileURL from '@/utils/getBaseFileUrl';

// Modal Component
const FileViewerModal = ({ isOpen, filePath, fileName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const getFileExtension = (path) => {
    // Remove query parameters first
    const cleanPath = path?.split('?')[0] || '';
    return cleanPath?.split('.')?.pop()?.toLowerCase() || '';
  };

  const isPDF = (path) => getFileExtension(path) === 'pdf';
  const isImage = (path) => ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getFileExtension(path));

  const handleLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleError = () => {
    setLoading(false);
    setError('Failed to load file');
  };



  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          width: '95%',
          maxWidth: '1200px',
          height: '95vh',
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
            {fileName || 'File Viewer'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f4f6',
            padding: '20px',
            minHeight: '500px',
          }}
        >
          {loading && (
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{ marginBottom: '12px' }}>Loading file...</div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #e5e7eb',
                  borderTop: '4px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto',
                }}
              />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', color: '#dc2626' }}>
              <div style={{ marginBottom: '12px' }}>⚠️ {error}</div>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0 0 0' }}>
                You can <a href={filePath} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>download the file</a> instead.
              </p>
            </div>
          )}

          {!error && (
            <>
              {isPDF(filePath) && (
                <iframe
                  src={filePath}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: loading ? 'none' : 'block',
                  }}
                  onLoad={handleLoad}
                  onError={handleError}
                  title={fileName}
                />
              )}

              {isImage(filePath) && (
                <img
                  src={filePath}
                  alt={fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: loading ? 'none' : 'block',
                  }}
                  onLoad={handleLoad}
                  onError={handleError}
                />
              )}

              {!isPDF(filePath) && !isImage(filePath) && (
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                  <div style={{ marginBottom: '12px' }}>📄 File type not supported for preview</div>
                  <p style={{ fontSize: '14px', margin: '8px 0 0 0' }}>
                    <a href={filePath} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                      Download the file
                    </a> to view it.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#e5e7eb',
              color: '#1f2937',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook to manage file viewer state
export const useFileViewer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');

  const openFile = (path, name = 'File') => {
    if (!path) {
      console.warn('File path not available');
      return;
    }
    setFilePath(path);
    setFileName(name);
    setIsOpen(true);
  };

  const closeFile = () => {
    setIsOpen(false);
    setFilePath('');
    setFileName('');
  };

  return {
    isOpen,
    filePath,
    fileName,
    openFile,
    closeFile,
    FileViewerModal: (
      <FileViewerModal
        isOpen={isOpen}
        filePath={filePath}
        fileName={fileName}
        onClose={closeFile}
      />
    ),
  };
};

export default FileViewerModal;
