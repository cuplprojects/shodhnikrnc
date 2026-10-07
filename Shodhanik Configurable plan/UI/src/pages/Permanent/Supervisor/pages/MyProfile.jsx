import { useState, useEffect } from 'react';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import PrintHeader from '@/components/cms/PrintHeader';

const MyProfile = () => {
  const { user, getSupId } = useSupervisorAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadedDocuments, setUploadedDocuments] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const baseFileURL = getBaseFileURL();
  const supId = getSupId();

  useEffect(() => {
    const fetchSupervisorData = async () => {
      try {
        setLoading(true);
        if (!supId) {
          setError('Supervisor ID not found');
          setLoading(false);
          return;
        }

        const profileResponse = await API.get(`SupervisorPersonals/AllDetail?id=${supId}`);
        const data = profileResponse.data;

        try {
          const documentsResponse = await API.get(`/SupervisorUploads/${supId}`);
          if (documentsResponse.data) {
            setUploadedDocuments(documentsResponse.data);
          }
        } catch (docError) {
          console.log('No documents found:', docError);
        }

        if (data) {
          setProfileData({
            registrationNo: data.registration.applicationNumber || 'N/A',
            name: `${data.registration?.title || ''} ${data.registration?.fullName || ''}`.trim() || 'N/A',
            fatherName: data.registration?.fatherName || 'N/A',
            email: data.registration?.email || 'N/A',
            phone: data.registration?.mobileNo || 'N/A',
            designation: data.designationName || 'N/A',
            department: data.subjectName || 'N/A',
            college: data.education?.[0]?.collegeName || 'N/A',
            dateOfBirth: data.dateOfBirth || 'N/A',
            gender: data.gender || 'N/A',
            nationality: data.nationality || 'N/A',
            qualification: data.education?.[0]?.subject || 'N/A',
            experience: data.education?.[0]?.researchExp || 'N/A',
            specialization: data.education?.[0]?.areaOfSpec || 'N/A',
            retirementDate: data.retirementDate || 'N/A',
            permanentAddress: data.peAddress || 'N/A',
            correspondenceAddress: data.coAddress || 'N/A',
            permanentState: data.peState || 'N/A',
            permanentDistrict: data.peDistrict || 'N/A',
            permanentPincode: data.pePinCode || 'N/A',
            correspondenceState: data.coState || 'N/A',
            correspondenceDistrict: data.coDistrict || 'N/A',
            correspondencePincode: data.coPinCode || 'N/A',
          });
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching supervisor data:', error);
        setError('Failed to load profile data');
        setLoading(false);
      }
    };

    fetchSupervisorData();
  }, [supId, user]);

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br p-2 from-gray-50 to-gray-100 rounded-2xl">
      {/* Profile Section Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-t-lg shadow-sm p-2">
        <h2 className="text-lg font-semibold flex items-center">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
          My Profile
        </h2>
      </div>

      <div className="bg-white rounded-b-lg shadow-sm p-6">
        {/* University Header */}
        <div className="flex justify-center mb-4">
          <PrintHeader />
        </div>

        {/* Profile Content */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {/* Basic Details Header */}
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800 flex items-center">
              <div className="w-2 h-2 bg-slate-500 rounded-full mr-2"></div>
              Supervisor Details
            </h3>
          </div>

          {/* Mobile Profile Picture */}
          <div className="block lg:hidden p-4 bg-slate-50/30 border-b border-slate-200">
            <div className="flex justify-center">
              <div className="flex flex-col items-center">
                <div className="w-[35mm] h-[45mm] border border-slate-300 mb-2 flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                  {uploadedDocuments?.photo ? (
                    <img
                      src={`${baseFileURL}/${uploadedDocuments.photo}`}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-xs text-slate-500 text-center p-2">NOT AVAILABLE</div>
                  )}
                </div>
                <div className="text-xs text-center text-slate-600 font-medium">Profile Picture</div>
              </div>
            </div>
          </div>

          <div className="flex">
            {/* Desktop Profile Picture - Left Side */}
            <div className="hidden lg:flex w-40 border-r border-slate-200 flex-col items-center p-4 bg-slate-50/30">
              <div className="mb-2 p-2 bg-slate-100 font-semibold w-full text-slate-700 rounded-lg text-center text-sm">
                Reg. No: <span className="text-slate-800 font-normal">{profileData?.registrationNo}</span>
              </div>
              <div className="w-[35mm] h-[45mm] border border-slate-300 mb-2 flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                {uploadedDocuments?.photo ? (
                  <img
                    src={`${baseFileURL}/${uploadedDocuments.photo}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-xs text-slate-500 text-center p-2">NOT AVAILABLE</div>
                )}
              </div>
              <div className="text-xs text-center text-slate-600 font-medium mb-4">Profile Picture</div>
              
              {/* Signature */}
              {uploadedDocuments?.sign && (
                <div className="mt-2 text-center">
                  <div className="w-24 h-12 border border-slate-300 mb-1 flex items-center justify-center bg-white rounded shadow-sm overflow-hidden">
                    <img
                      src={`${baseFileURL}/${uploadedDocuments.sign}`}
                      alt="Signature"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="text-xs text-slate-600 font-medium">Signature</div>
                </div>
              )}
            </div>

            {/* Profile Details - Right Side */}
            <div className="flex-1 overflow-x-auto">
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/4 text-slate-700">Name :</td>
                      <td className="p-2 border-r border-slate-200 text-slate-800">{profileData?.name}</td>
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/4 text-slate-700">Father's Name :</td>
                      <td className="p-2 text-slate-800">{profileData?.fatherName}</td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Designation :</td>
                      <td className="p-2 border-r border-slate-200 text-slate-800">{profileData?.designation}</td>
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Department :</td>
                      <td className="p-2 text-slate-800">{profileData?.department}</td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">College :</td>
                      <td className="p-2 text-slate-800" colSpan="3">{profileData?.college}</td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Date of Birth :</td>
                      <td className="p-2 border-r border-slate-200 text-slate-800">{formatDate(profileData?.dateOfBirth)}</td>
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Gender :</td>
                      <td className="p-2 text-slate-800">{profileData?.gender}</td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Nationality :</td>
                      <td className="p-2 border-r border-slate-200 text-slate-800">{profileData?.nationality}</td>
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Retirement Date :</td>
                      <td className="p-2 text-slate-800">{formatDate(profileData?.retirementDate)}</td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Mobile No. :</td>
                      <td className="p-2 border-r border-slate-200 text-slate-800">{profileData?.phone}</td>
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Email ID :</td>
                      <td className="p-2 text-slate-800">{profileData?.email}</td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Research Exp. :</td>
                      <td className="p-2 border-r border-slate-200 text-slate-800">{profileData?.experience} Year(s)</td>
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Specialization :</td>
                      <td className="p-2 text-slate-800">{profileData?.specialization}</td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Correspondence Address :</td>
                      <td className="p-2 text-slate-800" colSpan="3">
                        {profileData?.correspondenceAddress}, {profileData?.correspondenceDistrict}, {profileData?.correspondenceState} - {profileData?.correspondencePincode}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Permanent Address :</td>
                      <td className="p-2 text-slate-800" colSpan="3">
                        {profileData?.permanentAddress}, {profileData?.permanentDistrict}, {profileData?.permanentState} - {profileData?.permanentPincode}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="block lg:hidden p-4 space-y-3">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-slate-700 mb-1">Registration No.</div>
                  <div className="text-slate-800">{profileData?.registrationNo}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Name</div>
                    <div className="text-slate-800">{profileData?.name}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Father's Name</div>
                    <div className="text-slate-800">{profileData?.fatherName}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Designation</div>
                    <div className="text-slate-800">{profileData?.designation}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Department</div>
                    <div className="text-slate-800">{profileData?.department}</div>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-slate-700 mb-1">College</div>
                  <div className="text-slate-800">{profileData?.college}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Date of Birth</div>
                    <div className="text-slate-800">{formatDate(profileData?.dateOfBirth)}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Gender</div>
                    <div className="text-slate-800">{profileData?.gender}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Mobile No.</div>
                    <div className="text-slate-800">{profileData?.phone}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Email ID</div>
                    <div className="text-slate-800 break-all">{profileData?.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Research Exp.</div>
                    <div className="text-slate-800">{profileData?.experience} Year(s)</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Specialization</div>
                    <div className="text-slate-800">{profileData?.specialization}</div>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-slate-700 mb-1">Correspondence Address</div>
                  <div className="text-slate-800">{profileData?.correspondenceAddress}, {profileData?.correspondenceDistrict}, {profileData?.correspondenceState} - {profileData?.correspondencePincode}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-slate-700 mb-1">Permanent Address</div>
                  <div className="text-slate-800">{profileData?.permanentAddress}, {profileData?.permanentDistrict}, {profileData?.permanentState} - {profileData?.permanentPincode}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
