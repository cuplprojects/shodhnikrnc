import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import useScholarRegAuthStore from '@/store/scholarRegAuthStore';
import useSteps from '@/hooks/useSteps';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import PrintHeader from '@/components/cms/PrintHeader';

const PreviewApplication = () => {

  const { getSId } = useScholarRegAuthStore();
  const { saveStep, isReadOnly } = useSteps();
  const navigate = useNavigate();
  const scholarId = getSId();

  const [acceptDeclaration, setAcceptDeclaration] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [regTypeName, setRegTypeName] = useState('N/A');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  // Add print styles when component mounts
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #printable-area,
        #printable-area * {
          visibility: visible;
        }
        #printable-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .print-hide {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fetch all scholar data using multiple API calls
  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        setLoading(true);

        // Fetch preview details (includes personal details, academic qualifications, uploads)
        const previewResponse = await API.get(`/Scholars/PreviewAllDetails/${scholarId}`);
        
        // Fetch scholar details (includes fName, phoneNumber, applicationNo, etc.)
        const scholarResponse = await API.get(`/Scholars/${scholarId}`);

        if (previewResponse.data && scholarResponse.data) {
          // Merge the data - scholar details override preview details
          const mergedData = {
            ...previewResponse.data,
            scholar: {
              ...previewResponse.data.scholar,
              ...scholarResponse.data // This will add fName, phoneNumber, applicationNo, etc.
            }
          };
          
          setPreviewData(mergedData);
          
          // Fetch registration type name if regType is available
          if (scholarResponse.data?.regType) {
            try {
              const regTypeResponse = await API.get(`/RegTypes/${scholarResponse.data.regType}`);
              if (regTypeResponse.data?.regTypeName) {
                setRegTypeName(regTypeResponse.data.regTypeName);
              }
            } catch (regTypeError) {
              console.error('Error fetching registration type:', regTypeError);
              setRegTypeName('Unknown');
            }
          }
        } else {
          throw new Error('No data received from API');
        }

      } catch (err) {
        console.error('Error fetching preview data:', err);
        setError(err.message || 'Failed to fetch application data');
      } finally {
        setLoading(false);
      }
    };

    if (scholarId) {
      fetchPreviewData();
    }
  }, [scholarId]);

  // Helper function to calculate age
  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    let years = age;
    let months = monthDiff;
    let days = dayDiff;

    if (dayDiff < 0) {
      months--;
      days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    return `${years} Years, ${months} Months and ${days} Days`;
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Helper function to get registration type text
  const getRegTypeText = () => {
    return regTypeName;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-5 flex justify-center items-center min-h-64">
        <div className="text-lg">Loading application data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-5 flex justify-center items-center min-h-64">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div className="p-4 md:p-5 flex justify-center items-center min-h-64">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-2">No application data found</div>
          <p className="text-sm text-gray-500">Unable to load application data.</p>
        </div>
      </div>
    );
  }

  // Extract data from the API response
  const { scholar, subject, personalDetails, academicQualifications, uploads } = previewData;

  // Get photo and signature URLs from uploads
  const getDocumentUrl = (documentMasterID) => {
    const upload = uploads?.find(upload => upload.documentMasterID === documentMasterID);
    if (upload) {
      const baseURL = getBaseFileURL();
      return `${baseURL}/${upload.path}`;
    }
    return null;
  };

  // Document Master IDs (based on common convention)
  const photoUrl = getDocumentUrl(1); // Photograph usually has ID 1
  const signatureUrl = getDocumentUrl(2); // Signature usually has ID 2

  // const handlePrint = () => {
  //   window.print();
  // };

  const handleProceedToPayment = async () => {
    if (!acceptDeclaration) {
      return;
    }

    try {
      // Save step 4 (Preview Application) and navigate to payment
      const stepSaved = await saveStep(4);
      if (stepSaved) {
        // Navigate to payment step using React Router
        navigate('/register-scholar/payment');
      }
    } catch (error) {
      console.error('Error saving step:', error);
      // You might want to show an error notification here
    }
  };

  return (
    <div className="p-4 md:p-5">
      {/* {isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Read-only:</strong> Step 4 completed. Application preview cannot be modified.
          </p>
        </div>
      )} */}
      {/* Print Button - Hidden in print */}
      {/* <div className="mb-4 flex justify-end print-hide">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#1e40af] text-white py-2 px-4 rounded-md font-medium font-inter text-sm transition-all duration-200 hover:bg-[#1e3a8a]"
        >
          <Printer size={16} />
          Print Application
        </button>
      </div> */}

      {/* Application Preview - Printable */}
      <div id="printable-area" className="bg-white border border-[#e5e7eb] rounded-lg p-6 print:border-0 print:p-0">
        {/* Header */}
        <div className="flex justify-center mb-2">
          <PrintHeader />
        </div>

        {/* Registration Info with Photo */}
        <div className="grid grid-cols-[1fr_auto] gap-4 mb-6">
          <table className="w-full border border-black text-sm">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Registration No.</td>
                <td className="p-2">{scholar.applicationNo || 'N/A'}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Reg. Type</td>
                <td className="p-2">{getRegTypeText()}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Subject</td>
                <td className="p-2">{scholar?.subjectName || 'N/A'}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Mobile No.</td>
                <td className="p-2">{scholar.phoneNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Email Id</td>
                <td className="p-2">{scholar.email || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-col gap-2">
            <div className="border border-black w-32 h-40 flex items-center justify-center bg-gray-50">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Photograph"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <span className={`text-xs text-gray-500 ${photoUrl ? 'hidden' : ''}`}>Photo</span>
            </div>
            <div className="border border-black w-32 h-16 flex items-center justify-center bg-gray-50">
              {signatureUrl ? (
                <img
                  src={signatureUrl}
                  alt="Signature"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <span className={`text-xs text-gray-500 ${signatureUrl ? 'hidden' : ''}`}>Signature</span>
            </div>
          </div>
        </div>

        {/* Personal Details - Only render if personal details are available */}
        {personalDetails && (
          <>
            <h3 className="text-base font-bold mb-2 bg-gray-100 p-2 border border-black">PERSONAL DETAILS</h3>
            <table className="w-full border border-black text-sm mb-6">
              <tbody>
                <tr className="border-b border-black">
                  <td className="p-2 font-semibold border-r border-black bg-gray-100 w-1/4">Name</td>
                  <td className="p-2 border-r border-black w-1/4">{scholar.name || 'N/A'}</td>
                  <td className="p-2 font-semibold border-r border-black bg-gray-100 w-1/4">Father's Name</td>
                  <td className="p-2 w-1/4">{scholar.fName || 'N/A'}</td>
                </tr>
                {personalDetails.mname && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Mother's Name</td>
                    <td className="p-2 border-r border-black">{personalDetails.mname}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Gender</td>
                    <td className="p-2">{personalDetails.gender}</td>
                  </tr>
                )}
                {personalDetails.dob && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Date of Birth</td>
                    <td className="p-2 border-r border-black">{formatDate(personalDetails.dob)}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Age</td>
                    <td className="p-2">{calculateAge(personalDetails.dob)}</td>
                  </tr>
                )}
                {personalDetails.maritalStatus && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Marital Status</td>
                    <td className="p-2 border-r border-black">{personalDetails.maritalStatus}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Category</td>
                    <td className="p-2">{personalDetails.category}</td>
                  </tr>
                )}
                {personalDetails.subCategory && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Sub Category</td>
                    <td className="p-2 border-r border-black">{personalDetails.subCategory}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Nationality</td>
                    <td className="p-2">{personalDetails.country}</td>
                  </tr>
                )}
                {personalDetails.domicile && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Domicile</td>
                    <td className="p-2 border-r border-black">{personalDetails.domicile}</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Identity Proof</td>
                    <td className="p-2">{personalDetails.identityProof}</td>
                  </tr>
                )}
                {personalDetails.identityProofNo && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Identity Proof No.</td>
                    <td className="p-2" colSpan="3">{personalDetails.identityProofNo}</td>
                  </tr>
                )}
                {personalDetails.passportNo && personalDetails.country === 'Other' && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Passport No.</td>
                    <td className="p-2" colSpan="3">{personalDetails.passportNo}</td>
                  </tr>
                )}
                {personalDetails.correspondenceAddress && (
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Correspondence Address</td>
                    <td className="p-2" colSpan="3">
                      {personalDetails.correspondenceAddress}
                      {personalDetails.cDistrict && `, ${personalDetails.cDistrict}`}
                      {personalDetails.cState && `, ${personalDetails.cState}`}
                      {personalDetails.cPincode && `, PIN-${personalDetails.cPincode}`}
                    </td>
                  </tr>
                )}
                {personalDetails.permanentAddress && (
                  <tr>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Permanent Address</td>
                    <td className="p-2" colSpan="3">
                      {personalDetails.permanentAddress}
                      {personalDetails.pDistrict && `, ${personalDetails.pDistrict}`}
                      {personalDetails.pState && `, ${personalDetails.pState}`}
                      {personalDetails.pPinCode && `, PIN-${personalDetails.pPinCode}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Examination City Preferences - Only render if preferences are available */}
        {personalDetails && (personalDetails.exPreference1 || personalDetails.exPreference2) && (
          <>
            <h3 className="text-base font-bold mb-2 bg-gray-100 p-2 border border-black">EXAMINATION CITY PREFERENCES</h3>
            <table className="w-full border border-black text-sm mb-6">
              <tbody>
                <tr>
                  <td className="p-2 font-semibold border-r border-black bg-gray-100 w-1/4">First Choice</td>
                  <td className="p-2 border-r border-black w-1/4">{personalDetails.exPreference1 || 'Not specified'}</td>
                  <td className="p-2 font-semibold border-r border-black bg-gray-100 w-1/4">Second Choice</td>
                  <td className="p-2 w-1/4">{personalDetails.exPreference2 || 'Not specified'}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Academic Details - Only render if academic data is available */}
        {academicQualifications && academicQualifications.length > 0 && (
          <>
            <h3 className="text-base font-bold mb-2 bg-gray-100 p-2 border border-black">ACADEMIC DETAILS</h3>
            <table className="w-full border border-black text-sm mb-6">
              <thead>
                <tr className="bg-gray-100 border-b border-black">
                  <th className="p-2 border-r border-black text-left">Qualification<br />Board/University</th>
                  <th className="p-2 border-r border-black text-left">Year</th>
                  <th className="p-2 border-r border-black text-left">Stream & Subject</th>
                  <th className="p-2 border-r border-black text-left">Marks<br />Obtained</th>
                  <th className="p-2 border-r border-black text-left">CGPA<br />Percentage</th>
                  <th className="p-2 text-left">Division</th>
                </tr>
              </thead>
              <tbody>
                {academicQualifications.map((edu, index) => (
                  <tr key={edu.aqid || index} className={index < academicQualifications.length - 1 ? 'border-b border-black' : ''}>
                    <td className="p-2 border-r border-black">
                      <div className="font-semibold">{edu.nameOfExamination}</div>
                      <div className="text-xs">{edu.boardUniversityName}</div>
                    </td>
                    <td className="p-2 border-r border-black">
                      {edu.isAppearing ? 'Appearing' : edu.passingYear}
                    </td>
                    <td className="p-2 border-r border-black">
                      <div>{edu.stream}</div>
                      <div className="text-xs">{edu.subject}</div>
                    </td>
                    <td className="p-2 border-r border-black">
                      {edu.marksObitained || 0}/{edu.maxMarks || 0}
                    </td>
                    <td className="p-2 border-r border-black">
                      {edu.percentageOrCGPA || ''}
                      {edu.percentageOrCGPA && (edu.markingRule === 'Percentage' ? '%' : 'CGPA')}
                    </td>
                    <td className="p-2">{edu.division}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Declaration Section - Hidden in print initially */}
        <div className="print-hide">
          <h3 className="text-xl font-bold text-center mb-4">DECLARATION BY APPLICANT</h3>
          <p className="text-sm mb-4 text-justify">
            I {scholar.name} hereby declare that the information furnished above is true to the best of my knowledge and belief. If at any time it is found that I have concealed any information or have given any incorrect data, my candidature may be cancelled/terminated, without any notice or compensation.
          </p>

          <div className="flex items-center justify-end mb-4">
            <div className="text-center">
              <div className="border border-black w-48 h-24 flex items-center justify-center bg-gray-50 mb-2">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Signature"
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <span className={`text-xs text-gray-500 ${signatureUrl ? 'hidden' : ''}`}>Signature</span>
              </div>
              <p className="text-sm font-semibold">(Signature of Applicant)</p>
            </div>
          </div>

          <div className="flex items-start gap-2 mb-4 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-md">
            <input
              type="checkbox"
              checked={acceptDeclaration || isReadOnly}
              onChange={(e) => setAcceptDeclaration(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-[#dc2626] border-[#d1d5db] rounded focus:ring-1 focus:ring-[#dc2626]"
              disabled={isReadOnly}
              required
            />
            <label className="text-sm text-[#dc2626] font-medium font-inter">
              I have read and accept above declaration. After payment you can not edit any details in your Application.
            </label>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleProceedToPayment}
              disabled={isReadOnly || !acceptDeclaration}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-8 rounded-lg font-semibold font-inter text-sm transition-all duration-200 hover:from-green-700 hover:to-green-600 active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReadOnly ? 'Read Only' : 'Proceed to Payment'}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewApplication;