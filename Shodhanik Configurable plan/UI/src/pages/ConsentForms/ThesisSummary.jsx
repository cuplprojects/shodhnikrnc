import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Spin } from 'antd';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import notification from '@/services/NotificationService';


const ThesisSummary = () => {
  const notify = notification();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const baseFileURL = getBaseFileURL();

  // Token validation state
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Documents state
  const [documentsData, setDocumentsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validate token and fetch documents on page load
  useEffect(() => {
    const validateTokenAndFetchData = async () => {
      if (!token) {
        setIsValidating(false);
        setIsValid(false);
        setErrorMessage('No token provided. Please use the link from your email.');
        return;
      }

      try {
        setIsValidating(true);

        // First validate the token and get the documents data
        const response = await API.post(
          '/Confidential/summary-details',
          { token }
        );

        if (response.status === 200 && response.data) {
          setIsValid(true);
          setDocumentsData(response.data);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValid(false);

        if (error.response?.status === 400) {
          const message = error.response?.data;
          setErrorMessage(message || 'Invalid or expired link.');
        } else {
          setErrorMessage('Failed to validate link. Please try again later.');
        }
      } finally {
        setIsValidating(false);
      }
    };

    validateTokenAndFetchData();
  }, [token]);


  const handleDownload = (filePath, fileName) => {
    if (!filePath) {
      notify.info('File not available');
      return;
    }

    // Create download link
    const downloadUrl = `${baseFileURL}/${filePath}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || filePath.split('/').pop();
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // If examiner1Report === 0, show only Thesis Summary; otherwise show all documents
  const allDocuments = [
    {
      label: 'Synopsis',
      filePath: documentsData?.SynopsisFilePath,
      fileName: 'Synopsis.pdf'
    },
    {
      label: 'Thesis File',
      filePath: documentsData?.ThesisFile,
      fileName: 'Thesis.pdf'
    },
    {
      label: 'Thesis Summary',
      filePath: documentsData?.ThesisSummaryFile,
      fileName: 'Thesis_Summary.pdf'
    },
    {
      label: 'Research Paper 1',
      filePath: documentsData?.ResearchPaper1,
      fileName: 'Research_Paper_1.pdf'
    },
    {
      label: 'Research Paper 2',
      filePath: documentsData?.ResearchPaper2,
      fileName: 'Research_Paper_2.pdf'
    },
    {
      label: 'Conference 1',
      filePath: documentsData?.Conference1,
      fileName: 'Conference_1.pdf'
    }
  ];

  const documentRows = documentsData?.examiner1Report === 0
    ? [{ label: 'Thesis Summary', filePath: documentsData?.ThesisSummaryFile, fileName: 'Thesis_Summary.pdf' }].filter(row => row.filePath)
    : allDocuments.filter(row => row.filePath);

  // Token validation loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Validating your access...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!isValid) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white border border-gray-300 shadow-sm p-8 max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact the university administration.
          </p>
        </div>
      </div>
    );
  }

  // Documents loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-600">Loading thesis evaluation documents...</p>
          </div>
        </div>
      </div>
    );
  }

  // Documents error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-600 text-xl mb-2">⚠️ Error</div>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white border border-gray-300 shadow-lg">
          {/* Title Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-600 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={24} />
                <h1 className="text-xl font-bold">Thesis Evaluation Documents</h1>
              </div>
             
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {documentRows.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="text-left px-6 py-4 font-semibold text-gray-800 border-r border-gray-300">
                      Particulars
                    </th>
                    <th className="text-center px-6 py-4 font-semibold text-gray-800">
                      Download
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documentRows.map((row, index) => (
                    <tr 
                      key={index}
                      className="border-b border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-gray-700 border-r border-gray-300">
                        {row.label}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDownload(row.filePath, row.fileName)}
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          <Download size={18} />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Available</h3>
                <p className="text-gray-500">
                  No thesis evaluation documents have been uploaded yet.
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
        </div>
      </div>
    </div>
  );
};

export default ThesisSummary;