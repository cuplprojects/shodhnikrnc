import { apiGet, apiPost, apiBlob } from './apiClient';

export async function raiseDynamicIndent(formData) {
  const response = await apiPost('/api/v1/indents/dynamic/raise', formData);
  return response.indentId;
}

export async function downloadDynamicIndentDocument(indentId) {
  const blob = await apiBlob(`/api/v1/indents/dynamic/${indentId}/document`);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `Indent_${indentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export async function uploadDynamicIndentSignedPdf(indentId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiPost(`/api/v1/indents/dynamic/${indentId}/upload-signed-pdf`, formData);
}

export async function getDynamicIndentDetail(indentId) {
  return apiGet(`/api/v1/indents/dynamic/${indentId}`);
}
