import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Users, FileCheck, FileX, UserCheck, UserX, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Snowfall from 'react-snowfall';
import API from '@/services/API';

const AdmissionCellDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    qualifiedForAdmission: 0,
    verificationPending: 0,
    documentVerified: 0,
    documentRejected: 0,
    admissionCancelled: 0,
    admitted: 0,
    notAppliedForCounselling: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const response = await API.get('/OfficeDashboard/PHD-Admission-Dashboard');
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setStats({
          qualifiedForAdmission: 0,
          verificationPending: 0,
          documentVerified: 0,
          documentRejected: 0,
          admissionCancelled: 0,
          admitted: 0,
          notAppliedForCounselling: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  const statCards = [
    {
      id: 1,
      title: 'Qualified for Admission',
      value: stats.qualifiedForAdmission,
      icon: Users,
      status: 'qualifiedForAdmission',
      apiFilter: 'qualified',
      color: 'from-blue-50 to-blue-100',
      borderColor: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      id: 2,
      title: 'Verification Pending',
      value: stats.verificationPending,
      icon: Clock,
      status: 'verificationPending',
      apiFilter: 'pending-verification',
      color: 'from-orange-50 to-orange-100',
      borderColor: 'border-orange-200',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
    {
      id: 3,
      title: 'Document Verified',
      value: stats.documentVerified,
      icon: FileCheck,
      status: 'documentVerified',
      apiFilter: 'verified',
      color: 'from-green-50 to-green-100',
      borderColor: 'border-green-200',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      id: 4,
      title: 'Document Rejected',
      value: stats.documentRejected,
      icon: FileX,
      status: 'documentRejected',
      apiFilter: 'rejected',
      color: 'from-red-50 to-red-100',
      borderColor: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
    {
      id: 5,
      title: 'Admission Cancelled',
      value: stats.admissionCancelled,
      icon: UserX,
      status: 'admissionCancelled',
      apiFilter: 'cancelled',
      color: 'from-red-50 to-red-100',
      borderColor: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
  ];

  const bottomCards = [
    {
      id: 6,
      title: 'Admitted',
      value: stats.admitted,
      icon: UserCheck,
      status: 'admitted',
      apiFilter: 'admitted',
      color: 'from-green-50 to-green-100',
      borderColor: 'border-green-200',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      id: 7,
      title: 'Not Applied For Counselling',
      value: stats.notAppliedForCounselling,
      icon: Users,
      status: 'notAppliedForCounselling',
      apiFilter: 'not-applied-counselling',
      color: 'from-yellow-50 to-yellow-100',
      borderColor: 'border-yellow-200',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
  ];

  const handleCardClick = (card) => {
    console.log('Card clicked:', card);
    console.log('Navigating to:', '/admission-cell-dashboard/details');
    navigate('/admission-cell-dashboard/details', {
      state: {
        cardData: {
          title: card.title,
          value: card.value,
          status: card.status,
          apiFilter: card.apiFilter,
          // Don't pass the icon component - it can't be serialized
          color: card.color,
          borderColor: card.borderColor,
          iconBg: card.iconBg,
          iconColor: card.iconColor,
        }
      }
    });
  };

  const StatCard = ({ card, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('StatCard clicked');
        handleCardClick(card);
      }}
      className={`bg-gradient-to-br ${card.color} border ${card.borderColor} rounded-xl p-6 cursor-pointer transition-all duration-200 group flex flex-col`}
    >
      <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">{card.title}</h3>
      
      <div className="flex items-center justify-between flex-1">
        <div className={`${card.iconBg} p-3 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
          <card.icon className={`w-6 h-6 ${card.iconColor}`} />
        </div>
        <span className="text-3xl font-bold text-gray-900">{String(card.value).padStart(4, '0')}</span>
      </div>
    </motion.div>
  );

  const BottomStatCard = ({ card, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('BottomStatCard clicked');
        handleCardClick(card);
      }}
      className={`bg-gradient-to-br ${card.color} border ${card.borderColor} rounded-xl p-6 cursor-pointer transition-all duration-200 group flex flex-col`}
    >
      <h3 className="text-sm font-medium text-gray-700 mb-4 text-center">{card.title}</h3>
      
      <div className="flex items-center justify-between flex-1">
        <div className={`${card.iconBg} p-3 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
          <card.icon className={`w-6 h-6 ${card.iconColor}`} />
        </div>
        <span className="text-3xl font-bold text-gray-900">{String(card.value).padStart(4, '0')}</span>
      </div>
    </motion.div>
  );

  return (
    <div className="relative h-full bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 overflow-hidden">
      <Snowfall />
      
      <div className="relative z-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-lg"
        >
          <div className="px-6 md:px-8 py-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-8 bg-blue-400 rounded-full"></div>
              <h1 className="text-3xl font-bold">Ph.D. Admission Dashboard</h1>
            </div>
            <p className="text-slate-200 text-sm ml-4">Monitor and manage admission applications</p>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="px-6 md:px-8 py-8">
          {/* Top Row - 5 Cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
              Application Status Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {statCards.map((card, index) => (
                <StatCard key={card.id} card={card} index={index} />
              ))}
            </div>
          </motion.div>

          {/* Bottom Row - 2 Cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-5 bg-green-600 rounded-full"></div>
              Final Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {bottomCards.map((card, index) => (
                <BottomStatCard key={card.id} card={card} index={index + 5} />
              ))}
            </div>
          </motion.div>

         
        </div>
      </div>
    </div>
  );
};

export default AdmissionCellDashboard;
