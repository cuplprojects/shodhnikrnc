import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRef, useState, useEffect } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '../../../services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const Ordinance = () => {
    const tableRef = useRef(null);
    const [ordinances, setOrdinances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch ordinances from API
    const fetchOrdinances = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await API.get('/Ordinances');
            
            if (response.data.success && response.data.data) {
                // Filter only Active ordinances for public display
                const activeOrdinances = response.data.data.filter(ordinance => ordinance.status === 'Active');
                
                // Map API data to table format
                const mappedOrdinances = activeOrdinances.map((ordinance, index) => ({
                    srNo: index + 1,
                    id: ordinance.id,
                    title: ordinance.title,
                    year: ordinance.year,
                    status: ordinance.status,
                    pdfFileName: ordinance.pdfFileName,
                    pdfFilePath: ordinance.pdfFilePath,
                    createdAt: ordinance.createdAt
                }));
                setOrdinances(mappedOrdinances);
            } else {
                setError('Failed to fetch ordinances');
            }
        } catch (err) {
            setError('Error connecting to server');
            console.error('Error fetching ordinances:', err);
        } finally {
            setLoading(false);
        }
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    // Download PDF using getBaseFileURL directly
    const handleDownload = (filePath, fileName) => {
        if (!filePath) {
            setError('File path not available');
            return;
        }

        try {
            // Clear any previous errors
            setError(null);
            
            // Use the proper base URL for files - same pattern as AboutusSettings
            const baseURL = getBaseFileURL();
            const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
            const fileUrl = `${baseURL}${cleanPath}`;
            
            console.log('Attempting to download from:', fileUrl);
            console.log('File path:', filePath);
            console.log('File name:', fileName);
            
            // Create direct download link
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = fileName || filePath.split('/').pop() || 'download.pdf';
            link.target = '_blank';
            
            // Add to DOM temporarily and click
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (err) {
            console.error('Error downloading file:', err);
            setError('Failed to download PDF. Please try again.');
        }
    };

    // Define table columns
    const columnHelper = createColumnHelper();
    const columns = [
        columnHelper.accessor('srNo', {
            header: 'Sr. No.',
            cell: (info) => info.getValue(),
            size: 80,
        }),
        columnHelper.accessor('title', {
            header: 'Title of Ordinance',
            cell: (info) => (
                <div className="max-w-md">
                    <div className="font-medium text-gray-900 truncate" title={info.getValue()}>
                        {info.getValue()}
                    </div>
                </div>
            ),
            size: 400,
        }),
        columnHelper.accessor('year', {
            header: 'Year',
            cell: (info) => (
                <span className="font-medium text-gray-900">
                    {info.getValue()}
                </span>
            ),
            size: 100,
        }),
        columnHelper.accessor('createdAt', {
            header: 'Published Date',
            cell: (info) => (
                <span className="text-sm text-gray-600">
                    {formatDate(info.getValue())}
                </span>
            ),
            size: 120,
        }),
        columnHelper.accessor('actions', {
            header: 'Actions',
            cell: (info) => {
                const row = info.row.original;
                return (
                    <div className="flex items-center gap-2">
                        {row.pdfFilePath ? (
                            <button
                                onClick={() => handleDownload(row.pdfFilePath, row.pdfFileName)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm transition-colors duration-150"
                                title="Download PDF"
                            >
                                Download PDF
                            </button>
                        ) : (
                            <span className="text-gray-400 text-sm">No PDF</span>
                        )}
                       
                    </div>
                );
            },
            size: 150,
        }),
    ];

    useEffect(() => {
        fetchOrdinances();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />

            <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
                {/* Page Title */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[#003366]">
                        University Ordinances
                    </h1>
                    {!loading && (
                        <button
                            onClick={fetchOrdinances}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            Refresh
                        </button>
                    )}
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-red-700">{error}</p>
                            <button 
                                onClick={fetchOrdinances}
                                className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading ordinances...</p>
                    </div>
                )}

                {/* Table Container */}
                {!loading && (
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                        <TableService
                            ref={tableRef}
                            columns={columns}
                            data={ordinances}
                            loading={loading}
                            initialPageSize={10}
                        />
                    </div>
                )}

                {/* No Data State */}
                {!loading && ordinances.length === 0 && !error && (
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                        <div className="text-gray-400 mb-4">
                            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No ordinances found</h3>
                        <p className="text-gray-500">
                            There are currently no ordinances available to display.
                        </p>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
};

export default Ordinance;
