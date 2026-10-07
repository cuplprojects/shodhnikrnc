// src/services/NotificationService.js
import { pushToast } from '@/components/NotificationContainer';

const notification = () => {
  const notify = (type, message, options = {}) => {
    pushToast({ type, message, ...options });
  };

  return {
    success: (msg, opts) => notify('success', msg, opts),
    info: (msg, opts) => notify('info', msg, opts),
    warning: (msg, opts) => notify('warning', msg, opts),
    error: (msg, opts) => notify('error', msg, opts),
    loading: (msg, opts) => notify('loading', msg, opts),
  };
}; 

export default notification;

