import React, { useState, useEffect } from 'react';
import { Table, Input, Select, Card, Space, Button, Modal, Form, InputNumber, message } from 'antd';
import { SearchOutlined, CreditCardOutlined } from '@ant-design/icons';
import { scholarService } from '@/services/scholarService';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import API from '@/services/API'
import notification from '@/services/NotificationService'

const { Option } = Select;

const FeePayments = () => {
  const [paymentsData, setPaymentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [form] = Form.useForm();
  
  const { getSId } = useSelectedScholarAuthStore();
  const { fetchPendingPaymentsCount } = useSelectedScholarAuthStore();
  const notify = notification();

  useEffect(() => {
    const fetchPaymentsData = async () => {
      try {
        setLoading(true);
        const sId = getSId();
        
        if (!sId) {
          setError('Scholar ID not found');
          return;
        }

        const response = await API.get(`/ScholarPayments/by-sid/${sId}`)
        if (response.data && Array.isArray(response.data)) {
          const mappedData = response.data.map((payment, index) => ({
            key: payment.spid,
            srNo: index + 1,
            spid: payment.spid,
            feesFor: payment.feeCategoryName || payment.category || '-',
            amount: payment.feeAmount || '-',
            status: getPaymentStatus(payment.paymentStatus),
            paymentStatus: payment.paymentStatus,
            paymentDate: payment.paymentDate,
            remark: payment.remark,
            transactionID: payment.transactionID,
          }))
          setPaymentsData(mappedData)
        } else {
          setPaymentsData([])
        }
      } catch (err) {
        console.error('Error fetching payments data:', err);
        notify.error('Failed to load fee payments data');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentsData();
  }, [getSId]);

  const getPaymentStatus = (status) => {
    switch (status) {
      case 0:
        return 'Pending'
        case 1:
        return 'Failed'
        case 2:
          return 'Completed'
      case 3:
        return 'Cancelled'
      default:
        return 'Unknown'
    }
  }

  const handleSearch = (value) => {
    setSearchText(value);
    // Implement search logic here
  };

  const handlePageSizeChange = (value) => {
    setPageSize(value);
  };

  const handleMakePayment = (record) => {
    setSelectedPayment(record);
    form.resetFields();
    form.setFieldsValue({
      amount: record.amount,
    });
    setPaymentModalVisible(true);
  };

  //<--- payments are not made here , only showing status
  const handlePaymentSubmit = async (values) => {
    setPaymentSubmitting(true);
    try {
      // Call API to update payment status
      const paymentStatus = 2; // 1 for success (dummy payment)
      const remark = 'Payment processed successfully';
      
      await API.patch(`/ScholarPayments/status/${selectedPayment.spid}?status=${paymentStatus}&remark=${encodeURIComponent(remark)}`)
      
      notify.success('Payment processed successfully!');
      setPaymentModalVisible(false);
      form.resetFields();
      
      // Refresh the payments data
      const sId = getSId();
      const response = await API.get(`/ScholarPayments/by-sid/${sId}`)
      if (response.data && Array.isArray(response.data)) {
        const mappedData = response.data.map((payment, index) => ({
          key: payment.spid,
          srNo: index + 1,
          spid: payment.spid,
          feesFor: payment.feeCategoryName || payment.category || '-',
          amount: payment.feeAmount || '-',
          status: getPaymentStatus(payment.paymentStatus),
          paymentStatus: payment.paymentStatus,
          paymentDate: payment.paymentDate,
          remark: payment.remark,
          transactionID: payment.transactionID,
        }))
        setPaymentsData(mappedData)
      }

      // Update pending payments count in store
      await fetchPendingPaymentsCount();
    } catch (err) {
      message.error('Payment processing failed');
      console.error(err);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handlePaymentCancel = () => {
    setPaymentModalVisible(false);
    form.resetFields();
  };

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
      title: 'Fees For',
      dataIndex: 'feesFor',
      key: 'feesFor',
      ellipsis: true,
      sorter: (a, b) => (a.feesFor || '').localeCompare(b.feesFor || ''),
    },
    {
      title: 'Fee Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'center',
      sorter: (a, b) => {
        const amountA = typeof a.amount === 'number' ? a.amount : 0
        const amountB = typeof b.amount === 'number' ? b.amount : 0
        return amountA - amountB
      },
      render: (amount) => amount && amount !== '-' ? `₹${amount}` : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
      render: (status) => {
        let color = 'default'
        if (status === 'Pending') color = 'orange'
        if (status === 'Completed') color = 'green'
        if (status === 'Failed') color = 'red'
        if (status === 'Cancelled') color = 'red'
        return <span style={{ color }}>{status}</span>
      },
    },
    {
      title: 'Payment Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 140,
      align: 'center',
      sorter: true,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Remark',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<CreditCardOutlined />}
          onClick={() => handleMakePayment(record)}
          disabled={record.paymentStatus === 2}
        >
          Pay
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading fee payments data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br p-2 from-gray-50 to-gray-100 rounded-2xl">
      <div className="p-1">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white rounded-lg shadow-sm mb-3 p-2">
          <h1 className="text-lg font-semibold flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
            Payments
          </h1>
        </div>

        {/* Controls Section */}
        <Card className="shadow-sm mb-3" bodyStyle={{ padding: '12px' }}>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show</span>
              <Select
                value={pageSize}
                onChange={handlePageSizeChange}
                size="small"
                style={{ width: 70 }}
              >
                <Option value={10}>10</Option>
                <Option value={25}>25</Option>
                <Option value={50}>50</Option>
                <Option value={100}>100</Option>
              </Select>
              <span className="text-sm text-gray-600">entries</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Search:</span>
              <Input
                placeholder=""
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                size="small"
                style={{ width: 200 }}
                suffix={<SearchOutlined className="text-gray-400" />}
              />
            </div>
          </div>
        </Card>

        {/* Payments Table */}
        <Card className="shadow-sm" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={paymentsData}
            loading={loading}
            pagination={{
              pageSize: pageSize,
              showSizeChanger: false,
              showQuickJumper: false,
              showTotal: (total, range) => 
                `Showing ${range[0]} to ${range[1]} of ${total} entries`,
              itemRender: (current, type, originalElement) => {
                if (type === 'prev') {
                  return <span className="text-blue-600 cursor-pointer">{"<"}</span>;
                }
                if (type === 'next') {
                  return <span className="text-blue-600 cursor-pointer">{">"}</span>;
                }
                return originalElement;
              },
            }}
            size="small"
            locale={{
              emptyText: (
                <div className="py-8 text-center text-gray-500">
                  <div className="text-base">0 Record Available</div>
                </div>
              ),
            }}
            className="fee-payments-table"
            scroll={{ x: 800 }}
          />
        </Card>
      </div>

      {/* Payment Modal */}
      <Modal
        title="Make Payment"
        open={paymentModalVisible}
        onCancel={handlePaymentCancel}
        footer={null}
        width={500}
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Fees For</label>
                  <div className="text-slate-800 mt-1">{selectedPayment.feesFor}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Amount</label>
                  <div className="text-slate-800 mt-1 text-lg font-semibold">₹{selectedPayment.amount}</div>
                </div>
              </div>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handlePaymentSubmit}
            >
              <Form.Item
                label="Card Number"
                name="cardNumber"
              >
                <Input placeholder="1234 5678 9012 3456" maxLength={16} />
              </Form.Item>

              <div className="grid grid-cols-2 gap-4">
                <Form.Item
                  label="Expiry Date"
                  name="expiryDate"
                >
                  <Input placeholder="MM/YY" maxLength={5} />
                </Form.Item>

                <Form.Item
                  label="CVV"
                  name="cvv"
                >
                  <Input placeholder="123" maxLength={4} type="password" />
                </Form.Item>
              </div>

              <Form.Item
                label="Cardholder Name"
                name="cardholderName"
              >
                <Input placeholder="John Doe" />
              </Form.Item>

              <div className="flex gap-2 justify-end">
                <Button onClick={handlePaymentCancel}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={paymentSubmitting}>
                  Pay ₹{selectedPayment.amount}
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeePayments;