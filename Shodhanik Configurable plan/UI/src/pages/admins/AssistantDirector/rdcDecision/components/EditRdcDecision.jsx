import { useEffect, useState, useRef } from 'react'
import { Divider, Button, Spin, Empty, Tabs, Tag, Input as AntInput, Modal, Select, Upload } from 'antd'
import { DownloadOutlined, EyeOutlined, ExportOutlined, CheckOutlined, CloseOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons'
import API from '../../../../../services/API'
import workflowService from '../../../../../services/workflowService'
import notification from '../../../../../services/NotificationService'
import getBaseFileURL from '../../../../../utils/getBaseFileUrl'
import PrintHeader from '@/components/cms/PrintHeader'
import RDCProceedingLetter from '../../rdcProceedings/components/RDCProceedingLetter'
import { useReactToPrint } from 'react-to-print'
import useStaffAuthStore from '@/store/staffAuthStore'

const EditRDCDecision = ({
    selectedRecord,
    onBack,
    canRead,
    canApprove,
    canReject,
    canDownload }) => {
    const { user, initializeAuth } = useStaffAuthStore()
    const [profileData, setProfileData] = useState(null)
    const [synopsisData, setSynopsisData] = useState(null)
    const [workflowHistory, setWorkflowHistory] = useState([])
    const [workflowInstance, setWorkflowInstance] = useState(null)
    const [loading, setLoading] = useState(false)
    
    // Assistant Director Approval states
    const [assistantDirectorRemark, setAssistantDirectorRemark] = useState('')
    const [assistantDirectorDecision, setAssistantDirectorDecision] = useState(null)
    const [submittingApproval, setSubmittingApproval] = useState(false)

    // PDF Preview Modal states
    const [pdfModalVisible, setPdfModalVisible] = useState(false)
    const [currentPdfUrl, setCurrentPdfUrl] = useState('')
    const [currentPdfTitle, setCurrentPdfTitle] = useState('')

    // RDC Letter Modal states
    const [rdcLetterModalVisible, setRdcLetterModalVisible] = useState(false)
    const rdcLetterRef = useRef()

    const notify = notification()
    const baseFileURL = getBaseFileURL()

    // Ensure auth is initialized
    useEffect(() => {
        if (!user) {
            initializeAuth()
        }
    }, [])

    // Move useReactToPrint hook to top level with correct API
    const handlePrintRDCLetter = useReactToPrint({
        contentRef: rdcLetterRef,
        documentTitle: `RDC_Proceeding_Letter_${profileData?.scholarName || 'Scholar'}_${new Date().toISOString().split('T')[0]}`,
    })

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
                <Spin size="large" />
                <span className="ml-2 text-gray-600">Loading scholar details...</span>
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

    const getRDCDecisionTag = (decision) => {
        if (decision === null || decision === undefined) return <Tag>Pending</Tag>
        if (decision === 0) return <Tag>Pending</Tag>
        if (decision === 1) return <Tag color="green">Accept</Tag>
        if (decision === 2) return <Tag color="red">Reject</Tag>
        if (decision === 3) return <Tag color="orange">Revision</Tag>
        if (decision === 4) return <Tag color="purple">Absent</Tag>
        return <Tag>{decision}</Tag>
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


    const handleDownloadRDCLetter = () => {
        setRdcLetterModalVisible(true)
    }

    const handleAssistantDirectorApproval = async () => {
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
            action: assistantDirectorDecision === 0 ? 'Reject' : 'Approve',
            comments: assistantDirectorRemark.trim() || (assistantDirectorDecision === 0 ? 'Sent back to office' : 'Forwarded to Director'),
            UserId: user.roleId,
            workflowName: 'Synopsis'
        }

        console.log('Action request:', actionRequest)

        setSubmittingApproval(true)
        try {
            await workflowService.submitApprovalAction(actionRequest)

            const decisionText = assistantDirectorDecision === 0 ? 'sent back to office' : 'forwarded to Director(DoR)'
            notify.success(`RDC proceeding ${decisionText} successfully`)

            setAssistantDirectorRemark('')
            setAssistantDirectorDecision(null)
            await fetchScholarDetails()
        } catch (error) {
            notify.error('Failed to submit assistant director approval')
            console.error(error)
        } finally {
            setSubmittingApproval(false)
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
                                <label className="text-sm font-semibold text-slate-700">RDC Decision</label>
                                <div className="mt-1">{getDecisionTag(data?.[`${prefix}Decision`])}</div>
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
                {/* 
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

                {/* RDC Meeting Decision Details */}
                {!!(
                    data?.[`syn${prefix.slice(-1)}RDC1DecisionRemark`] ||
                    data?.[`syn${prefix.slice(-1)}RDC1Decision`] ||
                    data?.[`syn${prefix.slice(-1)}RDC1DecisionFilePath`]
                ) && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
                                <h4 className="font-semibold text-slate-800">RDC Meeting Decision</h4>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700">Decision</label>
                                        <div className="mt-1">{getRDCDecisionTag(data?.[`syn${prefix.slice(-1)}RDC1Decision`])}</div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700">Remark</label>
                                        <div className="text-slate-800 mt-1 bg-slate-50 p-2 rounded">
                                            {data?.[`syn${prefix.slice(-1)}RDC1DecisionRemark`] || '-'}
                                        </div>
                                    </div>
                                    {data?.[`syn${prefix.slice(-1)}RDC1DecisionFilePath`] && (
                                        <div>
                                            <label className="text-sm font-semibold text-slate-700">Decision File</label>
                                            <div className="mt-1 flex gap-1">
                                                <Button
                                                    type="primary"
                                                    icon={<EyeOutlined />}
                                                    size="small"
                                                    onClick={() => handlePreviewPdf(
                                                        data[`syn${prefix.slice(-1)}RDC1DecisionFilePath`],
                                                        'RDC Meeting Decision Document'
                                                    )}
                                                >
                                                    Preview
                                                </Button>
                                                <Button
                                                    type="default"
                                                    icon={<DownloadOutlined />}
                                                    size="small"
                                                    onClick={() => window.open(`${baseFileURL}/${data[`syn${prefix.slice(-1)}RDC1DecisionFilePath`]}`, '_blank')}
                                                >
                                                    Download
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
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

            {/* Assistant Director Approval Section */}
            {(() => {
                // Check if Assistant Director has already approved/rejected in workflow
                const assistantDirectorLog = workflowHistory.find(log => 
                    log.stepName === 'Assistant Director Approval' && 
                    (log.action === 'Approve' || log.action === 'Reject')
                )

                if (assistantDirectorLog) {
                    // Show existing approval data
                    return (
                        <div className="bg-white rounded-lg shadow-sm p-4 mt-6">
                            <div className="bg-gradient-to-r from-green-100 to-green-50 p-2 border-b border-green-200 mb-3 rounded-t-lg">
                                <h4 className="font-semibold text-green-800">Assistant Director Approval - Completed</h4>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Decision
                                    </label>
                                    <div className="p-2 bg-slate-50 rounded border">
                                        {assistantDirectorLog.action === 'Reject' ? (
                                            <Tag color="orange">Back to Office</Tag>
                                        ) : assistantDirectorLog.action === 'Approve' ? (
                                            <Tag color="green">Forwarded to Director(DoR)</Tag>
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
                                        {assistantDirectorLog.comments || '-'}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Action Date
                                    </label>
                                    <div className="p-2 bg-slate-50 rounded border">
                                        {formatDate(assistantDirectorLog.actionDate)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                } else {
                    // Show approval form
                    return (
                        <div className="bg-white rounded-lg shadow-sm p-4 mt-6">
                            <div className="bg-gradient-to-r from-purple-100 to-purple-50 p-2 border-b border-purple-200 mb-3 rounded-t-lg">
                                <h4 className="font-semibold text-purple-800">Assistant Director Approval</h4>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Remarks Section */}
                                <div className="lg:col-span-2">
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Remark if any
                                    </label>
                                    <AntInput.TextArea
                                        placeholder="Enter remarks for the assistant director approval..."
                                        rows={3}
                                        className="w-full"
                                        value={assistantDirectorRemark}
                                        onChange={(e) => setAssistantDirectorRemark(e.target.value)}
                                    />
                                </div>

                                {/* Status and Submit Section */}
                                <div className="space-y-3">
                                    {/* Status of RDC Dropdown */}
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 block mb-2">
                                            Status of RDC
                                        </label>
                                        <Select
                                            placeholder="--Select--"
                                            className="w-full"
                                            size="large"
                                            value={assistantDirectorDecision}
                                            onChange={setAssistantDirectorDecision}
                                            options={[
                                                { value: null, label: '--Select--' },
                                                { value: 0, label: 'Back to Office' },
                                                { value: 1, label: 'Forward to Director(DoR)' }
                                            ]}
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <div className="flex justify-end">
                                        <Button
                                            type="primary"
                                            size="large"
                                            className="bg-blue-600 hover:bg-blue-700 border-blue-600 px-6"
                                            loading={submittingApproval}
                                            onClick={handleAssistantDirectorApproval}
                                            disabled={assistantDirectorDecision === null}
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

            {/* RDC Letter Modal */}
            <Modal
                title="RDC Proceeding Letter"
                open={rdcLetterModalVisible}
                onCancel={() => setRdcLetterModalVisible(false)}
                width="90%"
                style={{ top: 20 }}
                footer={[
                    <Button key="close" onClick={() => setRdcLetterModalVisible(false)}>
                        Close
                    </Button>,
                    <Button
                        key="download"
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handlePrintRDCLetter}
                        className="bg-green-600 hover:bg-green-700 border-green-600"
                    >
                        Download PDF
                    </Button>
                ]}
            >
                <div style={{ height: '70vh', overflow: 'auto' }}>
                    <div ref={rdcLetterRef}>
                        <RDCProceedingLetter
                            profileData={profileData}
                            synopsisData={synopsisData}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default EditRDCDecision