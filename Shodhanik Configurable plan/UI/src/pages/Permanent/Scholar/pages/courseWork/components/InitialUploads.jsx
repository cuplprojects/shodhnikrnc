import React, { useState } from 'react';

const InitialUploads = () => {
  const [admissionLetter, setAdmissionLetter] = useState(null);
  const [consentLetter, setConsentLetter] = useState(null);

  const handleFileUpload = (fileType, event) => {
    const file = event.target.files[0];
    if (file) {
      if (fileType === 'admission') {
        setAdmissionLetter(file);
      } else if (fileType === 'consent') {
        setConsentLetter(file);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Step 1: Initial Document Upload
        </h2>
        <p className="text-gray-600 mb-6">
          Upload your admission letter to proceed with the course work process.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Admission Letter Upload */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Admission Letter Upload</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <input
                type="file"
                id="admission-letter"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileUpload('admission', e)}
                className="hidden"
              />
              <label
                htmlFor="admission-letter"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
              >
                Choose File
              </label>
              <span className="text-sm text-gray-600">
                {admissionLetter ? admissionLetter.name : 'No file selected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Accepted formats: PDF, DOC, DOCX (Max size: 5MB)
            </p>
          </div>
        </div>

        {/* Supervisor Consent Letter Upload */}
        {/* <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Supervisor Consent Letter</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <input
                type="file"
                id="consent-letter"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileUpload('consent', e)}
                className="hidden"
              />
              <label
                htmlFor="consent-letter"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
              >
                Choose File
              </label>
              <span className="text-sm text-gray-600">
                {consentLetter ? consentLetter.name : 'No file selected'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Accepted formats: PDF, DOC, DOCX (Max size: 5MB)
            </p>
          </div>
        </div> */}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Instructions</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Ensure all documents are clear and legible</li>
            <li>• Upload documents in PDF format for best compatibility</li>
            <li>• Both documents are required to proceed to the next step</li>
            <li>• Contact your supervisor if you need help obtaining the consent letter</li>
          </ul>
        </div>
      </div>


      {/* Upload Status */}
      {/* <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-3">Upload Status</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${admissionLetter ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className={`text-sm ${admissionLetter ? 'text-green-700' : 'text-gray-500'}`}>
              Admission Letter {admissionLetter ? 'Uploaded' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${consentLetter ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className={`text-sm ${consentLetter ? 'text-green-700' : 'text-gray-500'}`}>
              Consent Letter {consentLetter ? 'Uploaded' : 'Pending'}
            </span>
          </div>
        </div>
      </div> */}


    </div>
  );
};

export default InitialUploads;