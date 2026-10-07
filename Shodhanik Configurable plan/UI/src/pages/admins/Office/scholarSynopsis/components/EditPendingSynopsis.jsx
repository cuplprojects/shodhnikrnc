import { useEffect, useState } from 'react'
import { Divider, Button, Spin, Empty, Tabs, Tag, DatePicker, Input as AntInput, Modal, Select, Steps } from 'antd'
import { SaveOutlined, DownloadOutlined, EyeOutlined, ExportOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import PrintHeader from '@/components/cms/PrintHeader'
import { hasPermission } from '@/services/hasPermissionService'

const EditPendingSynopsis = ({ task }) => {
  const [profileData, setProfileData] = useState(null)
  const [synopsisData, setSynopsisData] = useState(null)
  const [workflowSteps, setWorkflowSteps] = useState([])
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState(null)
  const [workflowLogs, setWorkflowLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // PDF Preview Modal states
  const [pdfModalVisible, setPdfModalVisible] = useState(false)
  const [currentPdfUrl, setCurrentPdfUrl] = useState('')
  const [currentPdfTitle, setCurrentPdfTitle] = useState('')

  const notify = notification()
  const baseFileURL = getBaseFileURL()
  const candownload = hasPermission('scholar_synopsis.download')
  const canapprove = hasPermission('scholar_synopsis.approve')
  const canreject = hasPermission('scholar_synopsis.reject')
  const canrevision = hasPermission('scholar_synopsis.revision')
  const canread = hasPermission('scholar_synopsis.read')

  const sid = task?.sid

  useEffect(() => {
    if (sid) {
      fetchScholarDetails()
      fetchWorkflowSteps()
      fetchWorkflowLogs()
    }
  }, [sid])

  const fetchWorkflowSteps = async () => {
    try {
      const res = await API.get('/WorkflowManagement/workflow-steps/6')
      if (res.data) {
        setWorkflowSteps(res.data)
        // Find current step based on task's current step order
        const currentStep = res.data.find(step => step.stepOrder === task?.currentStep)
        setCurrentWorkflowStep(currentStep || res.data[0])
      }
    } catch (error) {
      console.error('Failed to fetch workflow steps:', error)
    }
  }

  const fetchWorkflowLogs = async () => {
    try {
      // Fetch workflow history for this scholar's synopsis
      const res = await API.get(`/ApprovalEngine/history/SynopsisRDC/${sid}`)
      if (res.data && res.data.logs) {
        setWorkflowLogs(res.data.logs)
        console.log('Workflow logs:', res.data.logs)
      }
    } catch (error) {
      console.error('Failed to fetch workflow logs:', error)
    }
  }

  const fetchScholarDetails = async () => {
    setLoading(true)
    try {
      const [profileRes, synopsisRes] = await Promise.all([
        API.get(`/Scholars/Profile/${sid}`),
        API.get(`/SynopsisRDC/${sid}`),
      ])

      if (profileRes.data) {
        setProfileData(profileRes.data)
      }
      if (synopsisRes.data) {
        setSynopsisData(synopsisRes.data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (!task || !sid) {
    return <Empty description="Select a scholar to view details" />
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" tip="Loading scholar details..." />
      </div>
    )
  }

  if (!profileData || !synopsisData) {
    return <Empty description="Failed to load details" />
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const getDecisionTag = (decision) => {
    if (decision === null || decision === undefined) return <Tag>Pending</Tag>
    if (decision === 0) return <Tag>Pending</Tag>
    if (decision === 1) return <Tag color="green">Accepted</Tag>
    if (decision === 2) return <Tag color="red">Rejected</Tag>
    if (decision === 3) return <Tag color="orange">Revision Required</Tag>
    if (decision === 'Accepted') return <Tag color="green">Accepted</Tag>
    if (decision === 'Rejected') return <Tag color="red">Rejected</Tag>
    return <Tag>{decision}</Tag>
  }

  const getStatusText = (status) => {
    if (status === null || status === undefined) return 'Pending'
    if (status === 0) return 'Pending'
    if (status === 1) return 'Accepted'
    if (status === 2) return 'Rejected'
    return status
  }

  const handleSubmitRDCDecision = async (synopsisPrefix, rdcMeetingDate, rdcRemark) => {
    setSubmitting(true)
    try {
      // Log workflow action with scheduled meeting date
      if (currentWorkflowStep && sid) {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const roleId = user?.roleID || user?.roleId || '17' // Default to Office role (17)
        
        const workflowPayload = {
          workflowId: 6,
          instanceId: sid, // This is EntityID (Scholar ID), not WorkflowInstance.InstanceID
          stepOrder: currentWorkflowStep.stepOrder,
          action: 'Accept',
          remarks: rdcRemark || 'RDC decision accepted',
          actionByUserID: String(roleId), // Send roleId as actionByUserID
          scheduledMeetingDate: rdcMeetingDate ? rdcMeetingDate.format('YYYY-MM-DDTHH:mm:ss') : null
        }
        
        console.log('Logging workflow action with scheduled meeting:', workflowPayload)
        
        const workflowResponse = await API.post('/WorkflowManagement/log-action', workflowPayload)
        console.log('Workflow log response:', workflowResponse.data)
        
        notify.success('RDC decision submitted and meeting scheduled successfully')
        await fetchScholarDetails()
        await fetchWorkflowLogs()
      }
    } catch (error) {
      notify.error('Failed to submit decision')
      console.error('Error:', error)
      console.error('Error response:', error.response?.data)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRejectSubmission = async (synopsisPrefix, rdcRemark) => {
    if (!rdcRemark.trim()) {
      notify.error('Please provide remarks for rejection')
      return
    }

    setSubmitting(true)
    try {
      // Log workflow action - use sid (EntityID) not instanceId
      if (currentWorkflowStep && sid) {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const roleId = user?.roleID || user?.roleId || '17' // Default to Office role (17)
        
        const workflowPayload = {
          workflowId: 6,
          instanceId: sid, // This is EntityID (Scholar ID), not WorkflowInstance.InstanceID
          stepOrder: currentWorkflowStep.stepOrder,
          action: 'Reject',
          remarks: rdcRemark,
          actionByUserID: String(roleId) // Send roleId as actionByUserID
        }
        
        console.log('Logging workflow rejection:', workflowPayload)
        
        const workflowResponse = await API.post('/WorkflowManagement/log-action', workflowPayload)
        console.log('Workflow log response:', workflowResponse.data)
        
        notify.success('Re-submission allowed')
        await fetchScholarDetails()
        await fetchWorkflowLogs()
      }
    } catch (error) {
      notify.error('Failed to submit decision')
      console.error('Error:', error)
      console.error('Error response:', error.response?.data)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestRevision = async (synopsisPrefix, rdcRemark) => {
    if (!rdcRemark.trim()) {
      notify.error('Please provide remarks for revision request')
      return
    }

    setSubmitting(true)
    try {
      // Log workflow action - use sid (EntityID) not instanceId
      if (currentWorkflowStep && sid) {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const roleId = user?.roleID || user?.roleId || '17' // Default to Office role (17)
        
        const workflowPayload = {
          workflowId: 6,
          instanceId: sid, // This is EntityID (Scholar ID), not WorkflowInstance.InstanceID
          stepOrder: currentWorkflowStep.stepOrder,
          action: 'RequestRevision',
          remarks: rdcRemark,
          actionByUserID: String(roleId) // Send roleId as actionByUserID
        }
        
        console.log('Logging workflow revision request:', workflowPayload)
        
        const workflowResponse = await API.post('/WorkflowManagement/log-action', workflowPayload)
        console.log('Workflow log response:', workflowResponse.data)
        
        notify.success('Revision request sent to scholar')
        await fetchScholarDetails()
        await fetchWorkflowLogs()
      }
    } catch (error) {
      notify.error('Failed to send revision request')
      console.error('Error:', error)
      console.error('Error response:', error.response?.data)
    } finally {
      setSubmitting(false)
    }
  }


  const handlePreviewPdf = (filePath, title) => {
    if (!filePath) {
      notify.error('No file available for preview')
      return
    }
    const fullUrl = `${baseFileURL}/${filePath}`
    setCurrentPdfUrl(fullUrl)
    setCurrentPdfTitle(title)
    setPdfModalVisible(true)
  }

  const handleOpenInNewTab = () => {
    if (currentPdfUrl) {
      window.open(currentPdfUrl, '_blank')
    }
  }

  const SynopsisGroup = ({ title, prefix, data }) => {
    const [rdcDecision, setRdcDecision] = useState(null)
    const [rdcMeetingDate, setRdcMeetingDate] = useState(null)
    const [rdcRemark, setRdcRemark] = useState('')

    // Check if there's a workflow log for the current step (Office step = 1)
    const currentStepLog = workflowLogs.find(log => log.stepOrder === 1 && log.action === 'Accept')
    const hasDecision = !!currentStepLog

    const hasData =
      data?.[`${prefix}Title`] ||
      data?.[`${prefix}FilePath`] ||
      data?.[`${prefix}Receipt`] ||
      data?.[`${prefix}FeeAmt`]

    if (!hasData) {
      return (
        <div className="bg-slate-50 p-4 rounded-lg text-center text-slate-500">
          No data available
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {/* Main Synopsis Details */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800">Submission Details</h4>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Title</label>
                <div className="text-slate-800 text-sm">{data?.[`${prefix}Title`] || '-'}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Receipt Number</label>
                <div className="text-slate-800 text-sm">{data?.[`${prefix}Receipt`] || '-'}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Fee Amount</label>
                <div className="text-slate-800 text-sm">{data?.[`${prefix}FeeAmt`] || '-'}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Submission Date</label>
                <div className="text-slate-800 text-sm">{formatDate(data?.[`${prefix}Date`])}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Last Date for Submission</label>
                <div className="text-slate-800 text-sm">{formatDate(data?.[`${prefix}LastDate`])}</div>
              </div>
              {data?.[`${prefix}FilePath`] && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">File</label>
                  <div className="flex gap-1">
                    {canread && (
                      <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={() => handlePreviewPdf(
                          data[`${prefix}FilePath`],
                          `${prefix === 'synopsis1' ? 'Synopsis 1' : 'Synopsis 2'} Document`
                        )}
                      >
                        Preview
                      </Button>
                    )}
                    {candownload && (
                      <Button
                        type="default"
                        icon={<DownloadOutlined />}
                        size="small"
                        onClick={() => window.open(`${baseFileURL}/${data[`${prefix}FilePath`]}`, '_blank')}
                      >
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RDC Decision Details */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800">Synopsis Decision</h4>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Decision</label>
                <div>{hasDecision ? <Tag color="green">Accepted</Tag> : <Tag>Pending</Tag>}</div>
              </div>
              {currentStepLog && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">RDC Meeting Date</label>
                    <div className="text-slate-800 text-sm">
                      {currentStepLog.scheduledMeetingDate ? formatDate(currentStepLog.scheduledMeetingDate) : '-'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">RDC Remark</label>
                    <div className="text-slate-800 bg-slate-50 p-2 rounded text-sm">{currentStepLog.comments || '-'}</div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Decision Date</label>
                    <div className="text-slate-800 text-sm">{formatDate(currentStepLog.actionTimestamp)}</div>
                  </div>
                </>
              )}
            </div>
            
            {/* Show success message when decision is accepted */}
            {hasDecision && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircleOutlined className="text-lg" />
                  <span className="font-semibold">Synopsis Accepted & RDC Meeting Scheduled</span>
                </div>
                {currentStepLog?.scheduledMeetingDate && (
                  <div className="mt-2 text-sm text-green-700">
                    Meeting scheduled for: <span className="font-semibold">{formatDate(currentStepLog.scheduledMeetingDate)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RDC Proceeding Details */}
        {!!(
          data?.[`syn${prefix.slice(-1)}RDC1ProceedingRemark`] ||
          data?.[`syn${prefix.slice(-1)}RDC1ProceedingStatus`] ||
          data?.[`syn${prefix.slice(-1)}RDC1ProceedingFilePath`]
        ) && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800">RDC Proceeding</h4>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                  <div className="text-slate-800 text-sm">{getStatusText(data?.[`syn${prefix.slice(-1)}RDC1ProceedingStatus`])}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Remark</label>
                  <div className="text-slate-800 bg-slate-50 p-2 rounded text-sm">{data?.[`syn${prefix.slice(-1)}RDC1ProceedingRemark`] ?? '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Time</label>
                  <div className="text-slate-800 text-sm">{formatDate(data?.[`syn${prefix.slice(-1)}RDC1ProceedingTime`])}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">By</label>
                  <div className="text-slate-800 text-sm">{data?.[`syn${prefix.slice(-1)}RDC1ProceedingBy`] ?? '-'}</div>
                </div>
                {data?.[`syn${prefix.slice(-1)}RDC1ProceedingFilePath`] && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">RDC Proceeding File</label>
                    <div className="flex gap-1">
                      {canread && (
                        <Button
                          type="primary"
                          icon={<EyeOutlined />}
                          size="small"
                          onClick={() => handlePreviewPdf(
                            data[`syn${prefix.slice(-1)}RDC1ProceedingFilePath`],
                            'RDC Proceeding Document'
                          )}
                        >
                          Preview
                        </Button>
                      )}
                      {candownload && (
                        <Button
                          type="default"
                          icon={<DownloadOutlined />}
                          size="small"
                          onClick={() => window.open(`${baseFileURL}/${data[`syn${prefix.slice(-1)}RDC1ProceedingFilePath`]}`, '_blank')}
                        >
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}





        {/* RDC Final Decision Details */}
        {(data?.[`syn${prefix.slice(-1)}RDC1Decision`] ||
          data?.[`syn${prefix.slice(-1)}RDC1DecisionRemark`]) && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800">RDC Final Decision</h4>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Decision</label>
                  <div>{getDecisionTag(data?.[`syn${prefix.slice(-1)}RDC1Decision`])}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Remark</label>
                  <div className="text-slate-800 bg-slate-50 p-2 rounded text-sm">{data?.[`syn${prefix.slice(-1)}RDC1DecisionRemark`] || '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Submit Time</label>
                  <div className="text-slate-800 text-sm">{formatDate(data?.[`syn${prefix.slice(-1)}RDC1SubmitTime`])}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">By</label>
                  <div className="text-slate-800 text-sm">{data?.[`syn${prefix.slice(-1)}RDC1BY`] || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RDC Decision Input Section - Only show if no decision yet */}
        {!hasDecision && (
          <div className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50">
            <div className="bg-gradient-to-r from-blue-100 to-blue-50 p-2 border-b border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800">Make RDC Decision</h4>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Select Decision <span className="text-red-500">*</span>
                </label>
                <Select
                  value={rdcDecision}
                  onChange={(value) => {
                    setRdcDecision(value)
                    setRdcMeetingDate(null)
                    setRdcRemark('')
                  }}
                  placeholder="-- Select an option --"
                  className="w-full"
                  options={[
                    { label: 'Accept & Schedule RDC Meeting', value: 'accept' },
                    { label: 'Request Revision', value: 'revision' },
                    { label: 'Reject (Allow Re-Submission)', value: 'reject' },
                  ]}
                />
              </div>

              {rdcDecision === 'accept' && (
                <div className="bg-white p-3 rounded border border-green-200 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      RDC Meeting Date (Optional)
                    </label>
                    <DatePicker
                      value={rdcMeetingDate}
                      onChange={setRdcMeetingDate}
                      className="w-full"
                      placeholder="Select date"
                      format="DD/MM/YYYY"
                      size="small"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Remarks (Optional)
                    </label>
                    <AntInput.TextArea
                      value={rdcRemark}
                      onChange={(e) => setRdcRemark(e.target.value)}
                      placeholder="Enter any remarks for the scholar"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    {canapprove && (
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={submitting}
                        onClick={() => handleSubmitRDCDecision(prefix, rdcMeetingDate, rdcRemark)}
                        size="small"
                      >
                        Accept & Schedule
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {rdcDecision === 'revision' && (
                <div className="bg-white p-3 rounded border border-orange-200 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Revision Remarks <span className="text-red-500">*</span>
                    </label>
                    <AntInput.TextArea
                      value={rdcRemark}
                      onChange={(e) => setRdcRemark(e.target.value)}
                      placeholder="Enter specific revision requirements"
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    {canrevision && (
                      <Button
                        type="primary"
                        loading={submitting}
                        onClick={() => handleRequestRevision(prefix, rdcRemark)}
                        size="small"
                      >
                        Request Revision
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {rdcDecision === 'reject' && (
                <div className="bg-white p-3 rounded border border-red-200 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Remarks <span className="text-red-500">*</span>
                    </label>
                    <AntInput.TextArea
                      value={rdcRemark}
                      onChange={(e) => setRdcRemark(e.target.value)}
                      placeholder="Enter remarks for rejection"
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    {canreject && (
                      <Button
                        type="primary"
                        danger
                        loading={submitting}
                        onClick={() => handleRejectSubmission(prefix, rdcRemark)}
                        size="small"
                      >
                        Reject & Allow Re-Submission
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const isSynopsis1Rejected = synopsisData?.synopsis1Decision === 2

  const tabItems = [
    {
      key: '1',
      label: 'Synopsis 1',
      children: <SynopsisGroup title="Synopsis 1" prefix="synopsis1" data={synopsisData} />,
    },
    {
      key: '2',
      label: 'Synopsis 2 (Resubmission)',
      disabled: !isSynopsis1Rejected,
      children: isSynopsis1Rejected 
        ? <SynopsisGroup title="Synopsis 2" prefix="synopsis2" data={synopsisData} />
        : <div className="bg-slate-50 p-4 rounded-lg text-center text-slate-500">Synopsis 2 will be enabled only if Synopsis 1 is rejected</div>,
    },
  ]

  return (
    <div className="h-full bg-gradient-to-br p-1 from-gray-50 to-gray-100 rounded-xl">
      <div className="p-0 pt-0">
        {/* Profile Section Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-t-lg shadow-sm p-1.5">
          <h2 className="text-base font-semibold flex items-center">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
            Scholar Profile
          </h2>
        </div>

        <div className="bg-white rounded-b-lg shadow-sm p-3">

          {/* University Header */}
          <div className="flex justify-center mb-2">
            <PrintHeader />
          </div>

          {/* Profile Content */}
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            {/* Basic Details Header */}
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-1.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center">
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full mr-1.5"></div>
                Basic Details
              </h3>
            </div>

            {/* Mobile Profile Picture - Show at top on small screens */}
            <div className="block lg:hidden p-2 bg-slate-50/30 border-b border-slate-200">
              <div className="flex justify-center">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-28 border border-slate-300 mb-1.5 flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                    {profileData?.profilePicture ? (
                      <img
                        src={`${baseFileURL}/${profileData.profilePicture}`}
                        alt="Profile"
                        className="w-full h-full object-fitcover"
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
                  <div className="p-2 bg-slate-100 font-semibold text-slate-700 text-center text-sm">
                    Shodhanik ID : <span className="text-slate-800 font-normal">{profileData?.shodhanikID || 'N/A'}</span>
                  </div>
                </div>
                <div className="w-24 h-32 border border-slate-300 mb-2 flex items-center justify-center bg-white rounded-lg shadow-sm overflow-hidden">
                  {profileData?.profilePicture ? (
                    <img
                      src={`${baseFileURL}/${profileData.profilePicture}`}
                      alt="Profile"
                      className="w-full h-full object-fitcover"
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
        </div>
      </div>

      <Divider className="my-2" />
      {/* RDC Meeting Schedule Component */}
      <div className="bg-white rounded-lg shadow-sm p-3 mt-3">
        <div className="bg-gradient-to-r from-blue-100 to-blue-50 p-2 border-b border-blue-200 mb-3 rounded-t-lg">
          <h3 className="text-sm font-semibold text-blue-800 flex items-center">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></div>
            RDC Meeting Scheduled for Synopsis Presentation
          </h3>
        </div>

        {/* Meeting Details Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/4 text-slate-700 text-sm">
                  Title of Ph.D.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-800 text-sm">
                  {synopsisData?.synopsis1Title || 'Synopsis'}
                </td>
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 w-1/6 text-slate-700 text-sm">
                  Remarks
                </td>
                <td className="p-2 text-slate-800 text-sm">
                  {synopsisData?.synopsis1RDCRemark || '-'}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  Synopsis
                </td>
                <td className="p-2 border-r border-slate-200 text-sm">
                  {synopsisData?.synopsis1FilePath ? (
                    <a
                      href={`${baseFileURL}/${synopsisData.synopsis1FilePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View Synopsis
                    </a>
                  ) : (
                    <span className="text-slate-500">No file available</span>
                  )}
                </td>
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  Uploaded at
                </td>
                <td className="p-2 text-slate-800 text-sm">
                  {formatDate(synopsisData?.synopsis1Date) || '-'}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  RDC Date
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-800 text-sm">
                  {formatDate(synopsisData?.synopsis1RDCDate) || '-'}
                </td>
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  Fee Amount Paid(INR)
                </td>
                <td className="p-2 text-slate-800 text-sm">
                  {synopsisData?.synopsis1FeeAmt || '-'}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  Fee Receipt No.
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-800 text-sm">
                  {synopsisData?.synopsis1Receipt || '-'}
                </td>
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  Scheduled at
                </td>
                <td className="p-2 text-slate-800 text-sm">
                  {formatDate(synopsisData?.syn1RDC1ProceedingTime) || '-'}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  Scheduled By
                </td>
                <td className="p-2 border-r border-slate-200 text-slate-800 text-sm">
                  {synopsisData?.syn1RDC1ProceedingBy || 'OFFICE00'}
                </td>
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  Final RDC Letter
                </td>
                <td className="p-2 text-sm">
                  {synopsisData?.syn1RDC1DecisionFilePath ? (
                    <a
                      href={`${baseFileURL}/${synopsisData.syn1RDC1DecisionFilePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Download Format
                    </a>
                  ) : (
                    <a href="#" className="text-blue-600 hover:text-blue-800 underline">
                      Download Format
                    </a>
                  )}
                </td>
              </tr>
              <tr>
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                  RDC Proceeding Letter
                </td>
                <td className="p-2 border-r border-slate-200 text-sm">
                  <a href="#" className="text-blue-600 hover:text-blue-800 underline">
                    Download Format
                  </a>
                </td>
                <td className="p-2 bg-slate-50 font-semibold border-r border-slate-200 text-slate-700 text-sm">
                </td>
                <td className="p-2 text-sm">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Re-Allow Synopsis Upload Button */}
        {/*<div className="flex justify-center mb-3">
          <Button
            type="primary"
            danger
            size="middle"
            className="px-6"
            loading={submitting}
            onClick={handleReAllowSynopsisUpload}
          >
            Re-Allow Synopsis Upload
          </Button>
        </div>*/}
      </div>
      <Divider className="my-2" />
      {/* Synopsis Section */}
      <div className="bg-white rounded-lg shadow-sm p-3 mt-3">
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-1.5 border-b border-slate-200 mb-2 rounded-t-lg">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center">
            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full mr-1.5"></div>
            Synopsis Submissions
          </h3>
        </div>

        <Tabs items={tabItems} />
      </div>



      {/* PDF Preview Modal */}
      <Modal
        title={
          <div className="flex items-center justify-between">
            <span>{currentPdfTitle}</span>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleOpenInNewTab}
              size="small"
            >
              Open in New Tab
            </Button>
          </div>
        }
        open={pdfModalVisible}
        onCancel={() => setPdfModalVisible(false)}
        width="90%"
        style={{ top: 20 }}
        footer={[
          <Button key="close" onClick={() => setPdfModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="newTab"
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleOpenInNewTab}
          >
            Open in New Tab
          </Button>
        ]}
      >
        <div style={{ height: '70vh', width: '100%' }}>
          {currentPdfUrl && (
            <iframe
              src={currentPdfUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '4px'
              }}
              title="PDF Preview"
            />
          )}
        </div>
      </Modal>
    </div>
  )
}

export default EditPendingSynopsis
