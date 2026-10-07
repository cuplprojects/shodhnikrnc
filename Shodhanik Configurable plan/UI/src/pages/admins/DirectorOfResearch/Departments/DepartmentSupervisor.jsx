import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Input, Card, Space, Typography, message, Breadcrumb } from 'antd';
import { SearchOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import API from '@/services/API';
import Button from '@/components/ui/Button';
import {hasPermission} from '@/services/hasPermissionService';
import notification from '@/services/NotificationService';

const { Title } = Typography;
const { Search } = Input;

const DepartmentSupervisor = () => {
  const { deptid } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const canview = hasPermission('departments.read')
  const notify = notification();
  
  // Fetch department supervisor data
  useEffect(() => {
    console.log('DepartmentSupervisor - deptid from useParams:', deptid);
    console.log('DepartmentSupervisor - typeof deptid:', typeof deptid);
    
    if (deptid && deptid !== 'undefined') {
      fetchDepartmentSupervisorData();
      fetchDepartmentName();
    } else {
      console.error('Invalid deptid:', deptid);
      notify.error('Invalid department ID');
    }
  }, [deptid]);

  const fetchDepartmentName = async () => {
    try {
      // Fetch department details to get the name
      const response = await API.get('/Dor/Counts');
      const department = response.data.find(dept => dept.departmentid === parseInt(deptid));
      if (department) {
        setDepartmentName(department.subject || `Department ${deptid}`);
      } else {
        setDepartmentName(`Department ${deptid}`);
      }
    } catch (error) {
      console.error('Error fetching department name:', error);
      setDepartmentName(`Department ${deptid}`);
    }
  };

  const fetchDepartmentSupervisorData = async () => {
    try {
      setLoading(true);
      console.log('Fetching supervisor data for deptId:', deptid);
      
      if (!deptid || deptid === 'undefined') {
        throw new Error('Invalid department ID');
      }
      
      const response = await API.get(`/Dor/DeptWiseSup?deptId=${deptid}`);
      console.log('Supervisor API response:', response.data);
      
      // Add serial numbers to the data
      const dataWithSerialNumbers = response.data.map((item, index) => ({
        ...item,
        key: item.supervisorId,
        srNo: index + 1,
      }));
      
      setData(dataWithSerialNumbers);
      setFilteredData(dataWithSerialNumbers);
    } catch (error) {
      console.error('Error fetching department supervisor data:', error);
      notify.error('Failed to load department supervisor data');
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
        item.supervisorName.toLowerCase().includes(value.toLowerCase()) ||
        (item.collegeName && item.collegeName.toLowerCase().includes(value.toLowerCase())) ||
        item.shodhnikId.toLowerCase().includes(value.toLowerCase())
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
        'Shodhanik Id': item.shodhnikId,
        'Name of Supervisor': item.supervisorName,
        'College Name': item.collegeName || 'N/A',
        'Total Seat': item.totalSeats,
        'Scholars': item.scholarCount,
        'Seats Available': item.available,
        'Seats for Admission': item.admissions
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // Sr. No.
        { wch: 15 }, // Shodhanik Id
        { wch: 25 }, // Name of Supervisor
        { wch: 35 }, // College Name
        { wch: 12 }, // Total Seat
        { wch: 10 }, // Scholars
        { wch: 15 }, // Seats Available
        { wch: 18 }, // Seats for Admission
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Department Supervisors');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Department_Supervisors_${deptid}_${currentDate}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      notification().success('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      notification().error('Failed to download Excel file');
    }
  };

  // Handle view supervisor profile
  const handleViewProfile = (record) => {
    navigate(`/director_panel/departments/${deptid}/${record.supervisorId}`);
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/director_panel/departments');
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
      title: 'Shodhanik Id',
      dataIndex: 'shodhnikId',
      key: 'shodhnikId',
      width: 150,
      sorter: (a, b) => a.shodhnikId.localeCompare(b.shodhnikId),
    },
    {
      title: 'Name of Supervisor',
      dataIndex: 'supervisorName',
      key: 'supervisorName',
      width: 250,
      sorter: (a, b) => a.supervisorName.localeCompare(b.supervisorName),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search supervisor name"
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
        record.supervisorName.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'College Name',
      dataIndex: 'collegeName',
      key: 'collegeName',
      width: 300,
      sorter: (a, b) => {
        const aName = a.collegeName || '';
        const bName = b.collegeName || '';
        return aName.localeCompare(bName);
      },
      render: (text) => text || 'N/A',
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
      dataIndex: 'available',
      key: 'available',
      width: 130,
      align: 'center',
      sorter: (a, b) => a.available - b.available,
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {value}
        </span>
      ),
    },
    {
      title: 'Seats for Admission',
      dataIndex: 'admissions',
      key: 'admissions',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.admission - b.admission,
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
      title: 'Profile',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        canview && (
          <Button
          module="general"
          action="read"
          label="Profile"
          size="sm"
          variant="outline"
          onClick={() => handleViewProfile(record)}
        />
        )
        
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <Breadcrumb.Item>
          <span 
            className="cursor-pointer text-blue-600 hover:text-blue-800"
            onClick={handleBack}
          >
            Departments
          </span>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{departmentName} Supervisors</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <Button
              module="general"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              variant="outline"
              size="sm"
            />
            <Title level={2} className="!mb-0">
              List of Supervisors in {departmentName}
            </Title>
          </div>
          <Button
            module="general"
            label="Download"
            icon={<DownloadOutlined />}
            onClick={downloadExcel}
            variant="solid"
            className="bg-green-600 hover:bg-green-700 border-green-600"
          />
        </div>
        
        {/* Search Bar */}
        <div className="flex justify-between items-center">
          <Search
            placeholder="Search supervisors..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            style={{ width: 400 }}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
          />
          <div className="text-gray-600">
            Total Supervisors: <span className="font-semibold">{filteredData.length}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {data.length}
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
            {data.reduce((sum, item) => sum + item.available, 0)}
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
              `${range[0]}-${range[1]} of ${total} supervisors`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 1400 }}
          size="middle"
          bordered
          className="supervisor-table"
        />
      </Card>

      <style jsx>{`
        .supervisor-table .ant-table-thead > tr > th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #495057;
        }
        
        .supervisor-table .ant-table-tbody > tr:hover > td {
          background-color: #f8f9fa;
        }
        
        .supervisor-table .ant-pagination {
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
};

export default DepartmentSupervisor;