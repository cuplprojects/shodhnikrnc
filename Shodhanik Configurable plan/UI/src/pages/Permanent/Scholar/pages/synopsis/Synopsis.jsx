import { useEffect, useState } from 'react'
import { Button, Space, Spin, Empty, Input, Upload, InputNumber, Modal } from 'antd'
import { EditOutlined, SaveOutlined, CloseOutlined, UploadOutlined, EyeOutlined } from '@ant-design/icons'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil } from '@/utils/dateUtils'

const Synopsis = () => {
  const [synopsisData, setSynopsisData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Separate editing states for both attempts
  const [isEditing1, setIsEditing1] = useState(false)
  const [isEditing2, setIsEditing2] = useState(false)
  const [editedData, setEditedData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [fileList1, setFileList1] = useState([])
  const [fileList2, setFileList2] = useState([])

  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewFileName, setPreviewFileName] = useState('')

  const { getSId } = useSelectedScholarAuthStore()
  const notify = notification()
  const baseFileURL = getBaseFileURL()

  const fetchSynopsisData = async () => {
    try {
      setLoading(true)
      const sId = getSId()

      if (!sId) {
        setError('Scholar ID not found')
        return
      }

      try {
        const response = await API.get(`/SynopsisRDC/${sId}`)
        let synData = response.data ? { ...response.data } : null

        if (synData && !synData.synopsis1LastDate) {
          try {
            const cwRes = await API.get(`/CourseWork/BySid/${sId}`)
            const cwApprovedAt = cwRes.data?.courseWork?.approvedAt || cwRes.data?.approvedAt
            if (cwApprovedAt) {
              synData.synopsis1LastDate = cwApprovedAt
            }
          } catch (cwErr) {
            console.warn('CourseWork fetch error:', cwErr)
          }
        }

        if (synData) {
          setSynopsisData(synData)
          setEditedData(synData)
        }
      } catch (err) {
        if (err.response?.status === 404) {
          let cwApprovedAt = null
          try {
            const cwRes = await API.get(`/CourseWork/BySid/${sId}`)
            cwApprovedAt = cwRes.data?.courseWork?.approvedAt || cwRes.data?.approvedAt
          } catch (cwErr) {
            console.warn('CourseWork fetch error:', cwErr)
          }

          const emptyData = {
            synid: null,
            synopsis1Title: '',
            synopsis1Receipt: '',
            synopsis1FeeAmt: '',
            synopsis1FilePath: null,
            synopsis1LastDate: cwApprovedAt,
            synopsis1Date: null,
            synopsis1Decision: null,
            synopsis1RDCRemark: null,
            synopsis1RDCDate: null,
            synopsis2Title: '',
            synopsis2Receipt: '',
            synopsis2FeeAmt: '',
            synopsis2FilePath: null,
            synopsis2LastDate: null,
            synopsis2Date: null,
            synopsis2Decision: null,
            synopsis2RDCRemark: null,
            synopsis2RDCDate: null,
          }
          setSynopsisData(emptyData)
          setEditedData(emptyData)
        } else {
          throw err
        }
      }
    } catch (err) {
      console.error('Error fetching synopsis data:', err)
      setError('Failed to load synopsis data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSynopsisData()
  }, [getSId])

  const handleEdit1 = () => {
    setIsEditing1(true)
    setEditedData({ ...synopsisData })
    setFileList1([])
  }

  const handleEdit2 = () => {
    setIsEditing2(true)
    setEditedData({ ...synopsisData })
    setFileList2([])
  }

  const handleCancel1 = () => {
    setIsEditing1(false)
    setEditedData(synopsisData)
    setFileList1([])
  }

  const handleCancel2 = () => {
    setIsEditing2(false)
    setEditedData(synopsisData)
    setFileList2([])
  }

  const handlePreviewFile = (filePath) => {
    if (filePath) {
      const fullUrl = `${baseFileURL}/${filePath}`
      setPreviewUrl(fullUrl)
      setPreviewFileName(filePath.split('/').pop())
      setPreviewModalVisible(true)
    }
  }

  const handleClosePreview = () => {
    setPreviewModalVisible(false)
    setPreviewUrl('')
    setPreviewFileName('')
  }

  const handleSave1 = async () => {
    if (!editedData?.synopsis1Title) {
      notify.error('Please enter the title of Synopsis.')
      return
    }
    if (fileList1.length === 0 && !synopsisData?.synopsis1FilePath) {
      notify.error('Please upload a synopsis file')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      const sId = getSId()
      const isNewRecord = !synopsisData?.synid

      if (isNewRecord) {
        formData.append('SID', sId)
        formData.append('Title', editedData.synopsis1Title)
        formData.append('ReceiptNumber', editedData.synopsis1Receipt || '')
        formData.append('FeeAmount', String(editedData.synopsis1FeeAmt || ''))
        if (fileList1.length > 0 && fileList1[0].originFileObj) {
          formData.append('File', fileList1[0].originFileObj)
        }
      } else {
        formData.append('Synopsis1Title', editedData.synopsis1Title)
        formData.append('Synopsis1Receipt', editedData.synopsis1Receipt || '')
        formData.append('Synopsis1FeeAmt', String(editedData.synopsis1FeeAmt || ''))
        if (fileList1.length > 0 && fileList1[0].originFileObj) {
          formData.append('Synopsis1File', fileList1[0].originFileObj)
        }
      }

      let response
      if (isNewRecord) {
        response = await API.post('/SynopsisRDC', formData)
      } else {
        response = await API.patch(`/SynopsisRDC/${synopsisData.sid}`, formData)
      }

      if (response.data) {
        notify.success('Synopsis submitted successfully')
        setIsEditing1(false)
        setFileList1([])
        fetchSynopsisData() // Refresh data
      }
    } catch (error) {
      notify.error('Failed to submit synopsis')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSave2 = async () => {
    if (!editedData?.synopsis2Title) {
      notify.error('Please enter the title of Synopsis.')
      return
    }
    if (fileList2.length === 0 && !synopsisData?.synopsis2FilePath) {
      notify.error('Please upload a synopsis file')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('Synopsis2Title', editedData.synopsis2Title)
      formData.append('Synopsis2Receipt', editedData.synopsis2Receipt || '')
      formData.append('Synopsis2FeeAmt', String(editedData.synopsis2FeeAmt || ''))

      if (fileList2.length > 0 && fileList2[0].originFileObj) {
        formData.append('Synopsis2File', fileList2[0].originFileObj)
      }

      const response = await API.patch(`/SynopsisRDC/${synopsisData.sid}`, formData)

      if (response.data) {
        notify.success('Synopsis (Second Attempt) submitted successfully')
        setIsEditing2(false)
        setFileList2([])
        fetchSynopsisData() // Refresh data
      }
    } catch (error) {
      notify.error('Failed to submit synopsis')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString) => {
    return formatDateUtil(dateString)
  }

  const getSynopsisDecisionDisplay = (decision) => {
    switch (decision) {
      case 0:
      case null:
      case undefined:
        return { text: 'Pending', className: 'bg-yellow-100 text-yellow-800' }
      case 1:
        return { text: 'Approved', className: 'bg-green-100 text-green-800' }
      case 2:
        return { text: 'Rejected', className: 'bg-red-100 text-red-800' }
      case 3:
        return { text: 'Revision Required', className: 'bg-orange-100 text-orange-800' }
      default:
        return { text: 'Pending', className: 'bg-yellow-100 text-yellow-800' }
    }
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not submitted'
    return formatDateTimeUtil(dateString)
  }

  // Check if both attempts are rejected
  const isBothRejected = synopsisData?.synopsis1Decision === 2 && synopsisData?.synopsis2Decision === 2

  // Check if first attempt is rejected (to show second attempt section)
  const isFirstRejected = synopsisData?.synopsis1Decision === 2

  // Can edit first attempt if: no decision yet OR revision is requested
  const canEdit1 = !synopsisData?.synopsis1Decision || synopsisData?.synopsis1Decision === 3

  // Can edit second attempt if: first is rejected AND (second has no decision OR revision is requested)
  const canEdit2 = isFirstRejected && (!synopsisData?.synopsis2Decision || synopsisData?.synopsis2Decision === 3)

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" tip="Loading synopsis data..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    )
  }

  if (!synopsisData) {
    return <Empty description="No synopsis data found" />
  }

  return (
    <div className="h-full bg-gradient-to-br p-2 from-gray-50 to-gray-100 rounded-2xl">
      <div className="p-1">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-lg shadow-sm mb-3 p-2">
          <h1 className="text-lg font-semibold flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Synopsis Submission
          </h1>
        </div>

        {/* Both Rejected Warning */}
        {isBothRejected && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-3">
            <strong>Your Synopsis has been rejected.</strong> Please contact the administration for further assistance.
          </div>
        )}

        {/* Synopsis 1 Information */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800 flex items-center">
              <div className="w-2 h-2 bg-slate-500 rounded-full mr-2"></div>
              Synopsis Details {synopsisData?.synopsis2Decision === 2 ? "(First Attempt)" : ""}
            </h2>
            {canEdit1 && !isEditing1 && (
              <Button type="primary" icon={<EditOutlined />} size="small" onClick={handleEdit1}>
                Edit
              </Button>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/4 text-slate-700">Title of Synopsis</td>
                  <td className="p-2 text-slate-800" colSpan="3">
                    {isEditing1 ? (
                      <Input
                        value={editedData?.synopsis1Title || ''}
                        onChange={(e) => setEditedData({ ...editedData, synopsis1Title: e.target.value })}
                        placeholder="Enter title of Synopsis"
                      />
                    ) : (
                      synopsisData?.synopsis1Title || '-'
                    )}
                  </td>
                </tr>
                <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Synopsis File</td>
                  <td className="p-2 text-slate-800" colSpan="3">
                    {isEditing1 ? (
                      <Upload
                        fileList={fileList1}
                        onChange={({ fileList }) => setFileList1(fileList)}
                        beforeUpload={() => false}
                        accept=".pdf,.doc,.docx"
                        maxCount={1}
                      >
                        <Button icon={<UploadOutlined />}>Upload Synopsis (PDF/DOC)</Button>
                      </Upload>
                    ) : synopsisData?.synopsis1FilePath ? (
                      <Button type="link" icon={<EyeOutlined />} onClick={() => handlePreviewFile(synopsisData.synopsis1FilePath)}>
                        View File
                      </Button>
                    ) : '-'}
                  </td>
                </tr>
                <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Last Date of Submission</td>
                  <td className="p-2 text-slate-800">{formatDate(synopsisData?.synopsis1LastDate)}</td>
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Submitted At</td>
                  <td className="p-2 text-slate-800">{formatDateTime(synopsisData?.synopsis1Date)}</td>
                </tr>
                <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Synopsis Acceptance</td>
                  <td className="p-2 text-slate-800">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getSynopsisDecisionDisplay(synopsisData?.synopsis1Decision).className}`}>
                      {getSynopsisDecisionDisplay(synopsisData?.synopsis1Decision).text}
                    </span>
                  </td>
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">RDC Remark</td>
                  <td className="p-2 text-slate-800">{synopsisData?.synopsis1RDCRemark || '-'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">RDC Date</td>
                  <td className="p-2 text-slate-800" colSpan="3">{formatDate(synopsisData?.synopsis1RDCDate)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {isEditing1 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <Space>
                <Button icon={<CloseOutlined />} onClick={handleCancel1} disabled={submitting}>Cancel</Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave1} loading={submitting}>Submit Synopsis</Button>
              </Space>
            </div>
          )}
        </div>

        {/* Synopsis 2 Information - Only show if first attempt is rejected */}
        {isFirstRejected && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-4">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 flex items-center">
                <div className="w-2 h-2 bg-slate-500 rounded-full mr-2"></div>
                Synopsis Details (Second Attempt)
              </h2>
              {canEdit2 && !isEditing2 && (
                <Button type="primary" icon={<EditOutlined />} size="small" onClick={handleEdit2}>
                  Edit
                </Button>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/4 text-slate-700">Title of Synopsis</td>
                    <td className="p-2 text-slate-800" colSpan="3">
                      {isEditing2 ? (
                        <Input
                          value={editedData?.synopsis2Title || ''}
                          onChange={(e) => setEditedData({ ...editedData, synopsis2Title: e.target.value })}
                          placeholder="Enter title of Synopsis"
                        />
                      ) : synopsisData?.synopsis2Title || '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Synopsis File</td>
                    <td className="p-2 text-slate-800" colSpan="3">
                      {isEditing2 ? (
                        <Upload
                          fileList={fileList2}
                          onChange={({ fileList }) => setFileList2(fileList)}
                          beforeUpload={() => false}
                          accept=".pdf,.doc,.docx"
                          maxCount={1}
                        >
                          <Button icon={<UploadOutlined />}>Upload Synopsis (PDF/DOC)</Button>
                        </Upload>
                      ) : synopsisData?.synopsis2FilePath ? (
                        <Button type="link" icon={<EyeOutlined />} onClick={() => handlePreviewFile(synopsisData.synopsis2FilePath)}>
                          View File
                        </Button>
                      ) : '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Last Date of Submission</td>
                    <td className="p-2 text-slate-800">{formatDate(synopsisData?.synopsis2LastDate || synopsisData?.synopsis1LastDate)}</td>
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Submitted At</td>
                    <td className="p-2 text-slate-800">{formatDateTime(synopsisData?.synopsis2Date)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">Synopsis Acceptance</td>
                    <td className="p-2 text-slate-800">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${getSynopsisDecisionDisplay(synopsisData?.synopsis2Decision).className}`}>
                        {getSynopsisDecisionDisplay(synopsisData?.synopsis2Decision).text}
                      </span>
                    </td>
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">RDC Remark</td>
                    <td className="p-2 text-slate-800">{synopsisData?.synopsis2RDCRemark || '-'}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700">RDC Date</td>
                    <td className="p-2 text-slate-800" colSpan="3">{formatDate(synopsisData?.synopsis2RDCDate)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {isEditing2 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                <Space>
                  <Button icon={<CloseOutlined />} onClick={handleCancel2} disabled={submitting}>Cancel</Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleSave2} loading={submitting}>Submit Synopsis</Button>
                </Space>
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      <Modal
        title={`Preview - ${previewFileName}`}
        open={previewModalVisible}
        onCancel={handleClosePreview}
        width="90%"
        style={{ maxWidth: '1000px' }}
        footer={[
          <Button key="close" onClick={handleClosePreview}>Close</Button>,
          <Button key="download" type="primary" onClick={() => window.open(previewUrl, '_blank')}>Download</Button>,
        ]}
      >
        <div style={{ maxHeight: '600px', overflow: 'auto' }}>
          {previewFileName.endsWith('.pdf') ? (
            <iframe src={previewUrl} style={{ width: '100%', height: '600px', border: 'none' }} title="PDF Preview" />
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p>Preview not available for this file type</p>
              <Button type="primary" onClick={() => window.open(previewUrl, '_blank')}>Download File</Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default Synopsis
