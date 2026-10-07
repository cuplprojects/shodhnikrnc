import { useState, useEffect } from 'react'
import { Spin, Modal, Select } from 'antd'
import PrintHeader from '@/components/cms/PrintHeader'
import API from '@/services/API'
import { scholarService } from '@/services/scholarService'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import notification from '@/services/NotificationService'
import { confirm } from '@/services/ConfirmationService'
import {hasPermission} from '@/services/hasPermissionService';
import { formatDateTime } from '@/utils/dateUtils';


const { Option } = Select;

const SupConsentAction = ({ selectedRecord, onBack }) => {
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [supervisor1Data, setSupervisor1Data] = useState(null)
  const [coSupervisorData, setCoSupervisorData] = useState(null)
  const [consentData, setConsentData] = useState(null)
  const [approverInfo, setApproverInfo] = useState(null)
  const [previewModal, setPreviewModal] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [availableSupervisors, setAvailableSupervisors] = useState([])
  const [selectedNewSupervisor, setSelectedNewSupervisor] = useState(null)
  const [supervisorLoading, setSupervisorLoading] = useState(false)
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false)
  const baseFileURL = getBaseFileURL()

  const canread = hasPermission('supervisor_consent.read')
  const canapprove = hasPermission('supervisor_consent.approve')
  const canupdate= hasPermission('supervisor_consent.update')
  console.log("permission check - ",canupdate,canread,canapprove)

  useEffect(() => {
    fetchAllData()
  }, [selectedRecord])

  const fetchAllData = async () => {
    setDataLoading(true)
    try {
      // Fetch scholar profile data using scholarService
      const profileRes = await scholarService.getProfile(selectedRecord.sid)
      setProfileData(profileRes)

      // Fetch supervisor 1 data
      if (selectedRecord.supervisor1Id) {
        const sup1Res = await API.get(`SupervisorRegistration/${selectedRecord.supervisor1Id}`)
        setSupervisor1Data(sup1Res.data)
      }

      // Fetch co-supervisor data
      if (selectedRecord.coSupervisorId) {
        const coSupRes = await API.get(`SupervisorRegistration/${selectedRecord.coSupervisorId}`)
        setCoSupervisorData(coSupRes.data)
      }

      // Fetch consent files data
      const consentRes = await API.get(`ScholarSupervisor/BySid/${selectedRecord.sid}`)
      const cData = consentRes.data
      setConsentData(cData)

      // If approvedBy exists but role is not returned directly, fetch admin details as fallback
      if (cData?.approvedBy && !cData?.approvedByRole) {
        try {
          const userRes = await API.get(`admin/users/${cData.approvedBy}`)
          if (userRes.data) {
            setApproverInfo({
              name: userRes.data.name,
              roleName: userRes.data.roleName,
            })
          }
        } catch (uErr) {
          console.error('Error fetching approver details:', uErr)
        }
      }
    } catch (error) {
      // notification().error('Failed to load details')
      console.error(error)
    } finally {
      setDataLoading(false)
    }
  }

  const getApproverDisplay = () => {
    const roleName = consentData?.approvedByRole || approverInfo?.roleName
    const adminName = consentData?.approvedByName || approverInfo?.name

    if (roleName && adminName) {
      return (
        <span>
          <span className="font-semibold text-slate-800">{roleName}</span>
          <span className="text-slate-500 text-xs ml-1.5">({adminName})</span>
        </span>
      )
    }
    if (roleName) return <span className="font-semibold text-slate-800">{roleName}</span>
    if (adminName) return adminName
    return consentData?.approvedBy || '-'
  }

  if (!selectedRecord) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600">Select a record from the table to view details</p>
      </div>
    )
  }

  const handleApprove = async () => {
    const confirmed = await confirm({
      title: 'Approve Consent',
      message: `Are you sure you want to approve the consent request for ${selectedRecord.scholarName}?`,
    })

    if (!confirmed) return

    setLoading(true)
    try {
      const formData = new FormData()
      
      if (consentData?.secondRequestAt && !consentData?.secondApprovedAt) {
        // Second request approval
        formData.append('decision2', 1)
        formData.append('decisionRemark', remarks || '')
        formData.append('secondApprovedAt', new Date().toISOString())
      } else if (!consentData?.approvedAt) {
        // First request approval
        formData.append('decision1', 1)
        formData.append('decisionRemark', remarks || '')
        formData.append('approvedAt', new Date().toISOString())
      }

      await API.patch(`ScholarSupervisor/UpdateScholarSupervisor/${selectedRecord.scsuid}`, formData)
      notification().success('Consent approved successfully')
      onBack?.()
    } catch (error) {
      notification().error(error.response?.data?.message || 'Failed to approve consent')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableSupervisors = async () => {
    try {
      console.log('fetchAvailableSupervisors called for sid:', selectedRecord.sid)
      setSupervisorLoading(true)
      const response = await API.get(`/ScholarSupervisor/SupervisorforScholarSelect/${selectedRecord.sid}/internal`)
      console.log('Supervisors response:', response.data)
      setAvailableSupervisors(response.data || [])
    } catch (error) {
      console.error('Error fetching supervisors:', error)
      notification().error('Failed to load available supervisors')
    } finally {
      setSupervisorLoading(false)
    }
  }

  const handleChangeSupervisor = async () => {
    if (!showSupervisorDropdown) {
      // First click - show dropdown and fetch supervisors
      try {
        console.log('Fetching available supervisors...')
        await fetchAvailableSupervisors()
        setShowSupervisorDropdown(true)
      } catch (error) {
        console.error('Error fetching supervisors:', error)
        notification().error('Failed to load available supervisors')
      }
    } else {
      // Second click - process the change
      if (!remarks.trim()) {
        notification().warning('Remarks are required for supervisor change')
        return
      }

      if (!selectedNewSupervisor) {
        notification().warning('Please select a new supervisor')
        return
      }

      const confirmed = await confirm({
        title: 'Change Supervisor',
        message: `Are you sure you want to approve the consent request with a new supervisor for ${selectedRecord.scholarName}? This action cannot be undone.`,
      })

      if (!confirmed) return

      setLoading(true)
      try {
        const formData = new FormData()
        
        if (consentData?.secondRequestAt && !consentData?.secondApprovedAt) {
          // Second request approval with supervisor change
          formData.append('decision2', 1) // 1 for approved
          formData.append('decisionRemark', remarks)
          formData.append('secondApprovedAt', new Date().toISOString())
        } else if (!consentData?.approvedAt) {
          // First request approval with supervisor change
          formData.append('decision1', 1) // 1 for approved
          formData.append('decisionRemark', remarks)
          formData.append('approvedAt', new Date().toISOString())
        }
        
        formData.append('SUPID1', selectedNewSupervisor) // Send new supervisor ID

        await API.patch(`ScholarSupervisor/UpdateScholarSupervisor/${selectedRecord.scsuid}`, formData)
        notification().success('Supervisor changed successfully')
        onBack?.()
      } catch (error) {
        notification().error(error.response?.data?.message || 'Failed to change supervisor')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handlePreviewFile = (filePath) => {
    setPreviewFile(filePath)
    setPreviewModal(true)
  }

  const handleOpenInNewTab = () => {
    if (previewFile) {
      window.open(`${baseFileURL}/${previewFile}`, '_blank')
    }
  }

  return (
    <Spin spinning={dataLoading || loading}>
      <div className="p-6 bg-white">
        <div className="flex justify-center">
        <PrintHeader />
        </div>

        {/* Profile Content - Same as ScholarDashboard */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm mt-6 ">
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
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'block'
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
            <div className="hidden lg:flex w-32 border-l border-slate-200 flex-col items-center p-2 bg-slate-50/30">
              <div className="mb-2 rounded-2xl">
                <div className="p-2 bg-slate-100 font-semibold w-full text-slate-700 rounded-lg">
                  Shodhanik ID : <span className="text-slate-800 font-normal">{profileData?.shodhanikID || 'N/A'}</span>
                </div>
              </div>
              <div className="w-24 h-32 border border-slate-300 mb-2 flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                {profileData?.profilePicture ? (
                  <img
                    src={`${baseFileURL}/${profileData.profilePicture}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'block'
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
              <div>
                {/* Signature Section */}
                {profileData?.signature && (
                  <div className="mt-6 flex justify-end">
                    <div className="text-center bg-slate-50 p-0 rounded-lg">
                      <img
                        src={`${baseFileURL}/${profileData.signature}`}
                        alt="Signature"
                        className="max-w-24 max-h-16 mb-2 rounded shadow-sm bg-white"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                      <div className="text-xs text-slate-600 font-medium">Digital Signature</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Requested Research Supervisor Section - First Request */}
        <div className="mt-6 mb-6">
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border border-slate-300">
            <h3 className="font-bold text-slate-800 text-sm">Research Supervisor Request</h3>
          </div>
          <table className="w-full border border-slate-300 border-t-0">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300 w-1/4">Supervisor</td>
                <td className="px-4 py-2 text-sm border-r border-slate-300 w-1/4">
                  {supervisor1Data ? `${supervisor1Data.title} ${supervisor1Data.fullName}` : '-'}
                </td>
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300 w-1/4">Consent Letter</td>
                <td className="px-4 py-2 text-sm">
                  {consentData?.suP1ConsentFilePath ? (
                    <button
                      onClick={() => handlePreviewFile(consentData.suP1ConsentFilePath)}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      View Letter
                    </button>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Co-Supervisor</td>
                <td className="px-4 py-2 text-sm border-r border-slate-300">
                  {coSupervisorData ? `${coSupervisorData.title} ${coSupervisorData.fullName}` : 'Not Applicable'}
                </td>
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Consent Letter</td>
                <td className="px-4 py-2 text-sm">
                  {consentData?.cosupConsentFilePath && canread? (
                    <button
                      onClick={() => handlePreviewFile(consentData.cosupConsentFilePath)}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      View Letter
                    </button>
                  ) : (
                    'Not Applicable'
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Requested at</td>
                <td className="px-4 py-2 text-sm border-r border-slate-300">{formatDateTime(consentData?.requestedAt || selectedRecord?.requestedAt)}</td>
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Status</td>
                <td className="px-4 py-2 text-sm">
                  <span className={`font-medium ${consentData?.decision1 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {consentData?.decision1 ? 'Approved' : 'Pending'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Approved at</td>
                <td className="px-4 py-2 text-sm border-r border-slate-300">{formatDateTime(consentData?.approvedAt)}</td>
                <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Approved by</td>
                <td className="px-4 py-2 text-sm">{getApproverDisplay()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action Buttons - Only show for first request if not yet approved */}
        {!consentData?.secondRequestAt && !consentData?.approvedAt && (
          <div className="mt-6 mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Enter Remarks <span className="text-red-600 text-xs">(Required for Supervisor Change)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={loading}
              rows="5"
              placeholder="Enter remarks here..."
              className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            
            {/* Supervisor Selection Dropdown */}
            {showSupervisorDropdown && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select New Supervisor <span className="text-red-500">*</span>
                </label>
                <Select
                  placeholder="Choose a supervisor from the list"
                  value={selectedNewSupervisor}
                  onChange={setSelectedNewSupervisor}
                  style={{ width: '100%' }}
                  loading={supervisorLoading}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {availableSupervisors
                    .filter((supervisor) => {
                      // Exclude supervisors already in the profile
                      const currentSupervisorIds = [
                        selectedRecord.supervisor1Id,
                        selectedRecord.coSupervisorId
                      ].filter(Boolean);
                      return !currentSupervisorIds.includes(supervisor.supId);
                    })
                    .map((supervisor) => (
                    <Option key={supervisor.supId} value={supervisor.supId}>
                      {supervisor.title} {supervisor.fullName} - {supervisor.designation}
                      {supervisor.department && ` (${supervisor.department})`}
                    </Option>
                  ))}
                </Select>
                
                {availableSupervisors.length === 0 && !supervisorLoading && (
                  <p className="text-sm text-gray-500 mt-2">No supervisors available for selection</p>
                )}
              </div>
            )}
            
            <div className="flex gap-3 mt-4">
              {canapprove && (
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Approve
                </button>
              )}
              
              {canupdate && (
                <button
                  onClick={handleChangeSupervisor}
                  disabled={loading}
                  className={`px-6 py-2 text-white text-sm font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    showSupervisorDropdown 
                      ? 'bg-blue-500 hover:bg-blue-600' 
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {showSupervisorDropdown ? 'Confirm Change' : 'Change Supervisor'}
                </button>
              )}
              
              <button
                onClick={onBack}
                disabled={loading}
                className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Research Supervisor Change Request Section */}
        {consentData?.secondRequestAt && (
          <div className="mt-6 mb-6">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border border-slate-300">
              <h3 className="font-bold text-slate-800 text-sm">Research Supervisor Change Request</h3>
            </div>
            <table className="w-full border border-slate-300 border-t-0">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300 w-1/4">Supervisor</td>
                  <td className="px-4 py-2 text-sm border-r border-slate-300 w-1/4">
                    {supervisor1Data ? `${supervisor1Data.title} ${supervisor1Data.fullName}` : '-'}
                  </td>
                  <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300 w-1/4">Consent Letter</td>
                  <td className="px-4 py-2 text-sm">
                    {consentData?.suP2ConsentFilePath && canread? (
                      <button
                        onClick={() => handlePreviewFile(consentData.suP2ConsentFilePath)}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        View Letter
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">NOC</td>
                  <td className="px-4 py-2 text-sm border-r border-slate-300">
                    {consentData?.nocFilePath && canread ? (
                      <button
                        onClick={() => handlePreviewFile(consentData.nocFilePath)}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        View NOC of Old Supervisor
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td colSpan="2"></td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Requested at</td>
                  <td className="px-4 py-2 text-sm border-r border-slate-300">{formatDateTime(consentData?.secondRequestAt)}</td>
                  <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Status</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`font-medium ${consentData?.secondApprovedAt ? 'text-green-600' : 'text-yellow-600'}`}>
                      {consentData?.secondApprovedAt ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                </tr>
                {consentData?.secondApprovedAt && (
                  <tr className="border-t border-slate-300">
                    <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Approved at</td>
                    <td className="px-4 py-2 text-sm border-r border-slate-300">{formatDateTime(consentData.secondApprovedAt)}</td>
                    <td className="px-4 py-2 font-bold text-sm bg-slate-100 border-r border-slate-300">Approved by</td>
                    <td className="px-4 py-2 text-sm">{getApproverDisplay()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons - Only show for second request if not yet approved */}
        {consentData?.secondRequestAt && !consentData?.secondApprovedAt && (
          <div className="mt-6 mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Enter Remarks <span className="text-red-600 text-xs">(Required for Supervisor Change)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={loading}
              rows="5"
              placeholder="Enter remarks here..."
              className="w-full px-3 py-2 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            
            {/* Supervisor Selection Dropdown */}
            {showSupervisorDropdown && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select New Supervisor <span className="text-red-500">*</span>
                </label>
                <Select
                  placeholder="Choose a supervisor from the list"
                  value={selectedNewSupervisor}
                  onChange={setSelectedNewSupervisor}
                  style={{ width: '100%' }}
                  loading={supervisorLoading}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {availableSupervisors
                    .filter((supervisor) => {
                      // Exclude supervisors already in the profile
                      const currentSupervisorIds = [
                        selectedRecord.supervisor1Id,
                        selectedRecord.coSupervisorId
                      ].filter(Boolean);
                      return !currentSupervisorIds.includes(supervisor.supId);
                    })
                    .map((supervisor) => (
                    <Option key={supervisor.supId} value={supervisor.supId}>
                      {supervisor.title} {supervisor.fullName} - {supervisor.designation}
                      {supervisor.department && ` (${supervisor.department})`}
                    </Option>
                  ))}
                </Select>
                
                {availableSupervisors.length === 0 && !supervisorLoading && (
                  <p className="text-sm text-gray-500 mt-2">No supervisors available for selection</p>
                )}
              </div>
            )}
            
            <div className="flex gap-3 mt-4">
              {canapprove && (
                <button
                onClick={handleApprove}
                disabled={loading}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve
              </button>
              )}
              
              {canupdate && (
                <button
                onClick={handleChangeSupervisor}
                disabled={loading}
                className={`px-6 py-2 text-white text-sm font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  showSupervisorDropdown 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {showSupervisorDropdown ? 'Confirm Change' : 'Change Supervisor'}
              </button>
              )}
              
              <button
                onClick={onBack}
                disabled={loading}
                className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        <Modal
          title="Consent Letter Preview"
          open={previewModal}
          onCancel={() => setPreviewModal(false)}
          width="90%"
          style={{ maxWidth: '1000px' }}
          footer={[
            <button
              key="close"
              onClick={() => setPreviewModal(false)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold rounded transition"
            >
              Close
            </button>,
            <button
              key="open"
              onClick={handleOpenInNewTab}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded transition ml-2"
            >
              Open in New Tab →
            </button>,
          ]}
        >
          <div className="w-full h-96 bg-gray-100 rounded">
            {previewFile && (
              <iframe
                src={`${baseFileURL}/${previewFile}`}
                className="w-full h-full rounded"
                title="Consent Letter Preview"
              />
            )}
          </div>
        </Modal>
      </div>
    </Spin>
  )
}

export default SupConsentAction
