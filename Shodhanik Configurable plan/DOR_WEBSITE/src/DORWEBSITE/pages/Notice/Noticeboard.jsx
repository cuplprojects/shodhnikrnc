import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import API from '@/services/API';

const Noticeboard = ({ isOpen, onClose }) => {
  const [noticeboardNotices, setNoticeboardNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch noticeboard notices from API
  const fetchNoticeboardNotices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get('/NoticeboardNotices');
      if (response.data.success && response.data.data) {
        const notices = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        setNoticeboardNotices(notices.filter(notice => notice.isActive));
      }
    } catch (err) {
      setError('Failed to fetch notices');
      console.error('Error fetching noticeboard notices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNoticeboardNotices();
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-transparent z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-b">
          <h2 className="text-xl font-semibold text-gray-800">Notifications</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Latest Announcements Header */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-center text-gray-700 mb-4 underline">
              Latest Announcements & Notifications
            </h3>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading notifications...</p>
            </div>
          )}

          {/* Dynamic Notices */}
          {!loading && noticeboardNotices && noticeboardNotices.length > 0 ? (
            noticeboardNotices.map((notice, index) => (
            <div 
              key={index} 
              className={`mb-4 p-4 rounded-lg border-2 ${
                notice.bgColor === 'purple' ? 'bg-purple-50 border-purple-200' :
                notice.bgColor === 'red' ? 'bg-red-50 border-red-200' :
                notice.bgColor === 'green' ? 'bg-green-50 border-green-200' :
                'bg-gray-50 border-gray-200'
              }`}
            >
              {notice.title && (
                <p className={`text-center mb-2 font-semibold ${
                  notice.bgColor === 'purple' ? 'text-purple-800' :
                  notice.bgColor === 'red' ? 'text-red-700' :
                  notice.bgColor === 'green' ? 'text-green-700' :
                  'text-gray-700'
                }`}>
                  {notice.title}
                </p>
              )}
              <div 
                className={`text-sm leading-relaxed prose prose-sm max-w-none ${
                  notice.title ? 'text-gray-700' : 
                  notice.bgColor === 'purple' ? 'text-purple-800' :
                  notice.bgColor === 'red' ? 'text-red-700 text-center' :
                  notice.bgColor === 'green' ? 'text-green-700 text-center text-lg font-semibold' :
                  'text-gray-700'
                }`}
                dangerouslySetInnerHTML={{ __html: notice.content }}
              />
            </div>
            ))
          ) : (
            !loading && (
              <div className="text-center py-8">
                <p className="text-gray-500">No notifications available at the moment.</p>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors duration-200 font-medium"
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
};

export default Noticeboard;
