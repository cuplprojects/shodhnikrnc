import { useState, useEffect } from 'react'
import { Table, Modal, Form, Input, Select, DatePicker, Button, Space, Tag } from 'antd'
import { EyeOutlined, PlusOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons'
import API from '@/services/API'
import notification from '@/services/NotificationService'
import dayjs from 'dayjs'
import {hasPermission} from '@/services/hasPermissionService';


const { Option } = Select
const { TextArea } = Input

const RDC = () => {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [addForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [departmentMembers, setDepartmentMembers] = useState([])
  const canview = hasPermission('rdc_committee.read')
  const canupdate= hasPermission('rdc_committee.update')
  const cancreate = hasPermission('rdc_committee.create')

  // Prepare department data for table
  const departmentTableData = departments.map((dept, index) => ({
    key: dept.departmentId,
    srNo: index + 1,
    departmentId: dept.departmentId,
    departmentName: dept.departmentName,
    membersCount: dept.members.length,
    members: dept.members
  }))

  // Fetch departments from API
  useEffect(() => {
    fetchDepartmentsWithMembers()
  }, [])

  const fetchDepartmentsWithMembers = async () => {
    try {
      setLoading(true)
      const response = await API.get('/Dor/departments-with-members')
      if (response.data && Array.isArray(response.data)) {
        setDepartments(response.data)
      }
    } catch (error) {
      console.error('Error fetching departments with members:', error)
      notification().error('Failed to fetch departments')
    } finally {
      setLoading(false)
    }
  }

  // Fetch members for a specific department
  const fetchDepartmentMembers = async (departmentId) => {
    try {
      setLoading(true)
      const response = await API.get(`/Dor/${departmentId}`)
      if (response.data && Array.isArray(response.data)) {
        setDepartmentMembers(response.data)
      }
    } catch (error) {
      console.error('Error fetching department members:', error)
      notification().error('Failed to fetch department members')
    } finally {
      setLoading(false)
    }
  }

  // Table columns for departments
  const columns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Department Name',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 300
    },
    {
      title: 'Members',
      key: 'members',
      width: 400,
      render: (_, record) => {
        const members = record.members
        if (members.length === 0) {
          return <span className="text-gray-500">No members added</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {members.slice(0, 3).map((member, index) => (
              <Tag key={index} color="blue" className="mb-1">
                {member.name}
              </Tag>
            ))}
            {members.length > 3 && (
              <Tag color="default">+{members.length - 3} more</Tag>
            )}
          </div>
        )
      }
    },
    {
      title: 'Total Members',
      key: 'membersCount',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <span className="font-semibold text-blue-600">{record.membersCount}</span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space>
          {
            canview && (
              <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewMembers(record)}
            title="View Members"
          />
            )
          }
          {
            cancreate && (
              <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={() => handleAddMember(record)}
            title="Add Member"
          />
            )
          }
          
        </Space>
      )
    }
  ]

  // Columns for members table in view modal
  const memberColumns = [
    {
      title: 'Sr. No.',
      key: 'srNo',
      width: 80,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200
    },
    {
      title: 'Contact No.',
      dataIndex: 'contactNo',
      key: 'contactNo',
      width: 150
    },
    {
      title: 'Period',
      key: 'period',
      width: 200,
      render: (_, record) => {
        const fromDate = record.from ? dayjs(record.from).format('DD/MM/YYYY') : ''
        const toDate = record.to ? dayjs(record.to).format('DD/MM/YYYY') : ''
        return `${fromDate} - ${toDate}`
      }
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      width: 250,
      render: (text) => (
        <div style={{ whiteSpace: 'pre-line', fontSize: '12px' }}>
          {text}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          {canupdate && (
             <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditMember(record)}
          />
          )}
         
        </Space>
      )
    }
  ]

  const handleViewMembers = async (department) => {
    setSelectedDepartment(department)
    await fetchDepartmentMembers(department.departmentId)
    setShowViewModal(true)
  }

  const handleAddMember = (department) => {
    setSelectedDepartment(department)
    addForm.resetFields()
    addForm.setFieldsValue({ departmentId: department.departmentId })
    setShowAddModal(true)
  }

  const handleEditMember = (member) => {
    setEditingMember(member)
    setShowEditModal(true)
    
    // Pre-populate edit form
    editForm.setFieldsValue({
      departmentId: member.departmentId,
      name: member.name,
      email: member.email,
      contactNo: member.contactNo,
      address: member.address,
      from: member.from ? dayjs(member.from) : null,
      to: member.to ? dayjs(member.to) : null
    })
  }

  const handleSaveNew = async () => {
    try {
      console.log('Starting form validation...')
      const values = await addForm.validateFields()
      console.log('Form values:', values)
      
      // Build API payload according to your specification
      const apiPayload = {
        id: 0,
        departmentId: values.departmentId,
        name: values.name,
        email: values.email,
        contactNo: values.contactNo,
        address: values.address,
        from: values.from ? values.from.toISOString() : null,
        to: values.to ? values.to.toISOString() : null
      }

      console.log('API Payload for Add:', apiPayload)
      setLoading(true)
      
      const response = await API.post('/Dor/AddRDC', apiPayload)
      console.log('API Response:', response)
      console.log('Response status:', response.status)
      console.log('Response data:', response.data)
      
      // Check if the request was successful (status 200-299)
      if (response.status >= 200 && response.status < 300) {
        console.log('Success! Closing modal and refreshing data...')
        
        notification().success('RDC member added successfully')
        
        // Close modal and reset form first
        setShowAddModal(false)
        addForm.resetFields()
        setSelectedDepartment(null)
        
        // Then refresh data
        console.log('Refreshing departments data...')
        await fetchDepartmentsWithMembers()
        
        // Update department members if view modal is open
        if (showViewModal && selectedDepartment && selectedDepartment.departmentId === values.departmentId) {
          console.log('Refreshing department members...')
          await fetchDepartmentMembers(selectedDepartment.departmentId)
        }
        
        console.log('All operations completed successfully')
      } else {
        console.log('Unexpected response status:', response.status)
        notification().error('Unexpected response from server')
      }
      
    } catch (error) {
      console.error('Error saving RDC member:', error)
      
      // Handle validation errors
      if (error.errorFields) {
        console.log('Validation errors:', error.errorFields)
        notification().error('Please fill all required fields correctly')
        return
      }
      
      // Handle API errors
      if (error.response) {
        console.log('API Error Response:', error.response)
        console.log('Error status:', error.response.status)
        console.log('Error data:', error.response.data)
        
        const errorMessage = error.response?.data?.message || error.response?.data?.error || `Server error (${error.response.status})`
        notification().error(`Error: ${errorMessage}`)
      } else if (error.request) {
        console.log('Network Error:', error.request)
        notification().error('Network error. Please check your connection.')
      } else {
        console.log('Unknown Error:', error.message)
        notification().error('An unexpected error occurred')
      }
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    try {
      console.log('Starting edit form validation...')
      const values = await editForm.validateFields()
      console.log('Edit form values:', values)
      
      // Build API payload for update
      const apiPayload = {
        id: editingMember.id,
        departmentId: values.departmentId,
        name: values.name,
        email: values.email,
        contactNo: values.contactNo,
        address: values.address,
        from: values.from ? values.from.toISOString() : null,
        to: values.to ? values.to.toISOString() : null
      }

      console.log('API Payload for Update:', apiPayload)
      setLoading(true)
      
      const response = await API.put(`/Dor/${editingMember.id}`, apiPayload)
      console.log('Update API Response:', response)
      console.log('Update response status:', response.status)
      
      // Check if the request was successful
      if (response.status >= 200 && response.status < 300) {
        console.log('Update successful! Closing modal and refreshing data...')
        
        notification().success('RDC member updated successfully')
        
        // Close modal and reset form first
        setShowEditModal(false)
        editForm.resetFields()
        setEditingMember(null)
        
        // Then refresh data
        console.log('Refreshing departments data after update...')
        await fetchDepartmentsWithMembers()
        
        // Update department members if view modal is open
        if (showViewModal && selectedDepartment) {
          console.log('Refreshing department members after update...')
          await fetchDepartmentMembers(selectedDepartment.departmentId)
        }
        
        console.log('Update operations completed successfully')
      } else {
        console.log('Unexpected update response status:', response.status)
        notification().error('Unexpected response from server')
      }
      
    } catch (error) {
      console.error('Error updating RDC member:', error)
      
      // Handle validation errors
      if (error.errorFields) {
        console.log('Update validation errors:', error.errorFields)
        notification().error('Please fill all required fields correctly')
        return
      }
      
      // Handle API errors
      if (error.response) {
        console.log('Update API Error Response:', error.response)
        const errorMessage = error.response?.data?.message || error.response?.data?.error || `Update failed (${error.response.status})`
        notification().error(`Error: ${errorMessage}`)
      } else if (error.request) {
        console.log('Update Network Error:', error.request)
        notification().error('Network error. Please check your connection.')
      } else {
        console.log('Update Unknown Error:', error.message)
        notification().error('An unexpected error occurred during update')
      }
    } finally {
      console.log('Setting loading to false after update')
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">RDC Committee</h2>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchDepartmentsWithMembers()}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {/* Departments Table */}
        <Table
          columns={columns}
          dataSource={departmentTableData}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            pageSizeOptions: ['10', '25', '50', '100']
          }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </div>

      {/* View Members Modal */}
      <Modal
        title={`RDC Members - ${selectedDepartment?.departmentName || ''}`}
        open={showViewModal}
        onCancel={() => {
          setShowViewModal(false)
          setSelectedDepartment(null)
          setDepartmentMembers([])
        }}
        footer={[
          <Button key="close" onClick={() => {
            setShowViewModal(false)
            setSelectedDepartment(null)
            setDepartmentMembers([])
          }}>
            Close
          </Button>,
          cancreate && (
             <Button 
            key="add" 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setShowViewModal(false)
              handleAddMember(selectedDepartment)
            }}
          >
            Add Member
          </Button>
          )
         
        ]}
        width={1200}
      >
        <Table
          columns={memberColumns}
          dataSource={departmentMembers.map((member, index) => ({
            ...member,
            key: member.id || index
          }))}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} members`
          }}
          scroll={{ x: 1000 }}
          size="small"
        />
      </Modal>

      {/* Add New Member Modal */}
      <Modal
        title={selectedDepartment ? `Add Member to ${selectedDepartment.departmentName}` : "Add New RDC Member"}
        open={showAddModal}
        onCancel={() => {
          setShowAddModal(false)
          addForm.resetFields()
          setSelectedDepartment(null)
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setShowAddModal(false)
            addForm.resetFields()
            setSelectedDepartment(null)
          }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleSaveNew} loading={loading}>
            Save Member
          </Button>
        ]}
        width={800}
        maskClosable={false}
        keyboard={false}
      >
        <Form
          form={addForm}
          layout="vertical"
          className="mt-4"
          onFinish={handleSaveNew}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="departmentId"
              label="Department"
              rules={[{ required: true, message: 'Please select a department' }]}
            >
              <Select
                placeholder="Select Department"
                loading={loading}
                showSearch
                disabled={selectedDepartment ? true : false}
              >
                {departments.map(dept => (
                  <Option key={dept.departmentId} value={dept.departmentId}>
                    {dept.departmentName}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="name"
              label="Member Name"
              rules={[
                { required: true, message: 'Please enter member name' },
                { whitespace: true, message: 'Name cannot be empty' }
              ]}
            >
              <Input placeholder="Enter member name" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input placeholder="Enter email address" />
            </Form.Item>

            <Form.Item
              name="contactNo"
              label="Contact Number"
              rules={[
                { required: true, message: 'Please enter contact number' },
                { pattern: /^[0-9]{10}$/, message: 'Please enter a valid 10-digit contact number' }
              ]}
            >
              <Input placeholder="Enter contact number" maxLength={10} />
            </Form.Item>

            <Form.Item
              name="from"
              label="Period From"
              rules={[{ required: true, message: 'Please select start date' }]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                format="DD/MM/YYYY"
                placeholder="Select start date"
              />
            </Form.Item>

            <Form.Item
              name="to"
              label="Period To"
              rules={[{ required: true, message: 'Please select end date' }]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                format="DD/MM/YYYY"
                placeholder="Select end date"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="address"
            label="Address"
            rules={[
              { required: true, message: 'Please enter address' },
              { whitespace: true, message: 'Address cannot be empty' }
            ]}
          >
            <TextArea 
              rows={3} 
              placeholder="Enter complete address"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        title="Edit RDC Member"
        open={showEditModal}
        onCancel={() => {
          setShowEditModal(false)
          editForm.resetFields()
          setEditingMember(null)
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setShowEditModal(false)
            editForm.resetFields()
            setEditingMember(null)
          }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleSaveEdit} loading={loading}>
            Update Member
          </Button>
        ]}
        width={800}
        maskClosable={false}
        keyboard={false}
      >
        <Form
          form={editForm}
          layout="vertical"
          className="mt-4"
          onFinish={handleSaveEdit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="departmentId"
              label="Department"
              rules={[{ required: true, message: 'Please select a department' }]}
            >
              <Select
                placeholder="Select Department"
                loading={loading}
                showSearch
              >
                {departments.map(dept => (
                  <Option key={dept.departmentId} value={dept.departmentId}>
                    {dept.departmentName}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="name"
              label="Member Name"
              rules={[
                { required: true, message: 'Please enter member name' },
                { whitespace: true, message: 'Name cannot be empty' }
              ]}
            >
              <Input placeholder="Enter member name" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input placeholder="Enter email address" />
            </Form.Item>

            <Form.Item
              name="contactNo"
              label="Contact Number"
              rules={[
                { required: true, message: 'Please enter contact number' },
                { pattern: /^[0-9]{10}$/, message: 'Please enter a valid 10-digit contact number' }
              ]}
            >
              <Input placeholder="Enter contact number" maxLength={10} />
            </Form.Item>

            <Form.Item
              name="from"
              label="Period From"
              rules={[{ required: true, message: 'Please select start date' }]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                format="DD/MM/YYYY"
                placeholder="Select start date"
              />
            </Form.Item>

            <Form.Item
              name="to"
              label="Period To"
              rules={[{ required: true, message: 'Please select end date' }]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                format="DD/MM/YYYY"
                placeholder="Select end date"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="address"
            label="Address"
            rules={[
              { required: true, message: 'Please enter address' },
              { whitespace: true, message: 'Address cannot be empty' }
            ]}
          >
            <TextArea 
              rows={3} 
              placeholder="Enter complete address"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RDC