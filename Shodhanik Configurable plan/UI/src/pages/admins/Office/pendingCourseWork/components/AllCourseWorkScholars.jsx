import { useEffect, useState } from 'react'
import { Table, Button, Space, Select, Row, Col } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import {hasPermission} from '@/services/hasPermissionService';


const AllCourseWorkScholars = ({ onSelectRow, refreshTrigger }) => {
  const [scholars, setScholars] = useState([])
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [loading, setLoading] = useState(false)
  const notify = notification()
  const canread = hasPermission('pending_course_work.read')
  

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await API.get('/Scholars/GetDistinctYears')
        if (response.data && Array.isArray(response.data)) {
          setYears(response.data)
          if (response.data.length > 0) {
            setSelectedYear(response.data[0])
          }
        }
      } catch (error) {
        notify.error('Failed to fetch years')
        console.error(error)
      }
    }
    fetchYears()
  }, [])

  useEffect(() => {
    if (selectedYear) {
      fetchScholars()
    }
  }, [selectedYear, refreshTrigger]) // Add refreshTrigger as dependency

  const fetchScholars = async () => {
    setLoading(true)
    try {
      // Add cache-busting timestamp to force fresh API call
      const timestamp = new Date().getTime()
      const response = await API.get(
        `/Scholars/GetCourseworkScholarsByYear/${selectedYear}?decisionnumber=0&t=${timestamp}`
      )
      if (response.data && Array.isArray(response.data)) {
        setScholars(response.data)
      }
    } catch (error) {
      notify.error('Failed to fetch scholars')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      filterSearch: true,
      onFilter: (value, record) =>
        record.name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Father Name',
      dataIndex: 'fName',
      key: 'fName',
      sorter: (a, b) => a.fName.localeCompare(b.fName),
    },
    {
      title: 'Mobile Number',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 130,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a, b) => a.email.localeCompare(b.email),
    },
    {
      title: 'Shodhanik ID',
      dataIndex: 'shodhanikId',
      key: 'shodhanikId',
      sorter: (a, b) => (a.shodhanikId || '').localeCompare(b.shodhanikId || ''),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {canread && (
            <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => onSelectRow(record)}
          >
            View
          </Button>
          )}
          
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row style={{ marginBottom: 16 }}>
        <Col>
          <Select
            placeholder="Select Academic Year"
            value={selectedYear}
            onChange={setSelectedYear}
            style={{ width: 200 }}
            options={years.map(year => ({
              label: year,
              value: year
            }))}
          />
        </Col>
      </Row>
      <Table
        columns={columns}
        dataSource={scholars}
        loading={loading}
        rowKey="sid"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} scholars`,
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  )
}

export default AllCourseWorkScholars
