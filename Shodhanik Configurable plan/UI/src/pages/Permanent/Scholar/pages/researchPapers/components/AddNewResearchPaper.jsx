import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Upload, Checkbox, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import notification from '@/services/NotificationService';

const AddNewResearchPaper = ({ visible, onClose, onSubmit, loading, editingRecord }) => {
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [isDeclarationChecked, setIsDeclarationChecked] = useState(false);
    const { getSId } = useSelectedScholarAuthStore();
    const notify = notification();

    useEffect(() => {
        if (visible) {
            // Auto-populate form if editing
            if (editingRecord) {
                form.setFieldsValue({
                    titleOfPaper: editingRecord.titleOfPaper,
                    nameOfAuthors: editingRecord.authorName || editingRecord.authorNames?.join(', '),
                    nameOfJournal: editingRecord.nameOfJournal,
                    yearOfPublication: editingRecord.yearOfPb,
                    issnNo: editingRecord.issNo,
                    volume: editingRecord.volume,
                    pageNo: editingRecord.page,
                    citations: editingRecord.citations,
                    impactFactor: editingRecord.impactFactor,
                    websiteURL: editingRecord.webUrl,
                    listedAs: editingRecord.listedIn,
                    uggListNo: editingRecord.ugcListNo,
                    isRelatedToPhD: true
                });
                setIsDeclarationChecked(true);
                setFileList([]);
            } else {
                // Clear form for new entry
                form.resetFields();
                setFileList([]);
                setIsDeclarationChecked(false);
            }
        }
    }, [visible, editingRecord, form]);

    const handleFileChange = ({ fileList }) => setFileList(fileList);

    const validatePdfFile = (file) => {
        const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            notify.error('Only PDF files are allowed');
            setFileList([]);
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // Validate file is PDF if uploaded
            if (fileList[0]?.originFileObj) {
                if (!validatePdfFile(fileList[0].originFileObj)) {
                    return;
                }
            }

            const sId = getSId();
            if (!sId) {
                notify.error('Scholar ID not found');
                return;
            }

            const formData = new FormData();
            formData.append('SID', sId);
            formData.append('TitleOfPaper', values.titleOfPaper || '');
            formData.append('AuthorName', values.nameOfAuthors || '');
            formData.append('NameOfJournal', values.nameOfJournal || '');
            formData.append('YearOfPb', values.yearOfPublication || '');
            formData.append('Volume', values.volume || '');
            formData.append('IssNo', values.issnNo || '');
            formData.append('Page', values.pageNo || 0);
            formData.append('Citations', values.citations || '');
            formData.append('ImpactFactor', values.impactFactor || '');
            formData.append('WebUrl', values.websiteURL || '');
            formData.append('ListedIn', values.listedAs || '');
            formData.append('UGCListNo', values.uggListNo || '');
            formData.append('Status', 0);

            // FILE
            if (fileList[0]?.originFileObj) {
                formData.append('uploadPaper', fileList[0].originFileObj);
            }

            await onSubmit(formData);
            form.resetFields();
            setFileList([]);
            setIsDeclarationChecked(false);
        } catch (err) {
            console.error('Validation or submit error:', err);
        }
    };

    const handleClose = () => {
        form.resetFields();
        setFileList([]);
        setIsDeclarationChecked(false);
        onClose();
    };

    return (
        <Modal
            title={editingRecord ? "Edit Research Paper" : "Add Research Paper"}
            open={visible}
            onCancel={handleClose}
            width={1000}
            footer={[
                <Button key="close" onClick={handleClose}>Close</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleSubmit} disabled={!isDeclarationChecked}>
                    {editingRecord ? "Update Paper" : "Submit New Paper"}
                </Button>
            ]}
        >
            <Form form={form} layout="vertical">

                <Form.Item
                    label="Title of Paper"
                    name="titleOfPaper"
                    rules={[{ required: true, message: 'Please enter title of paper' }]}
                >
                    <Input placeholder="Enter title of paper" />
                </Form.Item>

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                        label="Name of Author(s)"
                        name="nameOfAuthors"
                        rules={[{ required: true, message: 'Please enter author names' }]}
                    >
                        <Input placeholder="Enter author names (e.g. John Doe, Jane Smith)" />
                    </Form.Item>

                    <Form.Item
                        label="Name of Journal"
                        name="nameOfJournal"
                        rules={[{ required: true, message: 'Please enter name of journal' }]}
                    >
                        <Input placeholder="Enter journal name" />
                    </Form.Item>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Form.Item
                        label="Year of Publication"
                        name="yearOfPublication"
                        rules={[{ required: true, message: 'Please enter year of publication' }]}
                    >
                        <Input type="number" className="w-full" max={new Date().getFullYear()} placeholder="YYYY" />
                    </Form.Item>

                    <Form.Item label="ISSN No." name="issnNo">
                        <Input placeholder="e.g. 1234-567X" />
                    </Form.Item>

                    <Form.Item label="Volume" name="volume">
                        <Input placeholder="Volume number" />
                    </Form.Item>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Form.Item label="Page No." name="pageNo">
                        <Input type="number" className="w-full" min={0} placeholder="Page number" />
                    </Form.Item>

                    <Form.Item label="Citations" name="citations">
                        <Input type="number" className="w-full" min={0} placeholder="Total citations" />
                    </Form.Item>

                    <Form.Item label="Impact Factor" name="impactFactor">
                        <Input placeholder="Impact factor (e.g. 3.5)" />
                    </Form.Item>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Form.Item label="Website URL" name="websiteURL">
                        <Input type="url" placeholder="https://..." />
                    </Form.Item>

                    <Form.Item
                        label="Listed as"
                        name="listedAs"
                        rules={[{ required: true, message: 'Please select listing' }]}
                    >
                        <Select
                            placeholder="--Select Listing--"
                            onChange={(val) => {
                                if (val !== 'UGC') {
                                    form.setFieldValue('uggListNo', null);
                                }
                            }}
                        >
                            <Select.Option value="SCI">SCI</Select.Option>
                            <Select.Option value="SCOPUS">SCOPUS</Select.Option>
                            <Select.Option value="UGC">UGC</Select.Option>
                            <Select.Option value="Other">Other</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.listedAs !== currentValues.listedAs}
                    >
                        {({ getFieldValue }) => (
                            <Form.Item label="UGC List No." name="uggListNo">
                                <Input disabled={getFieldValue('listedAs') !== 'UGC'} placeholder="UGC Care list number" />
                            </Form.Item>
                        )}
                    </Form.Item>
                </div>

                <Form.Item label="Upload Paper (PDF)">
                    <Upload
                        beforeUpload={() => false}
                        fileList={fileList}
                        onChange={handleFileChange}
                        maxCount={1}
                        accept=".pdf"
                    >
                        <Button icon={<UploadOutlined />}>Choose file</Button>
                    </Upload>
                </Form.Item>

                <Form.Item 
                    name="isRelatedToPhD" 
                    valuePropName="checked"
                    rules={[{ 
                        validator: (_, value) => {
                            if (value) {
                                return Promise.resolve();
                            }
                            return Promise.reject(new Error('Please accept the declaration'));
                        }
                    }]}
                >
                    <Checkbox onChange={(e) => setIsDeclarationChecked(e.target.checked)}>
                        I declare that this publication is related to my Ph.D work.
                    </Checkbox>
                </Form.Item>

            </Form>
        </Modal>
    );
};

export default AddNewResearchPaper;
