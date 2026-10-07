import { useState, useEffect, useMemo } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

import TableService from '@/services/TableService';

const Download = () => {
    const [allDownloads, setAllDownloads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Download file function using getBaseFileURL directly
    const downloadFile = async (filePath, filename) => {
        if (!filePath) {
            console.error('No file path provided');
            return false;
        }

        try {
            // Use the proper base URL for files - same pattern as AboutusSettings
            const baseURL = getBaseFileURL();
            const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
            const downloadUrl = `${baseURL}${cleanPath}`;
            
            console.log('Attempting to download from:', downloadUrl);

            // Create direct download link
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename || filePath.split('/').pop() || 'download';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            // Add to DOM temporarily
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return true;

        } catch (error) {
            console.error('Error downloading file:', error);
            
            // Final fallback: open in new window with proper URL
            const baseURL = getBaseFileURL();
            const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
            const fallbackUrl = `${baseURL}${cleanPath}`;
            
            // Open in new tab as last resort
            const newWindow = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            if (!newWindow) {
                alert('Please allow popups for this site to download files, or try right-clicking the download button and selecting "Save link as..."');
                return false;
            }
            
            return true;
        }
    };

    // Fetch all news announcements from API
    const fetchDownloads = async () => {
        try {
            setLoading(true);
            setError(null);

            let downloads = [];

            try {
                // Try to fetch all announcements first (if endpoint exists)
                const response = await API.get('/NewsAnnouncements');
                if (response.data.success && Array.isArray(response.data.data)) {
                    downloads = response.data.data.filter(item => item.isActive);
                } else if (response.data.success && response.data.data) {
                    downloads = [response.data.data].filter(item => item.isActive);
                }
            } catch (getAllError) {
                console.log('GET all endpoint not available, trying range fetch...');
                // Fallback: fetch multiple announcements by ID range
                const promises = [];
                for (let id = 1; id <= 100; id++) {
                    promises.push(
                        API.get(`/NewsAnnouncements/${id}`)
                            .then(response => {
                                if (response.data.success && response.data.data && response.data.data.isActive) {
                                    return response.data.data;
                                }
                                return null;
                            })
                            .catch(() => null)
                    );
                }
                const results = await Promise.all(promises);
                downloads = results.filter(item => item !== null);
            }

            // Sort by date, newest first
            downloads.sort((a, b) => new Date(b.date) - new Date(a.date));
            setAllDownloads(downloads);
        } catch (err) {
            setError('Failed to fetch downloads. Please try again later.');
            console.error('Error fetching downloads:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data on component mount
    useEffect(() => {
        fetchDownloads();
    }, []);

    // Helper function to format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            // Check if the date is valid
            if (isNaN(date.getTime())) {
                console.warn('Invalid date string:', dateString);
                return dateString; // Return original string if parsing fails
            }
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error, 'Original value:', dateString);
            return dateString; // Return original string instead of "Invalid Date"
        }
    };

    // Helper function to determine category based on title or other criteria
    const getCategoryFromTitle = (title, category) => {
        const titleLower = title.toLowerCase();
        const categoryLower = category.toLowerCase();

        if (titleLower.includes('scholar') || titleLower.includes('phd') || titleLower.includes('student')) {
            return 'scholars';
        } else if (titleLower.includes('supervisor') || titleLower.includes('faculty') || titleLower.includes('principal')) {
            return 'supervisors';
        } else if (categoryLower.includes('scholar')) {
            return 'scholars';
        } else if (categoryLower.includes('supervisor') || categoryLower.includes('faculty')) {
            return 'supervisors';
        }
        return 'all';
    };

    // Get all active downloads
    const getFilteredDownloads = () => {
        if (!allDownloads.length) return [];

        return allDownloads
            .filter(download => download.isActive) // Only show active downloads
            .map(download => ({
                ...download,
                category: getCategoryFromTitle(download.title, download.category)
            }));
    };

    const filteredDownloads = getFilteredDownloads();

    // Handle download click
    const handleDownload = async (filePath, title) => {
        const success = await downloadFile(filePath, title);
        if (!success) {
            console.error('Failed to download file:', filePath);
        }
    };

    // Define table columns for TableService
    const columns = useMemo(() => [
        {
            id: 'srNo',
            header: 'Sr. No.',
            accessorFn: (row, index) => index + 1,
            cell: ({ getValue }) => (
                <div className="text-center font-medium text-[#003366]">
                    {getValue()}
                </div>
            ),
            enableSorting: false,
            enableColumnFilter: false,
            size: 70,
        },
        {
            id: 'title',
            header: 'Title of Downloads',
            accessorKey: 'title',
            cell: ({ getValue }) => (
                <div className="text-[#003366]">
                    {getValue()}
                </div>
            ),
            minSize: 300,
        },
        {
            id: 'date',
            header: 'Date',
            accessorKey: 'date',
            cell: ({ getValue }) => (
                <div className="text-[#003366]">
                    {formatDate(getValue())}
                </div>
            ),
            size: 110,
        },
        {
            id: 'language',
            header: 'Language',
            accessorKey: 'language',
            cell: ({ getValue }) => (
                <div className="text-[#003366]">
                    {getValue()}
                </div>
            ),
            size: 120,
        },
        {
            id: 'fileInfo',
            header: 'File Type & Size',
            accessorFn: (row) => `${row.format} / ${row.size}`,
            cell: ({ getValue }) => (
                <div className="text-[#003366]">
                    {getValue()}
                </div>
            ),
            size: 130,
        },
        {
            id: 'download',
            header: 'Download',
            accessorFn: (row) => row.filePath,
            cell: ({ row }) => (
                <div className="text-center">
                    <button
                        onClick={() => handleDownload(row.original.filePath, row.original.title)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-[#003366] text-white text-xs rounded hover:bg-[#004080] transition-colors duration-150"
                        disabled={!row.original.filePath}
                        title={!row.original.filePath ? 'File not available' : 'Download file'}
                    >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                    </button>
                </div>
            ),
            enableSorting: false,
            enableColumnFilter: false,
            size: 110,
        },
    ], []);

    // Prepare data for mobile view
    const mobileDownloads = filteredDownloads.map((download, index) => ({
        ...download,
        srNo: index + 1
    }));

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />

            <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="max-w-7xl mx-auto">
                    {/* Page Title */}
                    <h1 className="text-xl sm:text-2xl font-bold text-[#003366] mb-2">
                        Downloads
                    </h1>

                    {/* Downloads Count */}
                    {!loading && !error && (
                        <p className="text-sm text-gray-600 mb-6">
                            Showing {filteredDownloads.length} download{filteredDownloads.length !== 1 ? 's' : ''}
                        </p>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003366] mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading downloads...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-red-700">{error}</p>
                                <button
                                    onClick={fetchDownloads}
                                    className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="hidden md:block">
                            <TableService
                                columns={columns}
                                data={filteredDownloads}
                                loading={loading}
                                initialPageSize={10}
                            />
                        </div>
                    )}

                    {/* Mobile Card View */}
                    {!loading && !error && (
                        <div className="md:hidden space-y-4">
                            {mobileDownloads.length > 0 ? (
                                mobileDownloads.map((download, index) => (
                                    <div
                                        key={download.id}
                                        className={`${index % 2 === 0 ? 'bg-[#e6f3ff]' : 'bg-white'} rounded-lg shadow-md border border-gray-200 p-4`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-600 text-white text-sm font-bold rounded-full">
                                                {download.srNo}
                                            </span>
                                            <button
                                                onClick={() => handleDownload(download.filePath, download.title)}
                                                className="inline-flex items-center justify-center px-4 py-2 bg-[#003366] text-white text-xs rounded hover:bg-[#004080] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={!download.filePath}
                                                title={!download.filePath ? 'File not available' : 'Download file'}
                                            >
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Download
                                            </button>
                                        </div>
                                        <h3 className="text-[#003366] font-semibold text-sm mb-3">{download.title}</h3>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-gray-500">Date:</span>
                                                <span className="ml-1 text-[#003366]">{formatDate(download.date)}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Language:</span>
                                                <span className="ml-1 text-[#003366]">{download.language}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-gray-500">File:</span>
                                                <span className="ml-1 text-[#003366]">{download.format} / {download.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center text-gray-500">
                                    No downloads available.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Download;
