import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRef, useState, useEffect } from 'react';
import TableService from '@/services/TableService';
import { createColumnHelper } from '@tanstack/react-table';
import API from '@/services/API';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const Scipapers = () => {
  const tableRef = useRef(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Download paper using getBaseFileURL directly
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
      setError('Failed to download paper. Please try again.');
    }
  };

  // Fetch data from API
  useEffect(() => {
    const fetchPapers = async () => {
      try {
        setLoading(true);
        // Fetch all scholar research data
        const response = await API.get('/ScholarResearch');
        
        // Transform API response to array format for table
        let transformedData = [];
        
        if (Array.isArray(response.data)) {
          // If response is already an array
          transformedData = response.data.map((item, index) => ({
            id: item.id,
            srNo: index + 1,
            titleOfPaper: item.titleOfPaper,
            pubYear: item.yearOfPb, // API uses yearOfPb instead of pubYear
            journalName: item.nameOfJournal, // API uses nameOfJournal instead of journalName
            authorName: Array.isArray(item.authorNames) ? item.authorNames.join(', ') : item.authorNames, // API uses authorNames array
            issNo: item.issNo,
            volume: item.volume,
            page: item.page,
            citations: item.citations,
            impactFactor: item.impactFactor,
            listedIn: item.listedIn,
            ugcListNo: item.ugcListNo || 'N/A', // Add fallback if not present
            webUrl: item.webUrl,
            uploadPaper: item.uploadPaper
          }));
        } else {
          // If response is a single object, wrap it in an array
          transformedData = [{
            id: response.data.id,
            srNo: 1,
            titleOfPaper: response.data.titleOfPaper,
            pubYear: response.data.yearOfPb,
            journalName: response.data.nameOfJournal,
            authorName: Array.isArray(response.data.authorNames) ? response.data.authorNames.join(', ') : response.data.authorNames,
            issNo: response.data.issNo,
            volume: response.data.volume,
            page: response.data.page,
            citations: response.data.citations,
            impactFactor: response.data.impactFactor,
            listedIn: response.data.listedIn,
            ugcListNo: response.data.ugcListNo || 'N/A',
            webUrl: response.data.webUrl,
            uploadPaper: response.data.uploadPaper
          }];
        }
        
        setPapers(transformedData);
        setError(null);
      } catch (err) {
        console.error('Error fetching papers:', err);
        setError('Failed to fetch papers data');
      } finally {
        setLoading(false);
      }
    };

    fetchPapers();
  }, []);

  // Define table columns based on API response structure
  const columnHelper = createColumnHelper();
  const columns = [
    columnHelper.accessor('srNo', {
      header: 'Sr. No.',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('titleOfPaper', {
      header: 'Title of Paper',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('pubYear', {
      header: 'Publication Year',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('journalName', {
      header: 'Journal Name',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('authorName', {
      header: 'Author Name',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('issNo', {
      header: 'ISSN',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('volume', {
      header: 'Volume',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('page', {
      header: 'Page No.',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('citations', {
      header: 'Citations',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('impactFactor', {
      header: 'Impact Factor',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('listedIn', {
      header: 'Listed In',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('ugcListNo', {
      header: 'UGC List No.',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('webUrl', {
      header: 'Web URL',
      cell: (info) => {
        const url = info.getValue();
        return url ? (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            View
          </a>
        ) : 'N/A';
      },
    }),
    columnHelper.accessor('uploadPaper', {
      header: 'Paper Document',
      cell: (info) => {
        const paperPath = info.getValue();
        const row = info.row.original;
        return paperPath ? (
          <button
            onClick={() => handleDownload(paperPath, `${row.titleOfPaper}.pdf`)}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm transition-colors duration-150"
            title="Download Paper"
          >
            Download
          </button>
        ) : 'N/A';
      },
    }),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-grow w-full px-4 py-8">
        <div className="max-w-none mx-auto">
          <h1 className="text-1xl font-bold text-[#0099cc] mb-6">
            SCI Papers
          </h1>
          
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <div className="text-lg text-gray-600">Loading papers...</div>
              </div>
            ) : error ? (
              <div className="flex justify-center items-center p-8">
                <div className="text-lg text-red-600">{error}</div>
              </div>
            ) : papers.length === 0 ? (
              <div className="flex justify-center items-center p-8">
                <div className="text-lg text-gray-600">No papers found</div>
              </div>
            ) : (
              <div className="min-w-full">
                <TableService
                  ref={tableRef}
                  columns={columns}
                  data={papers}
                />
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Scipapers;
