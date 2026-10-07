import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRef } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';

const Patents = () => {
    const tableRef = useRef(null);
    
    const patents = [
        {
            srNo: 1,
            applNo: '2020103095',
            patentName: 'AMTH- Biomedical Waste Management: An IOT- Based System for Biomedical Waste Management Including Ayurveda Hospitals',
            patentTitle: 'AMTH- Biomedical Waste Management: An IOT- Based System for Biomedical Waste Management Including Ayurveda Hospitals',
            level: 'International',
            status: 'Granted',
            date: '10-29-2020'
        },
        {
            srNo: 2,
            applNo: '444739-001',
            patentName: 'AI-enabled charging station for electric vehicles',
            patentTitle: 'AI-enabled charging station for electric vehicles',
            level: 'National',
            status: 'Granted',
            date: '01-18-2025'
        },
        {
            srNo: 3,
            applNo: '2021105678',
            patentName: 'Smart Irrigation System Using Machine Learning',
            patentTitle: 'Automated Smart Irrigation System for Agricultural Fields Using ML Algorithms',
            level: 'National',
            status: 'Pending',
            date: '05-12-2021'
        },
        {
            srNo: 4,
            applNo: '2022108901',
            patentName: 'Nano-particle Based Water Purification Device',
            patentTitle: 'Novel Nano-particle Based Water Purification Device for Rural Areas',
            level: 'International',
            status: 'Granted',
            date: '08-23-2022'
        },
        {
            srNo: 5,
            applNo: '2023112345',
            patentName: 'Biodegradable Plastic from Agricultural Waste',
            patentTitle: 'Method for Producing Biodegradable Plastic from Agricultural Waste Materials',
            level: 'National',
            status: 'Under Review',
            date: '02-14-2023'
        }
    ];

    // Define table columns
    const columnHelper = createColumnHelper();
    const columns = [
        columnHelper.accessor('srNo', {
            header: 'Sr. No.',
            cell: (info) => info.getValue(),
            size: 80,
        }),
        columnHelper.accessor('applNo', {
            header: 'Appl. No.',
            cell: (info) => info.getValue(),
            size: 120,
        }),
        columnHelper.accessor('patentName', {
            header: 'Patent Name',
            cell: (info) => info.getValue(),
            size: 250,
        }),
        columnHelper.accessor('patentTitle', {
            header: 'Patent Title',
            cell: (info) => info.getValue(),
            size: 250,
        }),
        columnHelper.accessor('level', {
            header: 'Level',
            cell: (info) => info.getValue(),
            size: 120,
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: (info) => info.getValue(),
            size: 120,
        }),
        columnHelper.accessor('date', {
            header: 'Date',
            cell: (info) => info.getValue(),
            size: 120,
        }),
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />

            <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
                {/* Page Title */}
                <h1 className="text-2xl font-bold text-[#003366] mb-6">
                    Patents
                </h1>

                {/* Table Container */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                    <TableService
                        ref={tableRef}
                        columns={columns}
                        data={patents}
                    />
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Patents;
