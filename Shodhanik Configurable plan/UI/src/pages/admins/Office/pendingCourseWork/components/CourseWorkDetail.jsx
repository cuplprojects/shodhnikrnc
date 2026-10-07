import { useState, useEffect } from 'react'
import { Spin, Button, Modal, Select, DatePicker, Checkbox } from 'antd'
import { EyeOutlined, ExportOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PrintHeader from '@/components/cms/PrintHeader'
import API from '@/services/API'
import { scholarService } from '@/services/scholarService'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import notification from '@/services/NotificationService'
import { confirm } from '@/services/ConfirmationService'
import { hasPermission } from '@/services/hasPermissionService';


const CourseWorkDetail = ({ selectedRecord, onBack }) => {
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [courseWorkData, setCourseWorkData] = useState(null)
  const [previewModal, setPreviewModal] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [courseWorkResult, setCourseWorkResult] = useState(null)
  const [lastDate, setLastDate] = useState(null)
  const [remark, setRemark] = useState('')
  const [isDeclarationChecked, setIsDeclarationChecked] = useState(false)
  const baseFileURL = getBaseFileURL()
  const canread = hasPermission('pending_course_work.read')
  const canapprove = hasPermission('pending_course_work.approve')
  const canreject = hasPermission('pending_course_work.reject')
  const canrevision = hasPermission('pending_course_work.revision')
  const isApprove = courseWorkResult === '1';
  const isReject = courseWorkResult === '2';
  const isRevision = courseWorkResult === '3';
  const Permission = (isApprove && canapprove || (isReject && canreject) || isRevision && canrevision);


  useEffect(() => {
    fetchAllData()
  }, [selectedRecord])

  const fetchAllData = async () => {
    setDataLoading(true)
    try {
      const profileRes = await scholarService.getProfile(selectedRecord.sid)
      setProfileData(profileRes)

      const courseWorkRes = await API.get(
        `/CourseWork/BySid/${selectedRecord.sid}`
      )
      if (courseWorkRes.data?.courseWork) {
        setCourseWorkData(courseWorkRes.data.courseWork)
        if (courseWorkRes.data.courseWork.courseWorkResult) {
          setCourseWorkResult(String(courseWorkRes.data.courseWork.courseWorkResult))
        }
        if (courseWorkRes.data.courseWork.courseWorkRemark) {
          setRemark(courseWorkRes.data.courseWork.courseWorkRemark)
        }
        if (courseWorkRes.data.courseWork.approvedAt) {
          setIsDeclarationChecked(true)
          setLastDate(dayjs(courseWorkRes.data.courseWork.approvedAt))
        }
      }
    } catch (error) {
      // notification().error('Failed to load details')
      console.error(error)
    } finally {
      setDataLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSubmit = async () => {
    if (!courseWorkResult) {
      notification().error('Course Work Result is required')
      return
    }

    if (isApprove && !lastDate) {
      notification().error('Last Date of Synopsis Submission is required for approval')
      return
    }

    // Make remark required for reject and send back for revision
    if ((isReject || isRevision) && !remark.trim()) {
      notification().error('Remark is required when rejecting or sending back for revision')
      return
    }

    if (!isDeclarationChecked) {
      notification().error('Please check the declaration checkbox')
      return
    }

    const confirmed = await confirm({
      title: 'Submit Course Work Verification',
      message: `Are you sure you want to ${isApprove ? 'approve' :
          isReject ? 'reject' :
            isRevision ? 'send back for revision' :
              'submit'
        } the course work for ${selectedRecord.name}?`,
    })

    if (!confirmed) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('CourseWorkResult', parseInt(courseWorkResult))
      if (remark) {
        formData.append('CourseWorkRemark', remark)
      }
      formData.append('CourseWorkStatus', parseInt(courseWorkResult))
      if (isApprove && lastDate) {
        formData.append('ApprovedAt', lastDate.format('YYYY-MM-DD'))
      }

      await API.patch(`/CourseWork/${courseWorkData.cwid}`, formData)

      if (isApprove && lastDate) {
        try {
          // First check if SynopsisRDC already exists
          let synopsisExists = false;
          try {
            await API.get(`/SynopsisRDC/${selectedRecord.sid}`);
            synopsisExists = true;
          } catch (checkError) {
            // If 404, it doesn't exist, which is fine
            if (checkError.response?.status !== 404) {
              console.warn('Error checking SynopsisRDC existence:', checkError);
            }
          }

          const synopsisFormData = new FormData()
          synopsisFormData.append('Synopsis1LastDate', lastDate.toISOString())

          if (synopsisExists) {
            // Update existing SynopsisRDC
            await API.patch(`/SynopsisRDC/${selectedRecord.sid}`, synopsisFormData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            })
          } else {
            // Create new SynopsisRDC
            synopsisFormData.append('SID', selectedRecord.sid)
            await API.post('/SynopsisRDC', synopsisFormData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            })
          }
        } catch (synopsisError) {
          console.warn('Failed to handle SynopsisRDC, but course work was approved successfully:', synopsisError)
          // Don't throw the error, just log it since the main approval was successful
        }
      }

      // Show specific success message based on action
      let successMessage = '';
      switch (courseWorkResult) {
        case '1':
          successMessage = 'Course work approved successfully!';
          break;
        case '2':
          successMessage = 'Course work rejected successfully!';
          break;
        case '3':
          successMessage = 'Course work sent back for revision successfully!';
          break;
        default:
          successMessage = 'Course work verification submitted successfully';
      }

      notification().success(successMessage)
      onBack?.()
    } catch (error) {
      // Show specific error message based on action
      let errorMessage = '';
      switch (courseWorkResult) {
        case '1':
          errorMessage = 'Failed to approve course work';
          break;
        case '2':
          errorMessage = 'Failed to reject course work';
          break;
        case '3':
          errorMessage = 'Failed to send back course work for revision';
          break;
        default:
          errorMessage = 'Failed to submit course work verification';
      }

      notification().error(
        error.response?.data?.message || errorMessage
      )
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (!selectedRecord) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600">Select a record from the table to view details</p>
      </div>
    )
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

  const handleBackClick = () => {
    setPreviewModal(false)
    setPreviewFile(null)
  }



  return (
    <Spin spinning={dataLoading || loading}>
      <div className="p-6 bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex justify-center flex-1">
            <PrintHeader />
          </div>
          <Button onClick={onBack} type="default">
            Back to List
          </Button>
        </div>

        {/* Profile Content */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm mt-6">
          {/* Basic Details Header */}
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800 flex items-center">
              <div className="w-2 h-2 bg-slate-500 rounded-full mr-2"></div>
              Basic Details
            </h3>
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
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/3 text-slate-700">
                        Shodhanik ID :
                      </td>
                      <td className="p-2 text-slate-800">
                        {profileData?.shodhanikID || 'N/A'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                        Department/Subject :
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="3">
                        {profileData?.subject || 'N/A'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                        Scholar Name :
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="3">
                        {profileData?.scholarName || 'N/A'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                        Mobile No. :
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="3">
                        {profileData?.mobileNo || 'N/A'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">
                        Email ID :
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-800" colSpan="3">
                        {profileData?.emailID || 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="block lg:hidden p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">
                      Admission Session
                    </div>
                    <div className="text-slate-800">{profileData?.admissionYear || 'N/A'}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Shodhanik ID</div>
                    <div className="text-slate-800">{profileData?.shodhanikID || 'N/A'}</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-slate-700 mb-1">
                    Department/Subject
                  </div>
                  <div className="text-slate-800">{profileData?.subject || 'N/A'}</div>
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
              </div>
            </div>
          </div>
        </div>

        {/* Course Work Details Section */}
        {courseWorkData && (
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm mt-6">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center">
                <div className="w-2 h-2 bg-slate-500 rounded-full mr-2"></div>
                Pre Ph.D. Course Work Marksheet / Certificate Uploaded for Verification
              </h3>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Marksheet / Certificate */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">
                    Marksheet / Certificate
                  </label>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    {courseWorkData.courseWorkFilePath && canread ? (
                      <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => handlePreviewFile(courseWorkData.courseWorkFilePath)}
                        className="p-0"
                      >
                        View Marksheet
                      </Button>
                    ) : (
                      <span className="text-slate-500 text-sm">No document uploaded</span>
                    )}
                  </div>
                </div>

                {/* Upload Date */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-1">
                    Upload Date
                  </label>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-800 text-sm">
                    {formatDate(courseWorkData.uploadDate)}
                  </div>
                </div>
              </div>

              {/* Course Work Verification Form */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                {/* Result and Last Date */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Course Work Result
                    </label>
                    <Select
                      className='w-50'
                      value={courseWorkResult}
                      onChange={(value) => {
                        setCourseWorkResult(value)
                        if (value !== '1') {
                          setLastDate(null)
                        }
                      }}
                      placeholder="--Select--"
                      size="small"
                      options={[
                        { label: 'Approve', value: '1' },
                        { label: 'Reject', value: '2' },
                        { label: 'Send Back for Revision', value: '3' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Last Date of Synopsis Submission
                    </label>
                    <DatePicker
                      value={lastDate}
                      onChange={setLastDate}
                      format="YYYY-MM-DD"
                      placeholder="Select date"
                      size="small"
                      disabled={courseWorkResult !== '1'}
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                    />
                  </div>
                </div>

                {/* Remark */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Any Remark {(courseWorkResult === '2' || courseWorkResult === '3') && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder={
                      courseWorkResult === '2'
                        ? "Please provide reason for rejection..."
                        : courseWorkResult === '3'
                          ? "Please specify what needs to be revised..."
                          : "Enter remarks..."
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors text-sm"
                    rows="3"
                    required={courseWorkResult === '2' || courseWorkResult === '3'}
                  />
                </div>

                {/* Declaration Checkbox */}
                <div className="flex items-start gap-2 pt-2">
                  <Checkbox
                    checked={isDeclarationChecked}
                    onChange={(e) => setIsDeclarationChecked(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700 pt-0.5">
                    I hereby declare that we have verified the attached marksheet
                  </span>
                </div>

                {/* Submit Button */}
                <div className="flex gap-2 pt-4">
                  {Permission && (
                     <Button
                    type="primary"
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' :
                      isApprove ? 'Approve Course Work' :
                        isReject ? 'Reject Course Work' :
                          isRevision ? 'Send Back for Revision' :
                            'Submit'
                    }
                  </Button>
                  )}
                 
                  <Button onClick={onBack}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        <Modal
          title={
            <div className="flex justify-between items-center">
              <span>View Document</span>
              <Button
                type="link"
                icon={<ExportOutlined />}
                onClick={handleOpenInNewTab}
                className="text-blue-600 hover:text-blue-800"
              >
                Open in New Tab
              </Button>
            </div>
          }
          open={previewModal}
          onCancel={handleBackClick}
          footer={null}
          width={900}
          style={{ top: 20 }}
        >
          {previewFile && (
            <div className="mt-4">
              <iframe
                src={`${baseFileURL}/${previewFile}`}
                width="100%"
                height="600px"
                style={{ border: '1px solid #d9d9d9', borderRadius: '6px' }}
                title="Document Preview"
              >
                <p>
                  Your browser does not support iframes. Please{' '}
                  <a
                    href={`${baseFileURL}/${previewFile}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    click here to view the document
                  </a>
                  .
                </p>
              </iframe>
            </div>
          )}
        </Modal>
      </div>
    </Spin>
  )
}

export default CourseWorkDetail
