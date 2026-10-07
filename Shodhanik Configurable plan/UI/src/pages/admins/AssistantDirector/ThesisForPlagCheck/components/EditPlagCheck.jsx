import { useState, useEffect } from 'react'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import getBaseFileURL from '@/utils/getBaseFileUrl'
import PrintHeader from '@/components/cms/PrintHeader'
import { Button, Spin, Empty, Input as AntInput, Upload } from 'antd'
import { EyeOutlined, DownloadOutlined, UploadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useFileViewer } from '@/services/FileViewerService'

const EditPlagCheck = ({
    selectedRecord,
    onBack,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canApprove,
    canReject,
    canDownload,
    canUpload,
    canMarkPending
}) => {

    //states
    const [loading, setLoading] = useState(false)
    const [profileData, setProfileData] = useState(null)
    const [thesisData, setThesisData] = useState(null)
    const [plagStatus, setPlagStatus] = useState(null)

    // Plagiarism Check states
    const [plagRemarks, setPlagRemarks] = useState('')
    const [plagReportFile, setPlagReportFile] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    const notify = notification()
    const baseFileURL = getBaseFileURL()
    const { FileViewerModal, openFile } = useFileViewer()

    useEffect(() => {
        fetchScholarDetails()
    }, [selectedRecord])

    const fetchScholarDetails = async () => {
        setLoading(true)
        try {
            const [profileRes, thesisRes, plagStatusRes] = await Promise.all([
                API.get(`/Scholars/Profile/${selectedRecord.sid}`),
                API.get(`/Thesis/Thesis-Evaluation-Dcument?sid=${selectedRecord.sid}`),
                API.get(`/Thesis/plagiarism-status/${selectedRecord.sid}`)
            ])

            if (profileRes.data) {
                setProfileData(profileRes.data)
            }
            if (thesisRes.data) {
                setThesisData(thesisRes.data)
            }
            if (plagStatusRes.data) {
                setPlagStatus(plagStatusRes.data)
            }
        } catch (error) {
            console.error(error)
            // notify.error('Failed to fetch scholar details')
        } finally {
            setLoading(false)
        }
    }

    const handlePreviewPdf = (filePath, title) => {
        if (!filePath) {
            notify.error('No file available for preview')
            return
        }
        const fullUrl = `${baseFileURL}/${filePath}`
        openFile(fullUrl, title)
    }

    const handlePlagiarismDecision = async (status) => {
        // Validate required fields
        if (status === 5 && !plagRemarks.trim()) {
            notify.error('Remarks are required for rejection')
            return
        }

        const formData = new FormData()
        formData.append('plagCheck', status)

        if (plagRemarks.trim()) {
            formData.append('plagRemarks', plagRemarks.trim())
        }

        if (plagReportFile) {
            formData.append('plagReportFile', plagReportFile)
        }

        setSubmitting(true)
        try {
            await API.patch(`/Thesis/upload/${selectedRecord.sid}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            const statusText = status === 4 ? 'approved' : status === 5 ? 'rejected' : 'marked as pending'
            notify.success(`Plagiarism check ${statusText} successfully`)

            // Reset form
            setPlagRemarks('')
            setPlagReportFile(null)

            // Refresh plagiarism status
            await fetchScholarDetails()
        } catch (error) {
            notify.error('Failed to submit plagiarism decision')
            console.error(error)
        } finally {
            setSubmitting(false)
        }
    }

    const uploadProps = {
        beforeUpload: (file) => {
            setPlagReportFile(file)
            return false // Prevent automatic upload
        },
        onRemove: () => {
            setPlagReportFile(null)
        },
        fileList: plagReportFile ? [plagReportFile] : [],
        accept: '.pdf,.doc,.docx',
        maxCount: 1,
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Spin size="large" tip="Loading scholar details..." />
            </div>
        )
    }

    return (
        <div className="h-full bg-gray-50 p-1 sm:p-2">
            {/* Back Button */}
            <div className="mb-2">
                <Button onClick={onBack} type="default" size="small">
                    ← Back to List
                </Button>
            </div>

            {/* Profile Section */}
            <div className="bg-white rounded-lg shadow-sm mb-3">
                <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-t-lg p-2">
                    <h2 className="text-sm sm:text-base font-semibold">Scholar Profile</h2>
                </div>

                <div className="p-2 sm:p-4">
                    {/* University Header - Hidden on mobile */}
                    <div className="hidden sm:flex justify-center mb-3">
                        <PrintHeader />
                    </div>

                    {/* Profile Content */}
                    <div className="border border-slate-200 rounded overflow-hidden">
                        <div className="bg-slate-50 p-1 sm:p-2 border-b">
                            <h3 className="text-sm font-semibold text-slate-800">Basic Details</h3>
                        </div>

                        <div className="flex flex-col lg:flex-row">
                            {/* Profile Details */}
                            <div className="flex-1">
                                {/* Mobile Cards */}
                                <div className="block lg:hidden p-2 space-y-2">
                                    <div className="grid grid-cols-1 gap-2 text-xs">
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="font-medium text-slate-600">Admission:</span>
                                            <span>{profileData?.admissionYear || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="font-medium text-slate-600">Subject:</span>
                                            <span className="text-right">{profileData?.subject || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="font-medium text-slate-600">Supervisor:</span>
                                            <span className="text-right">
                                                {profileData?.supervisor1Name || 'N/A'}
                                                {profileData?.supervisor2Name && `, ${profileData.supervisor2Name}`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="font-medium text-slate-600">Scholar:</span>
                                            <span className="text-right">{profileData?.scholarName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="font-medium text-slate-600">Mobile:</span>
                                            <span>{profileData?.mobileNo || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="font-medium text-slate-600">Email:</span>
                                            <span className="text-right text-xs">{profileData?.emailID || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden lg:block">
                                    <table className="w-full text-sm">
                                        <tbody>
                                            <tr className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r w-1/3 text-slate-700">
                                                    Admission Session:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.admissionYear || 'N/A'}
                                                </td>
                                            </tr>
                                            <tr className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r text-slate-700">
                                                    Department/Subject:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.subject || 'N/A'}
                                                </td>
                                            </tr>
                                            <tr className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r text-slate-700">
                                                    Supervisor Name:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.supervisor1Name || 'N/A'}
                                                    {profileData?.supervisor2Name && `, ${profileData.supervisor2Name}`}
                                                </td>
                                            </tr>
                                            <tr className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r text-slate-700">
                                                    Scholar Name:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.scholarName || 'N/A'}
                                                </td>
                                            </tr>
                                            <tr className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r text-slate-700">
                                                    Mobile No.:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.mobileNo || 'N/A'}
                                                </td>
                                            </tr>
                                            <tr className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r text-slate-700">
                                                    Email ID:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.emailID || 'N/A'}
                                                </td>
                                            </tr>
                                            <tr className="border-b hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r text-slate-700">
                                                    Correspondence Address:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.correspondanceAddress || 'N/A'}
                                                </td>
                                            </tr>
                                            <tr className="hover:bg-slate-50/50">
                                                <td className="p-2 bg-slate-50 font-medium border-r text-slate-700">
                                                    Permanent Address:
                                                </td>
                                                <td className="p-2 text-slate-800">
                                                    {profileData?.permanentAddress || 'N/A'}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Profile Picture - Desktop only */}
                            <div className="hidden lg:flex w-28 border-l flex-col items-center p-2 bg-slate-50/30">
                                <div className="mb-1">
                                    <div className="p-1 bg-slate-100 text-slate-700 text-center text-xs">
                                        Shodhanik ID: <span className="font-normal">{profileData?.shodhanikID || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="w-20 h-24 border mb-1 flex items-center justify-center bg-white rounded overflow-hidden">
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
                                        className="text-xs text-slate-500 text-center p-1"
                                        style={{ display: profileData?.profilePicture ? 'none' : 'block' }}
                                    >
                                        NOT AVAILABLE
                                    </div>
                                </div>
                                <div className="text-xs text-center text-slate-600">Profile Picture</div>
                                {profileData?.signature && (
                                    <div className="mt-2">
                                        <img
                                            src={`${baseFileURL}/${profileData.signature}`}
                                            alt="Signature"
                                            className="max-w-20 max-h-12 rounded bg-white"
                                            onError={(e) => e.target.style.display = 'none'}
                                        />
                                        <div className="text-xs text-slate-600 text-center">Digital Signature</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Thesis Documents Section */}
            {thesisData && (
                <div className="bg-white rounded-lg shadow-sm mb-3">
                    <div className="bg-slate-100 p-2 border-b">
                        <h3 className="text-sm font-semibold text-slate-800">Thesis Evaluation Documents</h3>
                    </div>

                    <div className="p-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                            {/* Synopsis File */}
                            {thesisData.SynopsisFilePath && (
                                <div className="border rounded p-2">
                                    <h4 className="text-xs font-medium text-slate-700 mb-2 flex items-center">
                                        <div className="w-1 h-1 bg-blue-500 rounded-full mr-1"></div>
                                        Synopsis File
                                    </h4>
                                    <div className="flex gap-1">
                                        <Button
                                            type="primary"
                                            icon={<EyeOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => handlePreviewPdf(thesisData.SynopsisFilePath, 'Synopsis Document')}
                                        >
                                            {/* <span className="hidden md:inline">Preview</span> */}
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => window.open(`${baseFileURL}/${thesisData.SynopsisFilePath}`, '_blank')}
                                        >
                                            {/* <span className="hidden md:inline">Download</span> */}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Thesis File */}
                            {thesisData.ThesisFile && (
                                <div className="border rounded p-2">
                                    <h4 className="text-xs font-medium text-slate-700 mb-2 flex items-center">
                                        <div className="w-1 h-1 bg-green-500 rounded-full mr-1"></div>
                                        Thesis File
                                    </h4>
                                    <div className="flex gap-1">
                                        <Button
                                            type="primary"
                                            icon={<EyeOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => handlePreviewPdf(thesisData.ThesisFile, 'Thesis Document')}
                                        >
                                            {/* <span className="hidden md:inline">Preview</span> */}
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => window.open(`${baseFileURL}/${thesisData.ThesisFile}`, '_blank')}
                                        >
                                            {/* <span className="hidden md:inline">Download</span> */}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Thesis Summary File */}
                            {thesisData.ThesisSummaryFile && (
                                <div className="border rounded p-2">
                                    <h4 className="text-xs font-medium text-slate-700 mb-2 flex items-center">
                                        <div className="w-1 h-1 bg-purple-500 rounded-full mr-1"></div>
                                        <span className="hidden sm:inline">Thesis Summary File</span>
                                        <span className="sm:hidden">Summary</span>
                                    </h4>
                                    <div className="flex gap-1">
                                        <Button
                                            type="primary"
                                            icon={<EyeOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => handlePreviewPdf(thesisData.ThesisSummaryFile, 'Thesis Summary Document')}
                                        >
                                            {/* <span className="hidden md:inline">Preview</span> */}
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => window.open(`${baseFileURL}/${thesisData.ThesisSummaryFile}`, '_blank')}
                                        >
                                            {/* <span className="hidden md:inline">Download</span> */}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Research Paper 1 */}
                            {thesisData.ResearchPaper1 && (
                                <div className="border rounded p-2">
                                    <h4 className="text-xs font-medium text-slate-700 mb-2 flex items-center">
                                        <div className="w-1 h-1 bg-orange-500 rounded-full mr-1"></div>
                                        <span className="hidden sm:inline">Research Paper 1</span>
                                        <span className="sm:hidden">Paper 1</span>
                                    </h4>
                                    <div className="flex gap-1">
                                        <Button
                                            type="primary"
                                            icon={<EyeOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => handlePreviewPdf(thesisData.ResearchPaper1, 'Research Paper 1')}
                                        >
                                            {/* <span className="hidden md:inline">Preview</span> */}
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => window.open(`${baseFileURL}/${thesisData.ResearchPaper1}`, '_blank')}
                                        >
                                            {/* <span className="hidden md:inline">Download</span> */}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Research Paper 2 */}
                            {thesisData.ResearchPaper2 && (
                                <div className="border rounded p-2">
                                    <h4 className="text-xs font-medium text-slate-700 mb-2 flex items-center">
                                        <div className="w-1 h-1 bg-red-500 rounded-full mr-1"></div>
                                        <span className="hidden sm:inline">Research Paper 2</span>
                                        <span className="sm:hidden">Paper 2</span>
                                    </h4>
                                    <div className="flex gap-1">
                                        <Button
                                            type="primary"
                                            icon={<EyeOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => handlePreviewPdf(thesisData.ResearchPaper2, 'Research Paper 2')}
                                        >
                                            {/* <span className="hidden md:inline">Preview</span> */}
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => window.open(`${baseFileURL}/${thesisData.ResearchPaper2}`, '_blank')}
                                        >
                                            {/* <span className="hidden md:inline">Download</span> */}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Conference 1 */}
                            {thesisData.Conference1 && (
                                <div className="border rounded p-2">
                                    <h4 className="text-xs font-medium text-slate-700 mb-2 flex items-center">
                                        <div className="w-1 h-1 bg-teal-500 rounded-full mr-1"></div>
                                        <span className="hidden sm:inline">Conference Paper 1</span>
                                        <span className="sm:hidden">Conference</span>
                                    </h4>
                                    <div className="flex gap-1">
                                        <Button
                                            type="primary"
                                            icon={<EyeOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => handlePreviewPdf(thesisData.Conference1, 'Conference Paper 1')}
                                        >
                                            {/* <span className="hidden md:inline">Preview</span> */}
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => window.open(`${baseFileURL}/${thesisData.Conference1}`, '_blank')}
                                        >
                                            {/* <span className="hidden md:inline">Download</span> */}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* No Documents Message */}
                        {!thesisData.SynopsisFilePath && !thesisData.ThesisFile && !thesisData.ThesisSummaryFile &&
                            !thesisData.ResearchPaper1 && !thesisData.ResearchPaper2 && !thesisData.Conference1 && (
                                <div className="text-center py-4">
                                    <Empty description="No thesis documents available" />
                                </div>
                            )}
                    </div>
                </div>
            )}

            {/* Plagiarism Check Decision Section */}
            {plagStatus?.plagCheck === 4 ? (
                // Show compact completion message if already approved
                <div className="bg-white rounded-lg shadow-sm">
                    <div className="bg-green-50 p-2 border-b">
                        <h4 className="text-sm font-semibold text-green-800">Plagiarism Check Status</h4>
                    </div>
                    <div className="p-3">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckOutlined className="text-sm text-green-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-green-800">
                                    Thesis for Plagiarism Check is Completed
                                </h3>
                                <p className="text-xs text-slate-600">
                                    Status: <span className="font-medium text-green-600">{plagStatus.plagCheckName}</span>
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs">
                            {plagStatus.plagRemarks && (
                                <div className="bg-slate-50 p-2 rounded">
                                    <span className="font-medium text-slate-700">Remarks:</span>
                                    <p className="text-slate-800 mt-1">{plagStatus.plagRemarks}</p>
                                </div>
                            )}

                            {plagStatus.plagReportFile && (
                                <div className="bg-slate-50 p-2 rounded">
                                    <span className="font-medium text-slate-700 block mb-1">Plagiarism Report:</span>
                                    <div className="flex gap-1">
                                        <Button
                                            type="primary"
                                            icon={<EyeOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => handlePreviewPdf(plagStatus.plagReportFile, 'Plagiarism Report')}
                                        >
                                            {/* <span className="hidden sm:inline">View</span> */}
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            className="text-xs flex-1"
                                            onClick={() => window.open(`${baseFileURL}/${plagStatus.plagReportFile}`, '_blank')}
                                        >
                                            {/* <span className="hidden sm:inline">Download</span> */}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-slate-500 mt-2 text-center">
                            Verified on: {new Date(plagStatus.plagVerifiedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                // Show form if not approved yet
                <div className="bg-white rounded-lg shadow-sm">
                    <div className="bg-blue-50 p-2 border-b">
                        <h4 className="text-sm font-semibold text-blue-800">Plagiarism Check Decision</h4>
                    </div>

                    <div className="p-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* Remarks */}
                            {(canApprove || canReject) && 
                            <div>
                                <label className="text-xs font-medium text-slate-700 block mb-1">
                                    Remarks if any
                                </label>
                                <AntInput.TextArea
                                    placeholder="Enter remarks..."
                                    rows={4}
                                    className="text-xs"
                                    value={plagRemarks}
                                    onChange={(e) => setPlagRemarks(e.target.value)}
                                />
                            </div>
                            }

                            {/* File Upload */}
                            {(canApprove && canUpload) && 
                            <div>
                                <label className="text-xs font-medium text-slate-700 block mb-1">
                                    Upload Certificate
                                </label>
                                <Upload {...uploadProps}>
                                    <Button icon={<UploadOutlined />} size="small" className="w-full text-xs">
                                        Choose File
                                    </Button>
                                </Upload>
                                <div className="text-xs text-slate-500 mt-1">
                                    PDF, DOC, DOCX
                                </div>
                            </div>
                            }
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-3 pt-2 border-t">
                            {canMarkPending &&
                                <Button
                                    size="small"
                                    className="text-xs"
                                    loading={submitting}
                                    onClick={() => handlePlagiarismDecision(3)}
                                >
                                    Mark as Pending
                                </Button>
                            }
                            {canReject &&
                                <Button
                                    danger
                                    icon={<CloseOutlined />}
                                    size="small"
                                    className="text-xs"
                                    loading={submitting}
                                    onClick={() => handlePlagiarismDecision(5)}
                                >
                                    Reject to Re-Upload
                                </Button>
                            }
                            {(canUpload || canApprove) &&
                                <Button
                                    type="primary"
                                    icon={<CheckOutlined />}
                                    size="small"
                                    className="text-xs"
                                    loading={submitting}
                                    onClick={() => handlePlagiarismDecision(4)}
                                >
                                    Upload & Send to DoR Office
                                </Button>
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Preview Modal */}
            {FileViewerModal}
        </div>
    )
}

export default EditPlagCheck