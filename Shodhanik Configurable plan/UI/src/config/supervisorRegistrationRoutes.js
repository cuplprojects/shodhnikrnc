/**
 * Supervisor Registration Routes Configuration
 * 
 * Centralized route definitions for supervisor registration forms
 * to avoid hardcoded paths and ensure consistency across all forms.
 */

export const SUPERVISOR_REGISTRATION_ROUTES = {
  HOME: '/register-supervisor/home',
  PERSONAL_INFO: '/register-supervisor/personal-info',
  EDUCATIONAL_DETAILS: '/register-supervisor/educational-details',
  EXPERIENCE_DETAILS: '/register-supervisor/experience-details',
  RESEARCH_PAPER: '/register-supervisor/research-paper',
  UPLOAD_DOCUMENTS: '/register-supervisor/upload-documents',
  PREVIEW: '/register-supervisor/preview',
  PAYMENT: '/register-supervisor/payment',
  PRINT: '/register-supervisor/print',
  STATUS: '/register-supervisor/status'
};

export default SUPERVISOR_REGISTRATION_ROUTES;