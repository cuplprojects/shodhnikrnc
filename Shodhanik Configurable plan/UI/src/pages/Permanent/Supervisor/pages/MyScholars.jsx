import { useEffect, useState, useMemo } from 'react';
import { Users, Mail, Phone, BookOpen, Eye, MessageCircle, Search, RefreshCw, Loader2 } from 'lucide-react';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';
import notification from '@/services/NotificationService';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const MyScholars = () => {
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, getSupId, initializeAuth } = useSupervisorAuthStore();
  const baseFileURL = getBaseFileURL();
  const notify = notification();

  const getStatusColor = (stage) => {
    switch (stage) {
      case 'Active':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'Thesis Submission':
      case 'Thesis Stage':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'Synopsis Stage':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Coursework':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'On Leave':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const fetchScholars = async () => {
    setLoading(true);
    try {
      const currentSupId = getSupId() || user?.supId || user?.id;
      const url = currentSupId 
        ? `/SupervisorSeatAvailability/ScholarsDetails?SupId=${currentSupId}`
        : `/SupervisorSeatAvailability/ScholarsDetails`;

      const response = await API.get(url);
      if (response.data && Array.isArray(response.data)) {
        setScholars(response.data);
      } else {
        setScholars([]);
      }
    } catch (error) {
      console.error('Failed to fetch scholars:', error);
      notify.error('Failed to fetch scholars');
      setScholars([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user && initializeAuth) {
      initializeAuth();
    }
    fetchScholars();
  }, [user]);

  const filteredScholars = useMemo(() => {
    if (!searchTerm.trim()) return scholars;
    const term = searchTerm.toLowerCase();
    return scholars.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const prn = (s.permUserName || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.contactNo || s.phone || '').toLowerCase();
      const area = (s.researchArea || '').toLowerCase();
      const stage = (s.stage || '').toLowerCase();
      return (
        name.includes(term) ||
        prn.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        area.includes(term) ||
        stage.includes(term)
      );
    });
  }, [scholars, searchTerm]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">My Scholars</h1>
          <p className="text-gray-600 text-sm">Manage and monitor your assigned PhD scholars</p>
        </div>
        <button
          onClick={fetchScholars}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{scholars.length}</p>
              <p className="text-sm font-medium text-gray-500">Total Scholars</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center border border-green-100">
              <Users size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {scholars.filter((s) => s.status === 'Active' || !s.status || s.stage !== 'Awarded').length}
              </p>
              <p className="text-sm font-medium text-gray-500">Active Scholars</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center border border-purple-100">
              <BookOpen size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {scholars.filter((s) => s.stage === 'Thesis Stage').length}
              </p>
              <p className="text-sm font-medium text-gray-500">Thesis Stage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {scholars.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, PRN, email, research area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-sm">
          <Loader2 size={36} className="mx-auto text-blue-600 animate-spin mb-3" />
          <p className="text-gray-600 font-medium">Fetching assigned scholars...</p>
        </div>
      ) : filteredScholars.length > 0 ? (
        /* Scholars Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScholars.map((scholar) => (
            <div
              key={scholar.scholarId || scholar.id}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Scholar Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {scholar.photo ? (
                        <img
                          src={
                            scholar.photo.startsWith('http')
                              ? scholar.photo
                              : `${baseFileURL}/${scholar.photo}`
                          }
                          alt={scholar.name}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '';
                            e.currentTarget.parentElement.innerHTML =
                              '<span class="text-indigo-600 font-semibold text-lg">' +
                              (scholar.name ? scholar.name[0].toUpperCase() : 'S') +
                              '</span>';
                          }}
                        />
                      ) : (
                        <span className="text-indigo-600 font-semibold text-lg">
                          {scholar.name ? scholar.name[0].toUpperCase() : 'S'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate" title={scholar.name}>
                        {scholar.name}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono truncate">
                        {scholar.permUserName || 'No PRN'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(
                      scholar.stage
                    )}`}
                  >
                    {scholar.stage || 'Coursework'}
                  </span>
                </div>

                {/* Scholar Details */}
                <div className="space-y-2.5 mb-5 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400 flex-shrink-0" />
                    <a
                      href={`mailto:${scholar.email}`}
                      className="truncate hover:text-blue-600 transition-colors"
                      title={scholar.email}
                    >
                      {scholar.email || 'N/A'}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-400 flex-shrink-0" />
                    <span>{scholar.contactNo || scholar.phone || 'N/A'}</span>
                  </div>
                  {scholar.researchArea && (
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate" title={scholar.researchArea}>
                        {scholar.researchArea}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <a
                  href={`mailto:${scholar.email}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                >
                  <MessageCircle size={15} />
                  Contact
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-sm">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">
            {searchTerm ? 'No Matching Scholars Found' : 'No Scholars Assigned'}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {searchTerm
              ? `No scholars matched your search for "${searchTerm}".`
              : "You don't have any PhD scholars assigned under your supervision yet."}
          </p>
        </div>
      )}
    </div>
  );
};

export default MyScholars;