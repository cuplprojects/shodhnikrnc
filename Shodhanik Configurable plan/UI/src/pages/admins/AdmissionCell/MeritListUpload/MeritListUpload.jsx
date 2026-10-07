import { useState, useRef, useCallback, useMemo } from 'react'
import { Download, Upload, Loader2, X, Eye, AlertCircle } from 'lucide-react';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import { hasPermission } from '@/services/hasPermissionService';

const MeritListUpload = () => {

    //permissions
    const canRead = hasPermission('merit_list_upload.read')
    if(!canRead){
        return;
    }

    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef(null);

    // Get current session
    const currentSession = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return `${currentYear}-${currentYear + 1}`;
    }, []);

    // Validate Excel/CSV file
    const isValidExcelFile = useCallback((file) => {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') ||
            file.type.includes('spreadsheet') || file.type.includes('excel') || file.type.includes('csv') ||
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.ms-excel' ||
            file.type === 'text/csv';
    }, []);

    // Handle file removal
    const handleFileRemove = useCallback(() => {
        setSelectedFile(null);
        setPreviewData(null);
        setShowPreview(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // Handle file selection
    const handleFileSelect = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!isValidExcelFile(file)) {
            notification().error('Please select a valid file (.xlsx, .xls, or .csv)');
            return;
        }

        setSelectedFile(file);
        setPreviewData(null);
        setShowPreview(false);
    }, [isValidExcelFile]);

    // Read and preview Excel/CSV file
    const handlePreviewFile = useCallback(async () => {
        if (!selectedFile) return;

        setPreviewLoading(true);
        try {
            const fileName = selectedFile.name.toLowerCase();
            let data = [];

            if (fileName.endsWith('.csv')) {
                // Handle CSV files
                const text = await selectedFile.text();
                const lines = text.split('\n').filter(line => line.trim());

                if (lines.length === 0) {
                    throw new Error('CSV file is empty');
                }

                // Parse CSV (simple parsing - assumes comma-separated values)
                data = lines.map(line => {
                    // Simple CSV parsing - handle quoted values
                    const result = [];
                    let current = '';
                    let inQuotes = false;

                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            result.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    result.push(current.trim());
                    return result;
                });
            } else {
                // Handle Excel files
                const arrayBuffer = await selectedFile.arrayBuffer();

                // Import XLSX dynamically
                const XLSX = await import('xlsx');

                const workbook = XLSX.read(arrayBuffer, {
                    type: 'array',
                    cellText: true,
                    cellDates: true
                });

                // Get the first worksheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                if (!worksheet) {
                    throw new Error('No worksheet found in Excel file');
                }

                // Convert worksheet to array of arrays
                data = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: '',
                    raw: false
                });
            }

            if (data.length === 0) {
                throw new Error('File is empty');
            }

            const headers = data[0].map(header => (header || '').toString().trim());
            const rows = data.slice(1)
                .map(row => row.map(cell => (cell || '').toString().trim()))
                .filter(row => row.some(cell => cell && cell.trim())); // Filter empty rows

            setPreviewData({
                headers,
                rows,
                totalRows: rows.length,
                fileName: selectedFile.name
            });
            setShowPreview(true);

        } catch (err) {
            notification().error('Error reading file: ' + err.message);
            console.error('Preview error:', err);
        } finally {
            setPreviewLoading(false);
        }
    }, [selectedFile]);

    // Reset form after successful upload
    const resetUploadForm = useCallback(() => {
        setSelectedFile(null);
        setPreviewData(null);
        setShowPreview(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // Handle merit list upload and auto-process
    const handleUpload = useCallback(async () => {
        if (!selectedFile) {
            notification().warning('Please select a file');
            return;
        }

        setUploadLoading(true);

        try {
            const formData = new FormData();
            formData.append('File', selectedFile);
            formData.append('Session', currentSession);

            // Single API call to upload and process
            const response = await API.post('/MeritListDocs/upload-and-process', formData);

            if (response.data?.success) {
                notification().success(
                    `Merit list uploaded and interview results processed successfully for ${currentSession}`
                );

                // Optionally, show number of processed rows or errors
                const { processedCount, errorCount, errors } = response.data.data || {};
                if (processedCount > 0) {
                    notification().info(`${processedCount} applicants processed.`);
                }
                if (errorCount > 0 && errors?.length) {
                    notification().warning(
                        `There were ${errorCount} errors. Check console for details.`
                    );
                    console.warn('Merit list processing errors:', errors);
                }

                resetUploadForm();
            } else {
                if (response.data?.errors && response.data.errors.length > 0) {
                    response.data.errors.forEach((errMsg) => {
                        notification().error(errMsg);
                    });
                } else {
                    notification().error(response.data?.message || 'Upload and processing failed');
                }
            }
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors && errors.length > 0) {
                errors.forEach((errMsg) => notification().error(errMsg));
            } else {
                notification().error(
                    err.response?.data?.message || err.message || 'Failed to upload and process merit list'
                );
            }
            console.error('Upload and process error:', err.response?.data || err);
        } finally {
            setUploadLoading(false);
        }
    }, [selectedFile, currentSession, resetUploadForm]);

    // Handle template download
    const handleDownloadTemplate = useCallback(async () => {
        setTemplateLoading(true);

        try {
            const response = await API.get(`/MeritListDocs/template-download/${currentSession}`, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Extract filename from response headers or use default
            let filename = `Merit_List_Template_${currentSession}.xlsx`;
            const contentDisposition = response.headers['content-disposition'];

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch?.[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }

            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            notification().success(`Template downloaded for ${currentSession}`);

        } catch (err) {
            notification().error(err.response?.data?.message || err.message || 'Failed to download template');
        } finally {
            setTemplateLoading(false);
        }
    }, [currentSession]);

    return (
        <div className="max-w-3xl mx-auto p-3">
            {/* Compact Header */}
            <div className="mb-3">
                <h1 className="text-lg font-semibold text-gray-800 mb-1">Merit List Upload</h1>
                <p className="text-xs text-gray-600">Session: {currentSession}</p>
            </div>

            {/* File Upload Section */}
            <div className="max-w-xl mx-auto">
                <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="text-center mb-4">
                        <h2 className="text-base font-semibold text-gray-900 mb-1">File Upload</h2>
                    </div>

                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mb-4 hover:border-gray-400 transition-colors">
                        <div className="flex flex-col items-center">
                            <div className="p-2 bg-gray-100 rounded-full mb-2">
                                <Upload className="text-gray-600" size={20} />
                            </div>

                            {!selectedFile ? (
                                <>
                                    <p className="text-sm text-gray-600 mb-2">Click or drag file to this area to upload</p>
                                    <p className="text-xs text-gray-500 mb-3">Formats accepted are .csv and .xlsx</p>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label
                                        htmlFor="file-upload"
                                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
                                    >
                                        Choose File
                                    </label>

                                    <div className="mt-3">
                                        <p className="text-xs text-gray-600 mb-2">If you do not have a file you can use the sample below:</p>
                                        <button
                                            onClick={handleDownloadTemplate}
                                            disabled={templateLoading}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                        >
                                            {templateLoading ? (
                                                <Loader2 className="animate-spin" size={12} />
                                            ) : (
                                                <Download size={12} />
                                            )}
                                            {templateLoading ? 'Downloading...' : 'Download Sample Template'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full">
                                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md mb-3">
                                        <span className="text-xs text-gray-700 truncate flex-1">
                                            {selectedFile.name}
                                        </span>
                                        <button
                                            onClick={handleFileRemove}
                                            className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                            title="Remove file"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    {/* Preview Button */}
                                    <button
                                        onClick={handlePreviewFile}
                                        disabled={previewLoading}
                                        className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer transition-colors mb-2"
                                    >
                                        {previewLoading ? (
                                            <Loader2 className="animate-spin" size={10} />
                                        ) : (
                                            <Eye size={10} />
                                        )}
                                        {previewLoading ? 'Loading...' : 'Preview'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => {
                                setSelectedFile(null);
                                setPreviewData(null);
                                setShowPreview(false);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }}
                            className="px-4 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || uploadLoading}
                            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                            {uploadLoading ? (
                                <>
                                    <Loader2 className="animate-spin inline mr-1" size={12} />
                                    Processing...
                                </>
                            ) : (
                                'Continue'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* File Preview Section */}
            {showPreview && previewData && (
                <div className="mt-4 bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-100 rounded-md">
                                <Eye className="text-blue-600" size={14} />
                            </div>
                            <div>
                                <h2 className="text-sm font-medium text-gray-900">File Preview</h2>
                                <p className="text-xs text-gray-600">
                                    {previewData.fileName} • {previewData.totalRows} rows • {previewData.headers.length} columns
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Close preview"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Data validation info */}
                    {previewData.totalRows === 0 && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center">
                            <AlertCircle className="h-3 w-3 text-red-600 mr-2 flex-shrink-0" />
                            <span className="text-xs text-red-700">No data rows found in the file</span>
                        </div>
                    )}

                    {previewData.totalRows > 0 && (
                        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                            <span className="text-xs text-green-700">
                                ✅ Data looks good! Found {previewData.totalRows} records ready for upload.
                            </span>
                        </div>
                    )}

                    {/* Data Table */}
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        #
                                    </th>
                                    {previewData.headers.map((header, index) => (
                                        <th key={index} className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                            {header || `Column ${index + 1}`}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {previewData.rows.slice(0, 10).map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-gray-50">
                                        <td className="px-2 py-1.5 text-gray-500 border-r">
                                            {rowIndex + 1}
                                        </td>
                                        {previewData.headers.map((_, colIndex) => (
                                            <td key={colIndex} className="px-2 py-1.5 text-gray-900">
                                                {row[colIndex] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Show more rows indicator */}
                    {previewData.totalRows > 10 && (
                        <div className="mt-2 text-center">
                            <p className="text-xs text-gray-500">
                                Showing first 10 rows of {previewData.totalRows} total rows
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default MeritListUpload