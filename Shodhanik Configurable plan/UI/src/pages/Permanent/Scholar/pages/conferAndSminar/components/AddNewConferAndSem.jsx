import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, DatePicker, Upload, Checkbox, Button } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore'
import dayjs from 'dayjs'

const AddNewConferAndSem = ({ visible, onClose, onSubmit, loading, editingRecord }) => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState([])
  const [isDeclarationChecked, setIsDeclarationChecked] = useState(false)
  const { getSId } = useSelectedScholarAuthStore()

  useEffect(() => {
    if (visible) {
      // Auto-populate form if editing
      if (editingRecord) {
        form.setFieldsValue({
          titleOfPaper: editingRecord.titleOfPaper,
          nameOfAuthors: editingRecord.authorName,
          nameOfConference: editingRecord.nameOfConference,
          levelOfConference: editingRecord.levelOfConference,
          sponsoringAgency: editingRecord.sponsoringAgency,
          startingDate: editingRecord.startingDateRaw ? dayjs(editingRecord.startingDateRaw) : null,
          endingDate: editingRecord.endingDateRaw ? dayjs(editingRecord.endingDateRaw) : null,
          organizedBy: editingRecord.organizedBy,
          place: editingRecord.place,
          conferenceStatus : 0,
          isRelatedToPhD: editingRecord.presentationCertificate === 'true'
        })
      } else {
        // Clear form for new entry
        form.resetFields()
        setFileList([])
      }
    }
  }, [visible, editingRecord])

  const handleFileChange = ({ fileList: newFileList }) => setFileList(newFileList)

  const handleSubmit = async () => {

    try {
      const values = await form.validateFields()
      const formData = new FormData()
      const sId = getSId()
      if (!sId) return

      formData.append('SID', sId)
      formData.append('TitleOfPaper', values.titleOfPaper)
      formData.append('AuthorName', values.nameOfAuthors)
      formData.append('NameOfConference', values.nameOfConference)
      formData.append('LevelOfConference', values.levelOfConference)
      formData.append('SponsoringAgency', values.sponsoringAgency || '')
      formData.append('StartingDate', values.startingDate?.toISOString())
      formData.append('EndingDate', values.endingDate?.toISOString())
      formData.append('OrganizedBy', values.organizedBy)
      formData.append('Place', values.place)
      formData.append('ConferenceStatus', values.conferenceStatus || 0)


      // ✅ Append file with correct key
      if (fileList[0]?.originFileObj) {
        formData.append('UploadPaper', fileList[0].originFileObj)
      }

      // ✅ Append PhD checkbox separately if backend expects boolean
      formData.append('IsRelatedToPhD', values.isRelatedToPhD ? 'true' : 'false')

      await onSubmit(formData)
      form.resetFields()
      setFileList([])
    } catch (error) {
      console.error('Form validation failed:', error)
    }
  }

  const handleClose = () => {
    form.resetFields()
    setFileList([])
    setIsDeclarationChecked(false)
    onClose()
  }

  return (
    <Modal
      title={editingRecord ? "Edit Conference/Seminar" : "Add Conference/Seminar"}
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={[
        <Button key="close" onClick={handleClose}>Close</Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit} disabled={!isDeclarationChecked}>
          {editingRecord ? "Update" : "Submit New Paper"}
        </Button>
      ]}
    >
      <Form form={form} layout="vertical" autoComplete="off">
        <Form.Item
          label="Title of Paper Presented"
          name="titleOfPaper"
          rules={[{ required: true, message: 'Please enter title of paper' }]}
        >
          <Input placeholder="Enter title of paper" />
        </Form.Item>

        <Form.Item
          label="Name of Author"
          name="nameOfAuthors"
          rules={[{ required: true, message: 'Please enter author names' }]}
        >
          <Input placeholder="Enter author names" />
        </Form.Item>

        <Form.Item
          label="Name of Conference/Seminar"
          name="nameOfConference"
          rules={[{ required: true, message: 'Please enter conference/seminar name' }]}
        >
          <Input placeholder="Enter conference/seminar name" />
        </Form.Item>

        <div className="grid grid-cols-3 gap-4">
          <Form.Item
            label="Level of Conference/Seminar"
            name="levelOfConference"
            rules={[{ required: true, message: 'Please select level' }]}
          >
            <Select placeholder="--Select--">
              <Select.Option value="International">International</Select.Option>
              <Select.Option value="National">National</Select.Option>
              <Select.Option value="State">State</Select.Option>
              <Select.Option value="University">University</Select.Option>
              <Select.Option value="Other">Other</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Starting Date"
            name="startingDate"
            rules={[{ required: true, message: 'Please select starting date' }]}
          >
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            label="Ending Date"
            name="endingDate"
            rules={[{ required: true, message: 'Please select ending date' }]}
          >
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            label="Upload Presentation Certificate (.pdf upto 2 MB)"
            
            rules={[{ required: true, message: 'Please upload the certificate' }]}
          >
            <Upload
              fileList={fileList}
              onChange={handleFileChange}
              beforeUpload={() => false}
              accept=".pdf"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Choose file</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Organized By"
            name="organizedBy"
            rules={[{ required: true, message: 'Please enter organizer' }]}
          >
            <Input placeholder="Enter organizer name" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            label="Place"
            name="place"
            rules={[{ required: true, message: 'Please enter place' }]}
          >
            <Input placeholder="Enter place/location" />
          </Form.Item>

          <Form.Item
            label="Sponsoring Agency"
            name="sponsoringAgency"
          >
            <Input placeholder="Enter sponsoring agency" />
          </Form.Item>
        </div>

        <Form.Item
          name="isRelatedToPhD"
          valuePropName="checked"
          rules={[{ 
            validator: (_, value) => {
              if (value) {
                return Promise.resolve()
              }
              return Promise.reject(new Error('Please accept the declaration'))
            }
          }]}
        >
          <Checkbox onChange={(e) => setIsDeclarationChecked(e.target.checked)}>
            I hereby declare that Presented Paper is related to my Ph.D. Work.
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AddNewConferAndSem
