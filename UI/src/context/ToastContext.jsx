import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Box, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, severity = 'error') => {
    setToasts((prev) => {
      // Deduplication: if an identical message+severity toast is already visible, don't add another.
      const isDuplicate = prev.some(
        (t) => t.message === message && t.severity === severity
      );
      if (isDuplicate) return prev;

      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return [...prev, { id, message, severity }];
    });
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const handleGlobalError = (event) => {
      if (event.detail && event.detail.message) {
        addToast(event.detail.message, event.detail.severity || 'error');
      }
    };

    window.addEventListener('show-global-toast', handleGlobalError);
    return () => {
      window.removeEventListener('show-global-toast', handleGlobalError);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <Box
        sx={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          maxWidth: 420,
          width: '100%',
          pointerEvents: 'none', // let clicks pass through the container
        }}
      >
        {toasts.map((toast) => (
          <Alert
            key={toast.id}
            severity={toast.severity}
            variant="filled"
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => removeToast(toast.id)}
                sx={{ pointerEvents: 'auto' }}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            }
            sx={{
              pointerEvents: 'auto',
              boxShadow: 6,
              borderRadius: 2,
              fontSize: '0.85rem',
              wordBreak: 'break-word',
              alignItems: 'flex-start',
              '& .MuiAlert-icon': { mt: '2px' },
            }}
          >
            {toast.message}
          </Alert>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};
