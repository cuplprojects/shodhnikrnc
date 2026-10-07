import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRef, useState, useEffect } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '../../../services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const ResearchProject = () => {
    const tableRef = useRef(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch projects from API
    const fetchProjects = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await API.get('/ResearchProjects');
            
            if (response.data.success && response.data.data) {
                // Filter only Active research projects for public display
                const activeProjects = response.data.data.filter(project => project.status === 'Active');
                
                // Map API data to table format
                const mappedProjects = activeProjects.map((project, index) => ({
                    srNo: index + 1,
                    id: project.id,
                    title: project.title,
                    department: project.department,
                    fundingAgency: project.fundingAgency,
                    amount: formatCurrency(project.amount),
                    nameOfPI: project.principalInvestigator,
                    startDate: formatDate(project.startDate),
                    expectedCompletion: formatDate(project.expectedCompletionDate),
                    status: project.status,
                    attachmentPath: project.attachmentPath,
                    attachmentFileName: project.attachmentFileName
                }));
                setProjects(mappedProjects);
            } else {
                setError('Failed to fetch research projects');
            }
        } catch (err) {
            setError('Error connecting to server');
            console.error('Error fetching projects:', err);
        } finally {
            setLoading(false);
        }
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    // Download attachment using getBaseFileURL directly
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
            setError('Failed to download attachment. Please try again.');
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
            header: 'Title of the Project',
            cell: (info) => (
                <div className="max-w-xs">
                    <div className="font-medium text-gray-900 truncate" title={info.getValue()}>
                        {info.getValue()}
                    </div>
                </div>
            ),
            size: 300,
        }),
        columnHelper.accessor('department', {
            header: 'Department',
            cell: (info) => info.getValue(),
            size: 120,
        }),
        columnHelper.accessor('fundingAgency', {
            header: 'Funding Agency',
            cell: (info) => info.getValue(),
            size: 150,
        }),
        columnHelper.accessor('amount', {
            header: 'Amount (INR)',
            cell: (info) => (
                <span className="font-medium text-green-600">
                    {info.getValue()}
                </span>
            ),
            size: 120,
        }),
        columnHelper.accessor('nameOfPI', {
            header: 'Name of PI',
            cell: (info) => info.getValue(),
            size: 150,
        }),
        columnHelper.accessor('startDate', {
            header: 'Start Date',
            cell: (info) => info.getValue(),
            size: 120,
        }),
        columnHelper.accessor('expectedCompletion', {
            header: 'Expected Completion Date',
            cell: (info) => info.getValue(),
            size: 180,
        }),
        columnHelper.accessor('view', {
            header: 'Actions',
            cell: (info) => {
                const row = info.row.original;
                return (
                    <div className="flex items-center gap-2">
                        {row.attachmentPath && (
                            <button
                                onClick={() => handleDownload(row.attachmentPath, row.attachmentFileName)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm transition-colors duration-150"
                                title="Download Attachment"
                            >
                                Download
                            </button>
                        )}
                       
                    </div>
                );
            },
            size: 120,
        }),
    ];

    useEffect(() => {
        fetchProjects();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />

            <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
                {/* Page Title */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[#003366]">
                        Research Projects
                    </h1>
                    {!loading && (
                        <button
                            onClick={fetchProjects}
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
                                onClick={fetchProjects}
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
                        <p className="text-gray-600">Loading research projects...</p>
                    </div>
                )}

                {/* Table Container */}
                {!loading && (
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                        <TableService
                            ref={tableRef}
                            columns={columns}
                            data={projects}
                            loading={loading}
                            initialPageSize={10}
                        />
                    </div>
                )}

               
            </main>

            <Footer />
        </div>
    );
};

export default ResearchProject;
