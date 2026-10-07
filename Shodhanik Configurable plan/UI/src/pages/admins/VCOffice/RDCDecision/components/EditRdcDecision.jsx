import { useEffect, useState } from 'react'
import { Divider, Button, Spin, Empty, Tabs, Tag, Input as AntInput, Modal, Select } from 'antd'
import { DownloadOutlined, EyeOutlined, ExportOutlined } from '@ant-design/icons'
import API from '@/services/API'
import workflowService from '@/services/workflowService'
import useStaffAuthStore from '@/store/staffAuthStore'
import notification from '@/services/NotificationService'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import PrintHeader from '@/components/cms/PrintHeader'


const EditRDCDecision = ({ selectedRecord, onBack }) => {
    const { user, initializeAuth } = useStaffAuthStore()
    const [profileData, setProfileData] = useState(null)
    const [synopsisData, setSynopsisData] = useState(null)
    const [workflowHistory, setWorkflowHistory] = useState([])
    const [workflowInstance, setWorkflowInstance] = useState(null)
    const [loading, setLoading] = useState(false)
    
    // VC Office Approval states
    const [vcDecision, setVcDecision] = useState(null)
    const [vcRemark, setVcRemark] = useState('')
    const [submittingVcApproval, setSubmittingVcApproval] = useState(false)
    // PDF Preview Modal states
    const [pdfModalVisible, setPdfModalVisible] = useState(false)
    const [currentPdfUrl, setCurrentPdfUrl] = useState('')
    const [currentPdfTitle, setCurrentPdfTitle] = useState('')

    const notify = notification()
    const baseFileURL = getBaseFileURL()

    // Ensure auth is initialized
    useEffect(() => {
        if (!user) {
            initializeAuth()
        }
    }, [])

    useEffect(() => {
        if (selectedRecord?.sid) {
            fetchScholarDetails()
        }
    }, [selectedRecord])

    const fetchScholarDetails = async () => {
        setLoading(true)
        try {
            const [profileRes, synopsisRes, workflowRes] = await Promise.all([
                API.get(`/Scholars/Profile/${selectedRecord.sid}`),
                API.get(`/SynopsisRDC/${selectedRecord.sid}`),
                workflowService.getEntityHistory('SynopsisRDC', selectedRecord.sid)
            ])

            if (profileRes.data) {
                setProfileData(profileRes.data)
            }
            if (synopsisRes.data) {
                setSynopsisData(synopsisRes.data)
            }
            if (workflowRes) {
                console.log('Workflow History:', workflowRes.logs)
                console.log('Workflow Instance:', workflowRes.instance)
                setWorkflowHistory(workflowRes.logs || [])
                setWorkflowInstance(workflowRes.instance || null)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (!selectedRecord) {
        return <Empty description="Select a record to view details" />
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
        if (decision === 1) return <Tag color="green">Approved</Tag>
        if (decision === 2) return <Tag color="red">Rejected</Tag>
        if (decision === 3) return <Tag color="orange">Needs Revision</Tag>
        return <Tag>{decision}</Tag>
    }

    const getStatusText = (status) => {
        if (status === null || status === undefined) return 'Pending'
        if (status === 0) return 'Pending'
        if (status === 1) return 'Approved'
        if (status === 2) return 'Rejected'
        if (status === 3) return 'Needs Revision'
        return status
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
    const handleVcApproval = async () => {
        // Debug logging
        console.log('User object:', user)
        console.log('User roleId:', user?.roleId)
        
        if (!user?.roleId) {
            notify.error('User role information not available. Please refresh and try again.')
            return
        }

        const actionRequest = {
            entityID: synopsisData?.sid,
            entityType: 'SynopsisRDC',
            action: vcDecision === 0 ? 'Reject' : 'Approve',
            comments: vcRemark.trim() || (vcDecision === 0 ? 'Sent back to office' : 'Approved by VC Office'),
            UserId: user.roleId,
            workflowName: 'Synopsis'
        }

        console.log('Action request:', actionRequest)

        setSubmittingVcApproval(true)
        try {
            await workflowService.submitApprovalAction(actionRequest)

            const decisionText = vcDecision === 0 ? 'sent back to office' : 'approved'
            notify.success(`RDC decision ${decisionText} by VC Office successfully`)

            setVcRemark('')
            setVcDecision(null)
            await fetchScholarDetails()
        } catch (error) {
            notify.error('Failed to submit VC approval')
            console.error(error)
        } finally {
            setSubmittingVcApproval(false)
        }
    }

    const SynopsisGroup = ({ title, prefix, data }) => {
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
            <div className="space-y-4">
                {/* Main Synopsis Details */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-800">Submission Details</h4>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Title</label>
                                <div className="text-slate-800 mt-1">{data?.[`${prefix}Title`] || '-'}</div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Receipt Number</label>
                                <div className="text-slate-800 mt-1">{data?.[`${prefix}Receipt`] || '-'}</div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Fee Amount</label>
                                <div className="text-slate-800 mt-1">{data?.[`${prefix}FeeAmt`] || '-'}</div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Submission Date</label>
                                <div className="text-slate-800 mt-1">{formatDate(data?.[`${prefix}Date`])}</div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">RDC Date</label>
                                <div className="text-slate-800 mt-1">{formatDate(data?.[`${prefix}RDCDate`])}</div>
                            </div>
                           
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Last Date for Submission</label>
                                <div className="text-slate-800 mt-1">{formatDate(data?.[`${prefix}LastDate`])}</div>
                            </div>
                            {data?.[`${prefix}FilePath`] && (
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">File</label>
                                    <div className="mt-1 flex gap-1">
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
                                        <Button
                                            type="default"
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            onClick={() => window.open(`${baseFileURL}/${data[`${prefix}FilePath`]}`, '_blank')}
                                        >
                                            Download
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RDC Decision Details */}
                {/* <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-800">Synopsis Decision</h4>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                            <div>
                                <label className="text-sm font-semibold text-slate-700">Decision</label>
                                <div className="mt-1">{getDecisionTag(data?.[`${prefix}Decision`])}</div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">RDC Date</label>
                                <div className="text-slate-800 mt-1">{formatDate(data?.[`${prefix}RDCDate`])}</div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700">RDC Remark</label>
                                <div className="text-slate-800 mt-1 bg-slate-50 p-2 rounded">
                                    {data?.[`${prefix}RDCRemark`] || '-'}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Approved Date</label>
                                    <div className="text-slate-800 mt-1">{formatDate(data?.[`${prefix}ApprovedDate`])}</div>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Approved By</label>
                                    <div className="text-slate-800 mt-1">{data?.[`${prefix}ApprovedBy`] || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div> */}

                {/* RDC Proceeding Details */}
                {!!(
                    data?.[`syn${prefix.slice(-1)}RDC1ProceedingRemark`] ||
                    data?.[`syn${prefix.slice(-1)}RDC1ProceedingStatus`] ||
                    data?.[`syn${prefix.slice(-1)}RDC1ProceedingFilePath`]
                ) && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
                                <h4 className="font-semibold text-slate-800">RDC Proceeding</h4>
                            </div>
                            <div className="p-4 space-y-3 grid grid-cols-1 sm:grid-cols-6 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Status</label>
                                    <div className="text-slate-800 mt-1">
                                        {getStatusText(data?.[`syn${prefix.slice(-1)}RDC1ProceedingStatus`])}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Remark</label>
                                    <div className="text-slate-800 mt-1 bg-slate-50 p-2 rounded">
                                        {data?.[`syn${prefix.slice(-1)}RDC1ProceedingRemark`] ?? '-'}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Time</label>
                                    <div className="text-slate-800 mt-1">
                                        {formatDate(data?.[`syn${prefix.slice(-1)}RDC1ProceedingTime`])}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700">By</label>
                                    <div className="text-slate-800 mt-1">
                                        {data?.[`syn${prefix.slice(-1)}RDC1ProceedingBy`] ?? '-'}
                                    </div>
                                </div>

                                {data?.[`syn${prefix.slice(-1)}RDC1ProceedingFilePath`] && (
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700">RDC Proceeding File</label>
                                        <div className="mt-1 flex gap-1">
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
                                            <Button
                                                type="default"
                                                icon={<DownloadOutlined />}
                                                size="small"
                                                onClick={() => window.open(`${baseFileURL}/${data[`syn${prefix.slice(-1)}RDC1ProceedingFilePath`]}`, '_blank')}
                                            >
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                {!!(
                    data?.[`syn${prefix.slice(-1)}RDC1DecisionRemark`] ||
                    data?.[`syn${prefix.slice(-1)}RDC1Decision`] ||
                    data?.[`syn${prefix.slice(-1)}RDC1DecisionFilePath`]
                ) && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
                                <h4 className="font-semibold text-slate-800">RDC Decision</h4>
                            </div>
                            <div className="p-4 space-y-3 grid grid-cols-1 sm:grid-cols-6 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Status</label>
                                    <div className="text-slate-800 mt-1">
                                        {getStatusText(data?.[`syn${prefix.slice(-1)}RDCDecision`])}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Remark</label>
                                    <div className="text-slate-800 mt-1 bg-slate-50 p-2 rounded">
                                        {data?.[`syn${prefix.slice(-1)}RDCDecisionRemark`] ?? '-'}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Time</label>
                                    <div className="text-slate-800 mt-1">
                                        {formatDate(data?.[`syn${prefix.slice(-1)}RDCDecisionTime`])}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700">By</label>
                                    <div className="text-slate-800 mt-1">
                                        {data?.[`syn${prefix.slice(-1)}RDCDecisionBy`] ?? '-'}
                                    </div>
                                </div>

                                {data?.[`syn${prefix.slice(-1)}syn1RDC1DecisionFilePath`] && (
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700">RDC Decision File</label>
                                        <div className="mt-1 flex gap-1">
                                            <Button
                                                type="primary"
                                                icon={<EyeOutlined />}
                                                size="small"
                                                onClick={() => handlePreviewPdf(
                                                    data[`syn${prefix.slice(-1)}syn1RDC1DecisionFilePath`],
                                                    'RDC Decision Document'
                                                )}
                                            >
                                                Preview
                                            </Button>
                                            <Button
                                                type="default"
                                                icon={<DownloadOutlined />}
                                                size="small"
                                                onClick={() => window.open(`${baseFileURL}/${data[`syn${prefix.slice(-1)}RDCDecisionFilePath`]}`, '_blank')}
                                            >
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
            </div>
        )
    }

    const tabItems = [
        {
            key: '1',
            label: 'Synopsis 1',
            children: <SynopsisGroup title="Synopsis 1" prefix="synopsis1" data={synopsisData} />,
        },
        {
            key: '2',
            label: 'Synopsis 2 (Resubmission)',
            children: <SynopsisGroup title="Synopsis 2" prefix="synopsis2" data={synopsisData} />,
        },
    ]

    return (
        <div className="h-full bg-gradient-to-br p-2 from-gray-50 to-gray-100 rounded-2xl">
            <div className="p-0 pt-0">
                {/* Back Button */}
                <div className="mb-4">
                    <Button onClick={onBack} type="default">
                        ← Back to List
                    </Button>
                </div>

                {/* Profile Section Header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-t-lg shadow-sm p-2">
                    <h2 className="text-lg font-semibold flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        Scholar Profile
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
                </div>
            </div>

            <Divider />

            {/* Synopsis Section */}
            <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200 mb-4 rounded-t-lg">
                    <h3 className="font-semibold text-slate-800 flex items-center">
                        <div className="w-2 h-2 bg-slate-500 rounded-full mr-2"></div>
                        Synopsis Submissions
                    </h3>
                </div>

                <Tabs items={tabItems} />
            </div>

            {/* VC Office Approval Section */}
            {(() => {
                // Check if Director of Research has approved in workflow (Step 9)
                // Method 1: Check workflow history for Director approval
                const directorLog = workflowHistory.find(log =>
                    (log.stepOrder === 9 || log.stepName?.includes('Director')) &&
                    log.action === 'Approve'
                )

                // Method 2: If workflow instance is at step 10 or higher, Director must have approved
                const directorApproved = directorLog || (workflowInstance?.currentStepOrder >= 10)

                // Check if VC has already approved/rejected in workflow (Step 10)
                const vcLog = workflowHistory.find(log =>
                    (log.stepOrder === 10 || log.stepName?.includes('VC') || log.stepName?.includes('Vice Chancellor')) &&
                    (log.action === 'Approve' || log.action === 'Reject')
                )

                // Debug logging
                console.log('Director Log:', directorLog)
                console.log('Current Step Order:', workflowInstance?.currentStepOrder)
                console.log('Director Approved:', directorApproved)
                console.log('VC Log:', vcLog)

                if (!directorApproved) {
                    // Director hasn't approved yet
                    return (
                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                            <p className="text-yellow-800 font-medium">
                                VC Office approval is pending Director of Research's approval.
                            </p>
                        </div>
                    )
                }

                if (vcLog) {
                    // Show existing VC approval data
                    return (
                        <div className="bg-white rounded-lg shadow-sm p-4 mt-6">
                            <div className="bg-gradient-to-r from-green-100 to-green-50 p-2 border-b border-green-200 mb-3 rounded-t-lg">
                                <h4 className="font-semibold text-green-800">VC Office Approval - Completed</h4>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Decision
                                    </label>
                                    <div className="p-2 bg-slate-50 rounded border">
                                        {vcLog.action === 'Reject' ? (
                                            <Tag color="orange">Sent Back to Office</Tag>
                                        ) : vcLog.action === 'Approve' ? (
                                            <Tag color="green">Approved</Tag>
                                        ) : (
                                            <Tag>Unknown</Tag>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Remark
                                    </label>
                                    <div className="p-2 bg-slate-50 rounded border min-h-[40px]">
                                        {vcLog.comments || '-'}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Action Date
                                    </label>
                                    <div className="p-2 bg-slate-50 rounded border">
                                        {formatDate(vcLog.actionDate)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                } else {
                    // Show VC approval form
                    return (
                        <div className="bg-white rounded-lg shadow-sm p-4 mt-6">
                            <div className="bg-gradient-to-r from-purple-100 to-purple-50 p-2 border-b border-purple-200 mb-3 rounded-t-lg">
                                <h4 className="font-semibold text-purple-800">Vice Chancellor Office Approval</h4>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Remarks Section */}
                                <div className="lg:col-span-2">
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Remark if any
                                    </label>
                                    <AntInput.TextArea
                                        placeholder="Enter remarks for the VC approval..."
                                        rows={3}
                                        className="w-full"
                                        value={vcRemark}
                                        onChange={(e) => setVcRemark(e.target.value)}
                                    />
                                </div>

                                {/* Status and Submit Section */}
                                <div className="space-y-3">
                                    {/* Status Dropdown */}
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 block mb-2">
                                            Status of RDC
                                        </label>
                                        <Select
                                            placeholder="--Select--"
                                            className="w-full"
                                            size="large"
                                            value={vcDecision}
                                            onChange={setVcDecision}
                                            options={[
                                                { value: null, label: '--Select--' },
                                                { value: 0, label: 'Send Back to Office' },
                                                { value: 1, label: 'Approve' }
                                            ]}
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <div className="flex justify-end">
                                        <Button
                                            type="primary"
                                            size="large"
                                            className="bg-blue-600 hover:bg-blue-700 border-blue-600 px-6"
                                            loading={submittingVcApproval}
                                            onClick={handleVcApproval}
                                            disabled={vcDecision === null}
                                        >
                                            Submit
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            })()}
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

export default EditRDCDecision
