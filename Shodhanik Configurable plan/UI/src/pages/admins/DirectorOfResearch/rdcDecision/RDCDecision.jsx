import {useState } from 'react'
import { Tabs } from 'antd'

//tab imports
import AllRDCDecision from './components/AllRDCDecision'
import EditRDCDecision from './components/EditRdcDecision';
import { hasPermission } from '@/services/hasPermissionService';

const RDCDecision = () => {
  const canRead = hasPermission('rdc_proceedings_dor.read');
    const canApprove = hasPermission('rdc_proceedings_dor.approve');
    const canReject = hasPermission('rdc_proceedings_dor.reject');
    const canDownload = hasPermission('rdc_proceedings_dor.download');
    if (!canRead) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">You do not have permission to view this page.</p>
                </div>
            </div>
        );
    }
    const [activeTab, setActiveTab] = useState('1')
    const [selectedRecord, setSelectedRecord] = useState(null)

    const handleSelectRow = (record) => {
        setSelectedRecord(record)
        setActiveTab('2')
    }

    const handleBackToList = () => {
        setSelectedRecord(null)
        setActiveTab('1')
    }


    const items = [
        {
            key: '1',
            label: 'All RDC Decision',
            children: <AllRDCDecision onSelectRow={handleSelectRow} canRead={canRead}
                    canApprove={canApprove}
                    canReject={canReject}
                    canDownload={canDownload} />,
        },
        {
            key: '2',
            label: 'Edit RDC Decision',
            disabled: !selectedRecord,
            children: (
                <EditRDCDecision
                    selectedRecord={selectedRecord}
                    onBack={handleBackToList}
                     canRead={canRead}
                    canApprove={canApprove}
                    canReject={canReject}
                    canDownload={canDownload}
                />
            ),
        },
    ]

    return (
        <div style={{ padding: '20px' }}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
        </div>
    )
}

export default RDCDecision
