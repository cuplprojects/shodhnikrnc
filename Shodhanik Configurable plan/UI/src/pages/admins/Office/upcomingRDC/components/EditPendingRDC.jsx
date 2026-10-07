import { useEffect, useState, useCallback } from 'react'
import { Button, Spin, Empty, Tabs, Tag, Modal, Input as AntInput } from 'antd'
import { DownloadOutlined, EyeOutlined, ExportOutlined } from '@ant-design/icons'
import API from '../../../../../services/API'
import notification from '../../../../../services/NotificationService'
import getBaseFileURL from '../../../../../utils/getBaseFileUrl'
import PrintHeader from '@/components/cms/PrintHeader';
import { hasPermission } from '@/services/hasPermissionService';
import useStaffAuthStore from '@/store/staffAuthStore';


const EditPendingRDC = ({ scholar }) => {
    const sid = scholar?.sid || scholar?.SID;
    const instanceId = scholar?.instanceID || scholar?.instanceId || scholar?.InstanceID;
    const { user } = useStaffAuthStore();
    
    const [profileData, setProfileData] = useState(null)
    const [synopsisData, setSynopsisData] = useState(null)
    const [loading, setLoading] = useState(false)

    // RDC Proceeding Upload states
    const [rdcProceedingRemark, setRdcProceedingRemark] = useState('')
    const [rdcProceedingFile, setRdcProceedingFile] = useState(null)
    const [uploadingProceeding, setUploadingProceeding] = useState(false)

    // PDF Preview Modal states
    const [pdfModalVisible, setPdfModalVisible] = useState(false)
    const [currentPdfUrl, setCurrentPdfUrl] = useState('')
    const [currentPdfTitle, setCurrentPdfTitle] = useState('')

    const notify = notification()
    const baseFileURL = getBaseFileURL()
    const canview = hasPermission('upcoming_rdc.read')
    const candownload = hasPermission('upcoming_rdc.download')
    const canupdate = hasPermission('upcoming_rdc.update')
    const canupload = hasPermission('upcoming_rdc.upload')
    const fetchScholarDetails = useCallback(async () => {
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
            // notify.error('Failed to fetch details')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [sid])

    useEffect(() => {
        if (sid) {
            fetchScholarDetails()
        }
    }, [sid, fetchScholarDetails])

    if (!sid) {
        return <Empty description="Select a scholar to view details" />
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Spin size="large" tip="Loading scholar details...">
                    <div className="p-10" />
                </Spin>
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
        if (decision === 3) return <Tag color="orange">Re-submission Allowed</Tag>
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

    const handleUploadRDCProceeding = async () => {
        if (!rdcProceedingFile && !rdcProceedingRemark.trim()) {
            notify.error('Please provide either a file or remarks')
            return
        }

        if (!instanceId) {
            notify.error('Workflow Instance ID not found')
            return
        }

        const formData = new FormData()
        formData.append('InstanceId', instanceId)
        formData.append('Action', 'Approve')
        formData.append('RoleId', user?.roleId || 0)
        
        if (rdcProceedingFile) {
            formData.append('File', rdcProceedingFile)
        }

        if (rdcProceedingRemark.trim()) {
            formData.append('Comments', rdcProceedingRemark.trim())
        }

        setUploadingProceeding(true)
        try {
            await API.post('/SynopsisRDC/process-workflow-step', formData)
            notify.success('RDC proceeding uploaded and workflow processed successfully')
            setRdcProceedingRemark('')
            setRdcProceedingFile(null)
            // Reset file input
            const fileInput = document.getElementById('rdcFile')
            if (fileInput) fileInput.value = ''
            await fetchScholarDetails()
        } catch (error) {
            notify.error('Failed to process workflow step')
            console.error(error)
        } finally {
            setUploadingProceeding(false)
        }
    }

    const handleFileChange = (event) => {
        const file = event.target.files[0]
        setRdcProceedingFile(file)
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

    const SynopsisGroup = ({ prefix, data }) => {
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
                                        {canview && (
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
                                            {canview && (
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
                    )}


                {/* RDC Decision Details */}
                {(data?.[`syn${prefix.slice(-1)}RDC1Decision`] ||
                    data?.[`syn${prefix.slice(-1)}RDC1DecisionRemark`]) && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-2 border-b border-slate-200">
                                <h4 className="font-semibold text-slate-800">RDC Final Decision</h4>
                            </div>
                            <div className="p-4 space-y-3">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Decision</label>
                                    <div className="mt-1">
                                        {getDecisionTag(data?.[`syn${prefix.slice(-1)}RDC1Decision`])}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700">Remark</label>
                                    <div className="text-slate-800 mt-1 bg-slate-50 p-2 rounded">
                                        {data?.[`syn${prefix.slice(-1)}RDC1DecisionRemark`] || '-'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700">Submit Time</label>
                                        <div className="text-slate-800 mt-1">
                                            {formatDate(data?.[`syn${prefix.slice(-1)}RDC1SubmitTime`])}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700">By</label>
                                        <div className="text-slate-800 mt-1">
                                            {data?.[`syn${prefix.slice(-1)}RDC1BY`] || '-'}
                                        </div>
                                    </div>
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
            children: <SynopsisGroup prefix="synopsis1" data={synopsisData} />,
        },
        {
            key: '2',
            label: 'Synopsis 2 (Resubmission)',
            children: <SynopsisGroup prefix="synopsis2" data={synopsisData} />,
        },
    ]

    return (
        <div className="h-full bg-gradient-to-br p-2 from-gray-50 to-gray-100 rounded-2xl">
            <div className="p-0 pt-0">
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

            {/* Upload RDC Proceeding Section */}
            {!synopsisData?.syn1RDC1Decision &&
                !synopsisData?.syn1RDC1DecisionRemark && (
                    <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                        <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-3 border-b border-slate-200 mb-4 rounded-t-lg">
                            <h4 className="font-semibold text-slate-800">Upload RDC Proceeding</h4>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Remarks Section */}
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        Remarks if Any
                                    </label>
                                    <div className="relative">
                                        <AntInput.TextArea
                                            placeholder="Enter remarks..."
                                            rows={4}
                                            className="w-full"
                                            value={rdcProceedingRemark}
                                            onChange={(e) => setRdcProceedingRemark(e.target.value)}
                                        />
                                        <div className="absolute bottom-2 right-2 flex gap-1">
                                            <Button
                                                type="text"
                                                size="small"
                                                className="text-green-600"
                                                onClick={() => setRdcProceedingRemark('')}
                                                title="Clear"
                                            >
                                                ✓
                                            </Button>
                                            <Button
                                                type="text"
                                                size="small"
                                                className="text-blue-600"
                                                onClick={() => setRdcProceedingRemark('')}
                                                title="Reset"
                                            >
                                                ⟲
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Attachment Section */}

                                <div>
                                    {canupload ? (
                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 block mb-2">
                                                Attachment
                                            </label>
                                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                                                <input
                                                    type="file"
                                                    id="rdcFile"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                    accept=".pdf,.doc,.docx"
                                                />
                                                <label
                                                    htmlFor="rdcFile"
                                                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                                                >
                                                    Choose File
                                                </label>
                                                <span className="ml-3 text-slate-500">
                                                    {rdcProceedingFile ? rdcProceedingFile.name : 'No file chosen'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : null}


                                    {/* Update Button */}
                                    <div className="mt-4 flex justify-end">
                                        {canupdate && (
                                            <Button
                                                type="primary"
                                                size="large"
                                                className="bg-green-600 hover:bg-green-700 border-green-600 px-8"
                                                loading={uploadingProceeding}
                                                onClick={handleUploadRDCProceeding}
                                                disabled={!rdcProceedingFile && !rdcProceedingRemark.trim()}
                                            >
                                                Update RDC Proceeding
                                            </Button>
                                        )}

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

export default EditPendingRDC