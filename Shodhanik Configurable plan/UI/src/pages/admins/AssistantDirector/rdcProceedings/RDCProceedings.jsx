import { useState } from 'react';
import { Tabs } from 'antd';
//tab imports
import AllRDCProceedings from './components/AllRDCProceedings'
import EditRDCProceedings from './components/EditRDCProceedings'
import { hasPermission } from '@/services/hasPermissionService';
const RDCProceedings = () => {
    //permissions
    const canRead = hasPermission('rdc_proceedings_aad_1.read');
    const canApprove = hasPermission('rdc_proceedings_aad_1.approve');
    const canReject = hasPermission('rdc_proceedings_aad_1.reject');
    const canDownload = hasPermission('rdc_proceedings_aad_1.download');
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
            label: 'All RDC Proceedings',
            children: <AllRDCProceedings
                onSelectRow={handleSelectRow}
                canRead={canRead}
                canApprove={canApprove}
                canReject={canReject}
                canDownload={canDownload} />,
        },
        {
            key: '2',
            label: 'Edit RDC Proceedings',
            disabled: !selectedRecord,
            children: (
                <EditRDCProceedings
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
export default RDCProceedings