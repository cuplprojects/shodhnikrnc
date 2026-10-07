import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import PrintHeader from '@/components/cms/PrintHeader'

const AdmissionForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sid = location.state?.sid;
  const scholarData = location.state?.scholarData;
  const cardData = location.state?.cardData; // Get the original card data

  console.log('AdmissionForm loaded');
  console.log('Location state:', location.state);
  console.log('SID received:', sid);
  console.log('Scholar data received:', scholarData);
  console.log('Card data received:', cardData);

  const [previewData, setPreviewData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [regTypeName, setRegTypeName] = useState('');
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
        #final-print-area,
        #final-print-area * {
          visibility: visible;
        }
        #final-print-area {
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

  // Fetch all scholar data and payment info
  useEffect(() => {
    const fetchApplicationData = async () => {
      if (!sid) {
        setError('No scholar ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch all data using the same API as PrintFinalApplication but with sid from params
        const response = await API.get(`/Scholars/PreviewAllDetails/${sid}`);
        
        if (response.data) {
          setPreviewData(response.data);
          
          // Fetch registration type name if regType is available
          if (response.data.scholar?.regType) {
            try {
              const regTypeResponse = await API.get(`/RegTypes/${response.data.scholar.regType}`);
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

        // Fetch payment data separately (mock for now - replace with actual API)
        const mockPaymentData = {
          txnId: '2500105923033',
          amount: '1200.00',
          txnDate: '20/06/2025 11:13:00 PM'
        };
        setPaymentData(mockPaymentData);

      } catch (err) {
        console.error('Error fetching application data:', err);
        setError(err.message || 'Failed to fetch application data');
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationData();
  }, [sid]);

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

  // Helper function to get registration type text - now uses API data
  const getRegTypeText = () => {
    return regTypeName || 'Loading...';
  };

  const handleBackNavigation = () => {
    if (cardData) {
      // Navigate back to ItemDetails with the original card data
      navigate('/admission-cell-dashboard/details', {
        state: { cardData }
      });
    } else {
      // Fallback to dashboard if no card data
      navigate('/admission-cell-dashboard');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!sid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No scholar ID provided</p>
          <button
            onClick={handleBackNavigation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Details
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application data for SID: {sid}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-4">Error: {error}</div>
          <button
            onClick={handleBackNavigation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Details
          </button>
        </div>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-2">No application data found for SID: {sid}</div>
          <p className="text-sm text-gray-500 mb-4">Unable to load application data.</p>
          <button
            onClick={handleBackNavigation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Details
          </button>
        </div>
      </div>
    );
  }

  // Extract data from the API response (same as PrintFinalApplication)
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

  return (
    <div className="p-4 md:p-5">
      {/* Header with Back and Print Button */}
      <div className="flex items-center justify-between mb-4 print-hide">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackNavigation}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-[#1e40af]" />
          </button>
          <div className="flex items-center gap-2">
            <Printer size={24} className="text-[#1e40af]" />
            <h2 className="text-xl font-bold text-[#1e40af] font-inter">
              Application Form 
              {/* - SID: {sid} */}
            </h2>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#1e40af] text-white py-2 px-4 rounded-md font-medium font-inter text-sm transition-all duration-200 hover:bg-[#1e3a8a]"
        >
          <Printer size={16} />
          Print
        </button>
      </div>

      {/* Printable Application */}
      <div id="final-print-area" className="bg-white border border-[#e5e7eb] rounded-lg p-6 print:border-0 print:p-0">
        {/* Header */}
    
          <div className="flex justify-center text-center">
            <PrintHeader/>
          </div>
 

        {/* Registration Info with Photo */}
        <div className="grid grid-cols-[1fr_auto] gap-4 mb-6">
          <table className="w-full border border-black text-sm">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Registration No.</td>
                <td className="p-2" colSpan="3">{scholar.applicationNo || 'N/A'}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Reg. Type</td>
                <td className="p-2" colSpan="3">{getRegTypeText()}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Subject</td>
                <td className="p-2" colSpan="3">{subject || 'N/A'}</td>
              </tr>
              {paymentData && (
                <>
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100" rowSpan="3">Payment Details</td>
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Txn Id</td>
                    <td className="p-2" colSpan="2">{paymentData.txnId}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Amount (₹)</td>
                    <td className="p-2" colSpan="2">{paymentData.amount}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-2 font-semibold border-r border-black bg-gray-100">Txn Date</td>
                    <td className="p-2" colSpan="2">{paymentData.txnDate}</td>
                  </tr>
                </>
              )}
              <tr className="border-b border-black">
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Mobile No.</td>
                <td className="p-2" colSpan="3">{scholar.phoneNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold border-r border-black bg-gray-100">Email Id</td>
                <td className="p-2" colSpan="3">{scholar.email || 'N/A'}</td>
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

        {/* Academic Details - Only render if academic data is available */}
        {academicQualifications && academicQualifications.length > 0 && (
          <>
            <h3 className="text-base font-bold mb-2 bg-gray-100 p-2 border border-black">ACADEMIC DETAILS</h3>
            <table className="w-full border border-black text-sm mb-6">
              <thead>
                <tr className="bg-gray-100 border-b border-black">
                  <th className="p-2 border-r border-black text-left">Qualification<br/>Board/University</th>
                  <th className="p-2 border-r border-black text-left">Year</th>
                  <th className="p-2 border-r border-black text-left">Stream & Subject</th>
                  <th className="p-2 border-r border-black text-left">Marks<br/>Obtained</th>
                  <th className="p-2 border-r border-black text-left">CGPA<br/>Percentage</th>
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
                      {edu.percentageOrCGPA || 'N/A'}
                      {edu.percentageOrCGPA && (edu.markingRule === 'Percentage' ? '%' : ' CGPA')}
                    </td>
                    <td className="p-2">{edu.division}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Declaration */}
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
      </div>
    </div>
  );
};

export default AdmissionForm;