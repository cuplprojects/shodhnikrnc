import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { updatePhdApplicationStatus } from '@/services/phdAdmissionService';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';

const StatusUpdateModal = ({ visible, onClose, applicationData, onStatusUpdated }) => {
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const notify = notification();

  useEffect(() => {
    if (visible && applicationData) {
      // Initialize with current status
      const currentStatus = applicationData.scholar?.decisionStatus;
      if (currentStatus === 'ApplicationScreeningPassed' || currentStatus === 3) {
        setStatus('ApplicationScreeningPassed');
      } else if (currentStatus === 'ApplicationScreeningRejected' || currentStatus === 2) {
        setStatus('ApplicationScreeningRejected');
      } else {
        setStatus('');
      }
      setRemarks(applicationData.scholar?.rejectReason || '');
    }
  }, [visible, applicationData]);

  const handleSubmit = async () => {
    if (!status) {
      notify.error('Please select a status');
      return;
    }

    if (status === 'ApplicationScreeningRejected' && !remarks.trim()) {
      notify.error('Remarks are required for rejection');
      return;
    }

    const confirmed = await confirm({
      title: 'Confirm Status Update',
      message: `Are you sure you want to ${status === 'ApplicationScreeningPassed' ? 'accept' : 'reject'} this application?`
    });

    if (!confirmed) return;

    setSubmitting(true);
    try {
      const statusValue = status === 'ApplicationScreeningPassed' ? 3 : 2;
      
      const requestData = {
        DecisionStatus: statusValue,
        RejectReason: remarks.trim() || null
      };

      await updatePhdApplicationStatus(applicationData.scholar.sid, requestData);

      notify.success('Application status updated successfully');
      onStatusUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating application status:', error);
      notify.error('Failed to update application status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setStatus('');
      setRemarks('');
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Update Application Status
          </h3>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Application Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Application</div>
            <div className="font-medium">{applicationData?.scholar?.name}</div>
            <div className="text-sm text-gray-600">
              ID: {applicationData?.scholar?.applicationNo || applicationData?.scholar?.sid}
            </div>
          </div>

          {/* Status Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Application Status:
            </label>
            
            <div className="space-y-3">
              {/* Accept Option */}
              <div 
                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  status === 'ApplicationScreeningPassed' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-green-300'
                }`}
                onClick={() => setStatus('ApplicationScreeningPassed')}
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="ApplicationScreeningPassed"
                    checked={status === 'ApplicationScreeningPassed'}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                  />
                  <span className="ml-2 text-green-700 font-medium">
                    ✓ Application Screening Passed
                  </span>
                </label>
              </div>

              {/* Reject Option */}
              <div 
                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  status === 'ApplicationScreeningRejected' 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-gray-200 hover:border-red-300'
                }`}
                onClick={() => setStatus('ApplicationScreeningRejected')}
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="ApplicationScreeningRejected"
                    checked={status === 'ApplicationScreeningRejected'}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="ml-2 text-red-700 font-medium">
                    ✗ Application Screening Rejected
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks:
              {status === 'ApplicationScreeningRejected' && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks for the status update..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
            module="general"
            label="Cancel"
          />
          <Button
            variant="solid"
            onClick={handleSubmit}
            loading={submitting}
            module="phd_applications"
            action="update"
            label="Update Status"
          />
        </div>
      </div>
    </div>
  );
};

export default StatusUpdateModal;