import { useState } from 'react';
import API from '@/services/API';
import ExcelMapper from '@/services/ExcelMapper';
import notification from '@/services/NotificationService';
import {hasPermission} from '@/services/hasPermissionService';


const Attendance = () => {
  const [activeTab, setActiveTab] = useState('individual');
  const [formData, setFormData] = useState({
    permUserName: '',
    totalDays: '',
    workingDays: '',
    noOfDaysPresent: '',
    month: [],
    year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
  });
  const [loading, setLoading] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [templateMonths, setTemplateMonths] = useState([]);
  const [showTemplateOptions, setShowTemplateOptions] = useState(false);
  const candownload = hasPermission('attendance.download')
  const canreadindividual = hasPermission('attendance.read-individual')
  const canbulkupload = hasPermission('attendance.read-bulk-upload')

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate academic years (only current year in format 2026-2027)
  const currentYear = new Date().getFullYear();
  const currentAcademicYear = `${currentYear}-${currentYear + 1}`;

  // Function to get days in a month for a specific year
  const getDaysInMonth = (monthName, year) => {
    const monthIndex = months.indexOf(monthName);
    if (monthIndex === -1) return 0;
    
    // For academic year, months Jan-Mar are in the next year, Apr-Dec are in current year
    const actualYear = monthIndex < 3 ? year + 1 : year;
    return new Date(actualYear, monthIndex + 1, 0).getDate();
  };

  // Function to calculate total days from selected months
  const calculateTotalDays = (selectedMonths) => {
    if (!selectedMonths || selectedMonths.length === 0) return 0;
    
    return selectedMonths.reduce((total, monthName) => {
      return total + getDaysInMonth(monthName, currentYear);
    }, 0);
  };

  // Predefined fields for Excel mapping
  const predefinedFields = [
    { key: 'permUserName', label: 'Scholar Name', required: true, variations: ['permUserName', 'username', 'user name', 'user_name', 'name', 'scholar name'] },
    { key: 'totalDays', label: 'Total Days', required: true, variations: ['totalDays', 'total days', 'total_days', 'days total'] },
    { key: 'workingDays', label: 'Working Days', required: true, variations: ['workingDays', 'working days', 'working_days', 'work days'] },
    { key: 'noOfDaysPresent', label: 'Days Present', required: true, variations: ['noOfDaysPresent', 'days present', 'present days', 'attendance days', 'days_present'] },
    { key: 'month', label: 'Month', required: true, variations: ['month', 'months', 'month name'] },
    { key: 'year', label: 'Year', required: true, variations: ['year', 'academic year', 'yr'] }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMonthChange = (e) => {
    const { value, checked } = e.target;
    const updatedMonths = checked 
      ? [...formData.month, value]
      : formData.month.filter(month => month !== value);
    
    // Calculate total days for selected months
    const totalDays = calculateTotalDays(updatedMonths);
    
    setFormData(prev => ({
      ...prev,
      month: updatedMonths,
      totalDays: totalDays.toString()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await API.post('/ScholarAttendance', {
        permUserName: formData.permUserName,
        totalDays: parseInt(formData.totalDays),
        workingDays: parseInt(formData.workingDays),
        noOfDaysPresent: parseInt(formData.noOfDaysPresent),
        month: formData.month,
        year: formData.year
      });

      notification().success('Attendance submitted successfully!');
      setFormData({
        permUserName: '',
        totalDays: '0',
        workingDays: '',
        noOfDaysPresent: '',
        month: [],
        year: currentAcademicYear
      });
    } catch (error) {
      notification().error('Error submitting attendance: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk data from ExcelMapper
  const handleBulkDataChange = (data) => {
    setBulkData(data);
  };

  // Handle bulk file reset
  const handleBulkFileReset = () => {
    setBulkData([]);
  };

  // Submit bulk attendance data
  const handleBulkSubmit = async () => {
    if (bulkData.length === 0) {
      notification().warning('Please upload and map Excel file first');
      return;
    }

    setBulkLoading(true);

    try {
      // Transform data to match API format
      const transformedData = bulkData.map(row => ({
        permUserName: row.permUserName || '',
        totalDays: parseInt(row.totalDays) || 0,
        workingDays: parseInt(row.workingDays) || 0,
        noOfDaysPresent: parseInt(row.noOfDaysPresent) || 0,
        month: row.month ? [row.month] : [],
        year: row.year || ''
      }));

      const response = await API.post('/ScholarAttendance/bulk-create', transformedData);
      
      notification().success(`Successfully uploaded ${transformedData.length} attendance records!`);
      setBulkData([]);
    } catch (error) {
      notification().error('Error uploading bulk attendance: ' + (error.response?.data?.message || error.message));
    } finally {
      setBulkLoading(false);
    }
  };

  // Download template function
  const handleDownloadTemplate = async () => {
    if (templateMonths.length === 0) {
      notification().warning('Please select at least one month for the template');
      return;
    }

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('year', currentAcademicYear);
      templateMonths.forEach(month => params.append('months', month));
      params.append('subjectId', '1'); // Default subject ID

      const response = await API.get(`/ScholarAttendance/download-template?${params.toString()}`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-template-${currentAcademicYear}-${templateMonths.join('-')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notification().success(`Template downloaded for ${templateMonths.join(', ')}!`);
      setShowTemplateOptions(false);
    } catch (error) {
      notification().error('Error downloading template: ' + (error.response?.data?.message || error.message));
    }
  };

  // Handle template month selection
  const handleTemplateMonthChange = (e) => {
    const { value, checked } = e.target;
    setTemplateMonths(prev => 
      checked 
        ? [...prev, value]
        : prev.filter(month => month !== value)
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Scholar Attendance Management</h1>
        <p className="text-sm text-gray-600">Manage individual and bulk attendance records efficiently</p>
      </div>
      
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-sm ">
          <nav className="flex">
            {canreadindividual && (
               <button
              onClick={() => setActiveTab('individual')}
              className={`flex-1 py-3 px-4 text-sm font-medium rounded-l-lg transition-colors cursor-pointer ${
                activeTab === 'individual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Individual Entry
            </button>
            )}
           
           {canbulkupload && (
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex-1 py-3 px-4 text-sm font-medium rounded-r-lg transition-colors border-l cursor-pointer ${
                activeTab === 'bulk'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Bulk Upload
            </button>
           )}
            
          </nav>
        </div>
      </div>

      {/* Individual Entry Tab */}
      {activeTab === 'individual' && (
        <>
          <div className="p-6 border-b border-gray-100 bg-white rounded-t-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Individual Attendance Entry</h2>
            <p className="text-sm text-gray-600">Enter attendance details for a single scholar</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white rounded-b-lg shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="permUserName" className="block text-sm font-medium text-gray-700 mb-2">
                  Scholar Name
                </label>
                <input
                  type="text"
                  id="permUserName"
                  name="permUserName"
                  value={formData.permUserName}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter scholar name"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-text"
                />
              </div>

              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                  Academic Year
                </label>
                <input
                  type="text"
                  id="year"
                  name="year"
                  value={formData.year}
                  readOnly
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="totalDays" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Days
                </label>
                <input
                  type="number"
                  id="totalDays"
                  name="totalDays"
                  value={formData.totalDays}
                  onChange={handleInputChange}
                  required
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated from selected months</p>
              </div>

              <div>
                <label htmlFor="workingDays" className="block text-sm font-medium text-gray-700 mb-2">
                  Working Days
                </label>
                <input
                  type="number"
                  id="workingDays"
                  name="workingDays"
                  value={formData.workingDays}
                  onChange={handleInputChange}
                  required
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-text"
                />
              </div>

              <div>
                <label htmlFor="noOfDaysPresent" className="block text-sm font-medium text-gray-700 mb-2">
                  Days Present
                </label>
                <input
                  type="number"
                  id="noOfDaysPresent"
                  name="noOfDaysPresent"
                  value={formData.noOfDaysPresent}
                  onChange={handleInputChange}
                  required
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-text"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Months
                </label>
                {formData.month.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, month: [], totalDays: '0' }))}
                    className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors cursor-pointer"
                  >
                    Reset Months
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {months.map((month) => (
                  <label key={month} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      value={month}
                      checked={formData.month.includes(month)}
                      onChange={handleMonthChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">{month.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
              {formData.month.length > 0 && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-700 mb-1">
                    <strong>Selected Months:</strong> {formData.month.join(', ')}
                  </p>
                  <p className="text-xs text-blue-600">
                    <strong>Total Days:</strong> {formData.totalDays} days
                  </p>
                  <div className="mt-1 text-xs text-blue-600">
                    {formData.month.map(month => (
                      <span key={month} className="inline-block mr-2">
                        {month}: {getDaysInMonth(month, currentYear)} days
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 px-6 text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </div>
                ) : (
                  'Submit Attendance'
                )}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Bulk Upload Tab */}
      {activeTab === 'bulk' && (
        <>
          

          <div className="bg-white rounded-b-lg shadow-sm">
            <ExcelMapper
              predefinedFields={predefinedFields}
              onDataChange={handleBulkDataChange}
              onFileReset={handleBulkFileReset}
              debugMode={false}
              exportJsonEnabled={false}
            />

            {bulkData.length > 0 && (
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Ready to Upload</h3>
                    <p className="text-sm text-gray-600">{bulkData.length} attendance records mapped and ready for submission</p>
                  </div>
                  {canbulkupload && (
                    <button
                    onClick={handleBulkSubmit}
                    disabled={bulkLoading}
                    className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 text-sm font-medium rounded-lg hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm cursor-pointer"
                  >
                    {bulkLoading  ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </div>
                    ) : (
                      'Upload Attendance'
                    )}
                  </button>
                  )}
                  
                </div>
              </div>
            )}
          </div>
          <div className="p-6 border-b border-gray-100 bg-white rounded-t-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Bulk Attendance Upload</h2>
                <p className="text-sm text-gray-600">
                  Upload Excel (.xlsx, .xls) or CSV files with multiple attendance records. Download the template first to ensure proper format.
                </p>
              </div>
              {candownload && (
                 <button
                onClick={() => setShowTemplateOptions(!showTemplateOptions)}
                className="bg-gradient-to-r from-green-600 to-green-600 text-white px-4 py-2.5 text-sm font-medium rounded-lg  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-sm flex items-center space-x-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download Template</span>
              </button>
              )}
             
            </div>

            {/* Template Month Selection */}
            {showTemplateOptions && (
              <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <h3 className="text-sm font-semibold text-indigo-900 mb-2">Select Months for Template</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                  {months.map((month) => (
                    <label key={month} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={month}
                        checked={templateMonths.includes(month)}
                        onChange={handleTemplateMonthChange}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">{month.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
                {templateMonths.length > 0 && (
                  <div className="mb-3 p-2 bg-indigo-100 rounded">
                    <p className="text-xs text-indigo-700">
                      <strong>Selected:</strong> {templateMonths.join(', ')}
                    </p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={templateMonths.length === 0}
                    className="bg-indigo-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Generate Template
                  </button>
                  <button
                    onClick={() => setTemplateMonths([])}
                    className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowTemplateOptions(false)}
                    className="text-xs text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded border border-gray-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* Instructions Section */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to Use Bulk Upload
              </h3>
              <div className="text-sm text-blue-800 space-y-2">
                <div className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                  <p><strong>Download Template:</strong> Click "Download Template" button above, select the months you need, then click "Generate Template" to get the Excel template with proper column headers.</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                  <p><strong>Fill Data:</strong> Open the template and fill in the attendance data. Required columns: Scholar Name, Total Days, Working Days, Days Present, Month, Academic Year (e.g., 2026-2027).</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                  <p><strong>Upload File:</strong> Save your file and upload it using the file selector below. Supported formats: .xlsx, .xls, .csv</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
                  <p><strong>Map Fields:</strong> The system will automatically map columns to required fields. Review and adjust mappings if needed.</p>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">5</span>
                  <p><strong>Submit:</strong> Once all required fields are mapped, click "Upload Attendance" to submit all records at once.</p>
                </div>
              </div>
              <div className="mt-3 p-2 bg-blue-100 rounded border-l-4 border-blue-400">
                <p className="text-xs text-blue-700">
                  <strong>Tip:</strong> Select only the months you need in the template to keep your Excel file organized. The template will include columns for the selected months only.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Attendance;