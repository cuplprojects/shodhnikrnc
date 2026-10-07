import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRef, useEffect, useState } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Extend dayjs with customParseFormat plugin
dayjs.extend(customParseFormat);

const RDCSchedules = () => {
  const tableRef = useRef(null);
  const [rdcScheduleData, setRdcScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const notify = notification();

  useEffect(() => {
    fetchRDCSchedules();
  }, []);

  const parseDate = (dateString) => {
    if (!dateString) return null;
    
    console.log('Raw date from API:', dateString, 'Type:', typeof dateString);
    
    // If it's already a Date object, convert to string
    if (dateString instanceof Date) {
      dateString = dayjs(dateString).format('DD-MM-YYYY');
      console.log('Converted Date object to:', dateString);
    }
    
    // If it's a number (timestamp), convert it
    if (typeof dateString === 'number') {
      dateString = dayjs(dateString).format('DD-MM-YYYY');
      console.log('Converted timestamp to:', dateString);
    }
    
    // Parse with DD-MM-YYYY format (the actual format from API)
    const parsed = dayjs(dateString, 'DD-MM-YYYY');
    if (parsed.isValid()) {
      const result = parsed.format('DD-MM-YYYY');
      console.log('Parsed successfully:', result);
      return result;
    }
    
    // Try other formats as fallback
    const formats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DDTHH:mm:ss'];
    
    for (const format of formats) {
      const fallbackParsed = dayjs(dateString, format);
      if (fallbackParsed.isValid()) {
        const result = fallbackParsed.format('DD-MM-YYYY');
        console.log('Parsed with fallback format:', format, 'Result:', result);
        return result;
      }
    }
    
    console.log('Failed to parse date:', dateString);
    return null;
  };

  const fetchRDCSchedules = async () => {
    setLoading(true);
    try {
      const response = await API.get('/SynopsisRDC/GetDistinctSubjectsofPendingSynopsis');
      
      if (response.data && Array.isArray(response.data)) {
        const schedules = [];
        let srNo = 1;

        // Process each subject/department
        for (const subject of response.data) {
          try {
            // Fetch scholars for this department
            const scholarsResponse = await API.get(
              `/SynopsisRDC/GetPendingScholarsForSynopsisApprovalbyYear/${subject.departmentID}`,
              {
                params: {
                  synopsis1Decision: 1
                }
              }
            );

            if (scholarsResponse.data && Array.isArray(scholarsResponse.data)) {
              // Group scholars by RDC date
              const groupedByDate = {};
              
              scholarsResponse.data.forEach(scholar => {
                if (scholar.rdcDate) {
                  const parsedDate = parseDate(scholar.rdcDate);
                  if (parsedDate) {
                    if (!groupedByDate[parsedDate]) {
                      groupedByDate[parsedDate] = [];
                    }
                    groupedByDate[parsedDate].push(scholar);
                  }
                }
              });

              // Create a row for each date
              Object.entries(groupedByDate).forEach(([date, scholars]) => {
                schedules.push({
                  srNo: srNo++,
                  date: date,
                  faculty: subject.subjectName,
                  scholar: scholars.map(s => `${s.name}`).join(', '),
                  departmentID: subject.departmentID,
                  scholarCount: scholars.length
                });
              });
            }
          } catch (error) {
            console.error(`Failed to fetch scholars for department ${subject.departmentID}:`, error);
          }
        }

        setRdcScheduleData(schedules);
      }
    } catch (error) {
      notify.error('Failed to fetch RDC schedules');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Define table columns
  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.accessor('srNo', {
      header: 'Sr. No.',
      cell: (info) => <div className="text-center font-medium">{info.getValue()}</div>,
      size: 80,
    }),
    columnHelper.accessor('faculty', {
      header: 'Department',
      cell: (info) => (
        <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
          {info.getValue()}
        </div>
      ),
      size: 150,
    }),
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => (
        <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold text-center">
          {info.getValue()}
        </div>
      ),
      size: 120,
    }),
    columnHelper.accessor('scholar', {
      header: 'Scholars to be Appeared',
      cell: (info) => (
        <div className="whitespace-pre-line font-medium text-[#0066cc] text-xs">
          {info.getValue()}
        </div>
      ),
      size: 250,
    }),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-1xl  text-[#0066cc] mb-2">RDC Schedules</h1>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <TableService
            ref={tableRef}
            columns={columns}
            data={rdcScheduleData}
            loading={loading}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RDCSchedules;
