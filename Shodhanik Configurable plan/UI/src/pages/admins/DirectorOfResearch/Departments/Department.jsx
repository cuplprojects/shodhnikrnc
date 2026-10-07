import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Card, Space, Typography, message } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import API from '@/services/API';
import Button from '@/components/ui/Button';
import {hasPermission} from '@/services/hasPermissionService';
import notification from '@/services/NotificationService';

const { Title } = Typography;
const { Search } = Input;

const Department = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const candownload = hasPermission('departments.download');
  const canview = hasPermission('departments.read')
  const notify = notification();
  
  // Fetch department data
  useEffect(() => {
    fetchDepartmentData();
  }, []);

  const fetchDepartmentData = async () => {
    try {
      setLoading(true);
      const response = await API.get('/Dor/Counts');
        
      // Add serial numbers to the data
      const dataWithSerialNumbers = response.data.map((item, index) => {
        return {
          ...item,
          key: index + 1,
          srNo: index + 1,
        };
      });
      
      console.log('Department - Final processed data:', dataWithSerialNumbers);
      
      setData(dataWithSerialNumbers);
      setFilteredData(dataWithSerialNumbers);
    } catch (error) {
      console.error('Error fetching department data:', error);
      notify.error('Failed to load department data');
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
    if (!value) {
      setFilteredData(data);
    } else {
      const filtered = data.filter(item =>
        item.subject.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredData(filtered);
    }
  };

  // Download Excel
  const downloadExcel = () => {
    try {
      // Prepare data for Excel
      const excelData = filteredData.map(item => ({
        'Sr. No.': item.srNo,
        'Department': item.subject,
        'No. of Supervisors': item.supervisorCount,
        'Total Seat': item.totalSeats,
        'Scholars': item.scholarCount,
        'Seats Available': item.seatsAvailable,
        'Seats for Admission': item.seatsForAdmission // Assuming this is the same as available seats
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // Sr. No.
        { wch: 35 }, // Department
        { wch: 18 }, // No. of Supervisors
        { wch: 12 }, // Total Seat
        { wch: 10 }, // Scholars
        { wch: 15 }, // Seats Available
        { wch: 18 }, // Seats for Admission
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Departments');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Department_Report_${currentDate}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      notification().success('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      notification().error('Failed to download Excel file');
    }
  };

  // Table columns configuration
  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'srNo',
      key: 'srNo',
      width: 80,
      align: 'center',
      sorter: (a, b) => a.srNo - b.srNo,
    },
    {
      title: 'Department',
      dataIndex: 'subject',
      key: 'subject',
      width: 300,
      sorter: (a, b) => a.subject.localeCompare(b.subject),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search department"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              module="general"
              label="Search"
              size="sm"
              onClick={() => confirm()}
            />
            <Button
              module="general"
              label="Reset"
              size="sm"
              variant="outline"
              onClick={() => {
                clearFilters();
                confirm();
              }}
            />
          </Space>
        </div>
      ),
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      onFilter: (value, record) =>
        record.subject.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'No. of Supervisors',
      dataIndex: 'supervisorCount',
      key: 'supervisorCount',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.supervisorCount - b.supervisorCount,
    },
    {
      title: 'Total Seat',
      dataIndex: 'totalSeats',
      key: 'totalSeats',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.totalSeats - b.totalSeats,
    },
    {
      title: 'Scholars',
      dataIndex: 'scholarCount',
      key: 'scholarCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.scholarCount - b.scholarCount,
    },
    {
      title: 'Seats Available',
      dataIndex: 'seatsAvailable',
      key: 'seatsAvailable',
      width: 130,
      align: 'center',
      sorter: (a, b) => a.seatsAvailable - b.seatsAvailable,
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {value}
        </span>
      ),
    },
    {
      title: 'Seats for Admission',
      dataIndex: 'seatsForAdmission',
      key: 'seatsForAdmission',
      width: 150,
      align: 'center',
      render: (value) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          value > 0 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      ),
    },
    
    {
      title: 'List',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, record) => (
        canview && (
           <Button
          module="general"
          action="read"
          label="View"
          size="sm"
          variant="outline"
          onClick={() => handleViewDepartment(record)}
        />
        )
       
      ),
    },
  ];

  const handleViewDepartment = (record) => {
    console.log('Department - handleViewDepartment called with record:', record);
    console.log('Department - Full record keys:', Object.keys(record));
    console.log('Department - All record values:', record);
    
    const deptid = record.departmentid;
    console.log('Department - departmentid value:', deptid);
    console.log('Department - typeof departmentid:', typeof deptid);
    
    if (!deptid) {
      console.error('Department ID is missing from record');
      notify.error('Department ID not found');
      return;
    }
    
    console.log('Department - navigating to:', `/director_panel/departments/${deptid}`);
    
    // Navigate to department supervisor page with department ID
    navigate(`/director_panel/departments/${deptid}`);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2} className="!mb-0">
            Department
          </Title>
          {candownload && (
            <Button
            module="general"
            label="Download"
            icon={<DownloadOutlined />}
            onClick={downloadExcel}
            variant="solid"
            className="bg-green-600 hover:bg-green-700 border-green-600"
          />
          )}
          
        </div>
        
        {/* Search Bar */}
        <div className="flex justify-between items-center">
          <Search
            placeholder="Search departments..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            style={{ width: 400 }}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
          />
          <div className="text-gray-600">
            Total Departments: <span className="font-semibold">{filteredData.length}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {data.reduce((sum, item) => sum + item.supervisorCount, 0)}
          </div>
          <div className="text-gray-600">Total Supervisors</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {data.reduce((sum, item) => sum + item.totalSeats, 0)}
          </div>
          <div className="text-gray-600">Total Seats</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {data.reduce((sum, item) => sum + item.scholarCount, 0)}
          </div>
          <div className="text-gray-600">Total Scholars</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {data.reduce((sum, item) => sum + item.seatsAvailable, 0)}
          </div>
          <div className="text-gray-600">Available Seats</div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} departments`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 1200 }}
          size="middle"
          bordered
          className="department-table"
        />
      </Card>

      <style>
        {`
          .department-table .ant-table-thead > tr > th {
            background-color: #f8f9fa !important;
            font-weight: 600 !important;
            color: #495057 !important;
          }
          
          .department-table .ant-table-tbody > tr:hover > td {
            background-color: #f8f9fa !important;
          }
          
          .department-table .ant-pagination {
            margin-top: 16px !important;
          }
        `}
      </style>
    </div>
  );
};

export default Department;