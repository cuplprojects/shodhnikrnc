import React, { useState, useEffect } from 'react';
import { scholarService } from '@/services/scholarService';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import getBaseFileURL from '@/utils/getBaseFileUrl';
import PrintHeader from '@/components/cms/PrintHeader';
import CourseWorkStatus from '@/components/CourseWorkStatus';

const ScholarDashboard = ({sid}) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { getSId } = useSelectedScholarAuthStore();
  const baseFileURL = getBaseFileURL();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const sId = getSId();

        if (!sId) {
          setError('Scholar ID not found');
          return;
        }

        const data = await scholarService.getProfile(sId);
        setProfileData(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [getSId]);

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
      {/* Breadcrumb */}
      {/* <div className="flex items-center gap-2 p-6 pb-2">
        <span className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer transition-colors">Home</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 text-sm font-semibold">Dashboard</span>
      </div> */}

      <div className="p- pt-">
        {/* Course Work Status Section - For Testing */}
        {/* <div className="mb-6">
          <CourseWorkStatus />
        </div> */}

        {/* Notice Board Section */}
        {/* <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-lg shadow-sm mb-6 p-2">
          <h2 className="text-lg font-semibold mb-3 flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Notice Board
          </h2>
          <div className="space-y-3 text-sm">
            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
              <span className="text-blue-200">• How to use Research Management System (Complete Instruction to the Scholars)</span>
            </div>
            <div className="bg-white text-slate-800 p-2 rounded-lg shadow-sm">
              All the Research Scholars are advised to Check the <span className="text-blue-600 underline font-medium">https://ccsuniversity.ac.in</span> regularly to know the update schedules of RUC.
            </div>
          </div>
        </div> */}

        {/* Profile Section Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-t-lg shadow-sm p-2">
          <h2 className="text-lg font-semibold flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            Profile
          </h2>
        </div>

        <div className="bg-white rounded-b-lg shadow-sm p-6">
          {/* University Header */}
          <div className="flex justify-center">
            <PrintHeader />
          </div>

          {/* Profile Content */}
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            {/* Basic Details Header */}
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <div className="w-2 h-2 bg-slate-500 rounded-full mr-2"></div>
                Basic Details
              </h3>
            </div>

            {/* Mobile Profile Picture - Show at top on small screens */}
            <div className="block lg:hidden p-4 bg-slate-50/30 border-b border-slate-200">
              <div className="flex justify-center">
                <div className="flex flex-col items-center">
                  <div className="w-24 h-32 border border-slate-300 mb-2 flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                    {profileData?.profilePicture ? (
                      <img
                        src={`${baseFileURL}/${profileData.profilePicture}`}
                        alt="Profile"
                        className="w-full h-full object-fitcover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <div
                      className="text-xs text-slate-500 text-center p-2"
                      style={{ display: profileData?.profilePicture ? 'none' : 'block' }}
                    >
                      NOT AVAILABLE
                    </div>
                  </div>
                  <div className="text-xs text-center text-slate-600 font-medium">
                    Profile Picture
                  </div>
                </div>
              </div>
            </div>

            <div className="flex">
              {/* Profile Details */}
              <div className="flex-1 overflow-x-auto">
                {/* Desktop Table */}
                <div className="hidden lg:block">
                  <table className="w-full">
                    <tbody>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/3 text-slate-700">
                          Admission Session :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800">
                          {profileData?.admissionYear || 'N/A'}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                          Department/Subject :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="2">
                          {profileData?.subject || 'N/A'}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                          Supervisor Name :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="2">
                          {profileData?.supervisor1Name || 'N/A'}
                          {profileData?.supervisor2Name && `, ${profileData.supervisor2Name}`}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                          Scholar Name :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="2">
                          {profileData?.scholarName || 'N/A'}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                          Mobile No. :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="2">
                          {profileData?.mobileNo || 'N/A'}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                          Email ID :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="2">
                          {profileData?.emailID || 'N/A'}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                          Correspondence Address :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="2">
                          {profileData?.correspondanceAddress || 'N/A'}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                          Permanent Address :
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="2">
                          {profileData?.permanentAddress || 'N/A'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="block lg:hidden p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <div className="text-sm font-semibold text-slate-700 mb-1">Admission Session</div>
                      <div className="text-slate-800">{profileData?.admissionYear || 'N/A'}</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <div className="text-sm font-semibold text-slate-700 mb-1">Shodhanik ID</div>
                      <div className="text-slate-800">{profileData?.shodhanikID || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Department/Subject</div>
                    <div className="text-slate-800">{profileData?.subject || 'N/A'}</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Supervisor Name</div>
                    <div className="text-slate-800">
                      {profileData?.supervisor1Name || 'N/A'}
                      {profileData?.supervisor2Name && `, ${profileData.supervisor2Name}`}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Scholar Name</div>
                    <div className="text-slate-800">{profileData?.scholarName || 'N/A'}</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Mobile No.</div>
                    <div className="text-slate-800">{profileData?.mobileNo || 'N/A'}</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Email ID</div>
                    <div className="text-slate-800 break-all">{profileData?.emailID || 'N/A'}</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Correspondence Address</div>
                    <div className="text-slate-800">{profileData?.correspondanceAddress || 'N/A'}</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Permanent Address</div>
                    <div className="text-slate-800">{profileData?.permanentAddress || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Desktop Profile Picture - Show on right side for large screens */}
              <div className="hidden lg:flex w-40 border-l border-slate-200 flex-col items-center p-3 bg-slate-50/30 gap-3">
                <div className='w-full'>
                  <div className="p-3 bg-slate-100 font-semibold text-slate-700 rounded-lg text-center">
                    <div className="text-xs text-slate-600 mb-1">Shodhanik ID</div>
                    <div className="text-sm text-slate-800 font-bold break-words">{profileData?.shodhanikID || 'N/A'}</div>
                  </div>
                </div>
                <div className="w-28 h-36 border border-slate-300 flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                  {profileData?.profilePicture ? (
                    <img
                      src={`${baseFileURL}/${profileData.profilePicture}`}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                  ) : null}
                  <div
                    className="text-xs text-slate-500 text-center p-2"
                    style={{ display: profileData?.profilePicture ? 'none' : 'block' }}
                  >
                    NOT AVAILABLE
                  </div>
                </div>
                <div className="text-xs text-center text-slate-600 font-medium">
                  Profile Picture
                </div>
                {/* Signature Section */}
                {profileData?.signature && (
                  <div className="w-full flex flex-col items-center mt-2">
                    <img
                      src={`${baseFileURL}/${profileData.signature}`}
                      alt="Signature"
                      className="max-w-24 max-h-16 mb-2 rounded shadow-sm bg-white"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="text-xs text-slate-600 font-medium">Digital Signature</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScholarDashboard;