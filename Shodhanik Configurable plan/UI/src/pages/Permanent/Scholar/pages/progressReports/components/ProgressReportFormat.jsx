import { useRef, useState, useEffect } from 'react'
import { Spin } from 'antd'
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import PrintHeader from "@/components/cms/PrintHeader";

const ProgressReportFormat = () => {
  const contentRef = useRef(null)
  const { getSId } = useSelectedScholarAuthStore()
  const [scholarData, setScholarData] = useState(null)
  const [loading, setLoading] = useState(true)
  const notify = notification()

  // Fallback data
  const fallbackData = {
    rmsId: 'UTHD0206',
    name: 'ANUJ PANDEY',
    enrollmentNo: '18002391',
    department: 'Hindi',
    dateOfRegistration: '',
    titleOfWork: 'हिंदी के क्षेत्र में नई खोज',
    dateOfRDC: '09-10-2020',
    supervisor: 'SADHANA (20SUP0014)',
    supervisorId: '20SUP0014',
    supervisorPhone: '9668939193',
    supervisorEmail: 'sadhana4119@gmail.com',
    coSupervisor: 'N/A',
  }

  useEffect(() => {
    const fetchScholarData = async () => {
      try {
        setLoading(true)
        const sId = getSId()

        if (!sId) {
          setScholarData(fallbackData)
          return
        }

        try {
          // Fetch from API
          const response = await API.get(`/ProgressReports/ProgressReportFormatDetails/${sId}`)
          if (response.data) {
            // Map API response to component data
            const mappedData = {
              rmsId: response.data.rmsiD_Username || 'N/A',
              name: response.data.name || 'N/A',
              enrollmentNo: response.data.applicationNumber || 'N/A',
              department: response.data.departmentOrSubject || 'N/A',
              dateOfRegistration: response.data.date ? new Date(response.data.date).toLocaleDateString() : '',
              titleOfWork: response.data.titleOfSynopsis || 'N/A',
              dateOfRDC: response.data.dateOfRDC ? new Date(response.data.dateOfRDC).toLocaleDateString() : '',
              supervisor: response.data.supervisor || 'N/A',
              supervisorId: response.data.supervisorUserName || 'N/A',
              supervisorPhone: response.data.supervisorMobileNumber || 'N/A',
              supervisorEmail: response.data.supervisorEmail || 'N/A',
              coSupervisor: response.data.coSupervisor || 'N/A',
              coSupervisorPhone: response.data.coSupervisorMobileNumber || 'N/A',
              coSupervisorEmail: response.data.coSupervisorEmail || 'N/A',
              phone: response.data.mobileNumber || 'N/A',
              email: response.data.email || 'N/A',
            }
            setScholarData(mappedData)
          } else {
            setScholarData(fallbackData)
          }
        } catch (err) {
          console.error('Error fetching scholar data:', err)
          // Use fallback data if API fails
          setScholarData(fallbackData)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchScholarData()
  }, [getSId])

  const handleDownloadPDF = () => {
    if (!contentRef.current) return

    try {
      // Use the browser's native print functionality instead of opening a new window
      window.print()
    } catch (error) {
      console.error('Error generating PDF:', error)
      notify.error('Error generating PDF')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" tip="Loading progress report format..." />
      </div>
    )
  }

  if (!scholarData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 text-lg">Failed to load progress report format</div>
      </div>
    )
  }

  return (
    <div className=" bg-white flex flex-col">
      {/* Header Bar */}
      <div className="bg-slate-700 text-white p-3 flex justify-between items-center shadow-md print:hidden">
        <h2 className="text-lg font-semibold">Ph.D. Progress Report</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
          >
            Print / Download PDF
          </button>
          <a
            href="/progress-reports"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition text-sm font-medium"
          >
            Back
          </a>
        </div>
      </div>

      {/* Content Area - Full Screen */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4 print:p-0 print:overflow-visible">
        <div ref={contentRef} className="bg-white mx-auto print:mx-0" style={{ width: '8.5in', minHeight: '11in', padding: '0.5in', fontSize: '12px', lineHeight: '1.3', fontFamily: 'Arial, sans-serif' }}>
          
          {/* Header Section */}
          <PrintHeader/>

          {/* Scholar Information - Two Columns */}
          <div className="grid grid-cols-2 gap-6 mb-4 text-sm">
            <div className="space-y-1">
              <p><span className="font-bold">Shodhanik Id :</span> {scholarData?.rmsId || '1/PHD0206'}</p>
              <p><span className="font-bold">Name :</span> {scholarData?.name || 'ANUJ PANDEY'}</p>
              <p><span className="font-bold">Date of Registration :</span> {scholarData?.dateOfRegistration || ''}</p>
              <p><span className="font-bold">Title of the Work :</span> {scholarData?.titleOfWork || 'हिंदी के क्षेत्र में नई खोज'}</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-bold">Enroll. No. :</span> {scholarData?.enrollmentNo || '18002391'}</p>
              <p><span className="font-bold">Department / Subject :</span> {scholarData?.department || 'Hindi'}</p>
              <p><span className="font-bold">Date of RDC :</span> {scholarData?.dateOfRDC || '09-10-2020'}</p>
            </div>
          </div>

          <div className="border-b-2 border-black mb-4"></div>

          {/* Supervisor Information */}
          <div className="grid grid-cols-2 gap-6 mb-4 text-sm">
            <div className="space-y-1">
              <p><span className="font-bold">Supervisor :</span> {scholarData?.supervisor || 'SADHANA (20SUP0014)'}</p>
              <p><span className="font-bold">Duration of Report :</span> ___________________</p>
              <p><span className="font-bold">If Yes, details of fellowship/scholarship:</span> ___________________</p>
              <p><span className="font-bold">Teaching Assignment as JRF :</span> Yes / No / NA</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-bold">Co-Supervisor :</span> {scholarData?.coSupervisor || 'N/A'}</p>
              <p><span className="font-bold">Received any fellowship/scholarship ? :</span> Yes / No</p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="mb-4">
            <p className="text-sm font-bold text-center mb-1">
              Highlight the progress of work during the period of progress report:
            </p>
            <p className="text-xs text-center text-gray-600 mb-2">
              (Note: Additional sheets may be used if required.)
            </p>
            <div className="space-y-2">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border-b border-black" style={{ height: '20px' }}></div>
              ))}
            </div>
          </div>

          <div className="border-b-2 border-black my-4"></div>

          {/* Signature Section */}
          <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
            <div>
              <p className="font-bold mb-12">Signature of Student</p>
              <p>{scholarData?.name || 'ANUJ PANDEY'} ({scholarData?.enrollmentNo || '17PHD0206'})</p>
              <p>Mobile No. - {scholarData?.phone || '9453038530'}</p>
              <p>Email - {scholarData?.email || ''}</p>
              <p>Date :</p>
            </div>
            <div>
              <p className="font-bold mb-12">Signature of Supervisor</p>
              <p>{scholarData?.supervisor || 'SADHANA'} ({scholarData?.supervisorId || '20SUP0014'})</p>
              <p>Mobile No. - {scholarData?.supervisorPhone || '7906039193'}</p>
              <p>Email - {scholarData?.supervisorEmail || 'sadhana4110@gmail.com'}</p>
              <p>Date :</p>
              <p>Remarks (if any)</p>
            </div>
            <div>
              <p className="font-bold mb-12">Signature of Co-Supervisor</p>
              <p>{scholarData?.coSupervisor || 'N/A'}</p>
            </div>
          </div>

          <div className="border-b-2 border-black my-4"></div>

          {/* Footer Section */}
          <div className="text-center mb-6">
            <p className="text-sm font-bold">Forwarded by HoD/Principal/Dean</p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-4 text-sm">
            <div>
              <p>Date :</p>
            </div>
            <div className="text-right">
              <p>HoD/Principal/Dean</p>
            </div>
          </div>

          <div className="border-t-2 border-black pt-2">
            <p className="text-xs text-center">
              P.S. Enclosed seminar, conference, paper publication and others mentioned in progress report.
            </p>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5in;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .print\\:overflow-visible {
            overflow: visible !important;
          }
          
          .print\\:mx-0 {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

export default ProgressReportFormat
