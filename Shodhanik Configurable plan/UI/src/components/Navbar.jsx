import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMenuAlt3, HiX } from 'react-icons/hi';
import { FiLogOut, FiUser } from 'react-icons/fi';
import useStaffAuthStore from '@/store/staffAuthStore';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import { scholarService } from '@/services/scholarService';


import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/BreadCrumb';
import notification from '@/services/NotificationService';
import { confirm } from '@/services/ConfirmationService';
// import TokenStatus from './TokenStatus'; //later to be integrated

import getBaseFileURL from '@/utils/getBaseFileUrl';
import API from '@/services/API';


const Navbar = ({ getActiveTabTitle, setSidebarOpen, sidebarOpen }) => {

    const notify = notification();
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [scholarProfileData, setScholarProfileData] = useState(null);
    const [supervisorDocuments, setSupervisorDocuments] = useState(null);
    
    // Get all auth stores
    const staffAuth = useStaffAuthStore();
    const selectedScholarAuth = useSelectedScholarAuthStore();
    const supervisorAuth = useSupervisorAuthStore();
    
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    // Determine current user and auth store
    const getCurrentUser = () => {
        if (staffAuth.isAuthenticated) {
            return { user: staffAuth.user, type: 'STAFF', logout: staffAuth.logout };
        } else if (selectedScholarAuth.isAuthenticated) {
            return { user: selectedScholarAuth.user, type: 'SH', logout: selectedScholarAuth.logout };
        } else if (supervisorAuth.isAuthenticated) {
            return { user: supervisorAuth.user, type: 'SUP', logout: supervisorAuth.logout };
        }
        return { user: null, type: null, logout: null };
    };

    const { user, type: userType, logout } = getCurrentUser();

    const baseFileURL = getBaseFileURL();

    // Function to refresh supervisor documents
    const refreshSupervisorDocuments = async () => {
        if (userType === 'SUP' && supervisorAuth.getSupId) {
            try {
                const supId = supervisorAuth.getSupId();
                if (supId) {
                    const response = await API.get(`/SupervisorUploads/${supId}`);
                    if (response.data) {
                        setSupervisorDocuments(response.data);
                    }
                }
            } catch (error) {
                console.error('Error refreshing supervisor documents for navbar:', error);
            }
        }
    };

    // Fetch profile data based on user type
    useEffect(() => {
        const fetchScholarProfile = async () => {
            if (userType === 'SH' && selectedScholarAuth.getSId) {
                try {
                    const sId = selectedScholarAuth.getSId();
                    if (sId) {
                        const data = await scholarService.getProfile(sId);
                        setScholarProfileData(data);
                    }
                } catch (error) {
                    console.error('Error fetching scholar profile for navbar:', error);
                }
            }
        };

        const fetchSupervisorDocuments = async () => {
            if (userType === 'SUP' && supervisorAuth.getSupId) {
                try {
                    const supId = supervisorAuth.getSupId();
                    if (supId) {
                        const response = await API.get(`/SupervisorUploads/${supId}`);
                        if (response.data) {
                            setSupervisorDocuments(response.data);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching supervisor documents for navbar:', error);
                    // If no documents found (404), that's normal for new registrations
                    if (error.response?.status !== 404) {
                        console.error('Unexpected error:', error);
                    }
                }
            }
        };

        fetchScholarProfile();
        fetchSupervisorDocuments();
    }, [userType, selectedScholarAuth, supervisorAuth]);

    // Listen for profile picture updates
    useEffect(() => {
        const handleProfileUpdate = () => {
            refreshSupervisorDocuments();
        };

        // Listen for custom event when profile picture is updated
        window.addEventListener('supervisorProfileUpdated', handleProfileUpdate);
        
        return () => {
            window.removeEventListener('supervisorProfileUpdated', handleProfileUpdate);
        };
    }, [userType, supervisorAuth]);

    const handleLogout = async () => {
        // custom message and title
        const confirmed = await confirm({
            title: "Logout Confirmation",
            message: "Are you sure you want to log out?",
        });

        if (confirmed) {
            // notify.info("Logging Out!");
            logout();
            navigate("/login");
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setProfileDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <motion.header
            className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200/80 sticky top-0 z-30"
            initial={{ y: -60 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            <div className="flex items-center justify-between lg:px-6 lg:py-0 ">
                <div className="flex items-center space-x-4">
                    {/* Sidebar Toggle Button - Works on all screen sizes */}
                    <motion.button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2.5 rounded-xl text-gray-500 hover:text-slate-600 hover:bg-slate-50 transition-all duration-200 lg:hidden"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {sidebarOpen ? (
                            <HiX className="text-xl" />
                        ) : (
                            <HiMenuAlt3 className="text-xl" />
                        )}
                    </motion.button>

                    {/* Page Title */}
                    <div className="flex items-center space-x-3">
                        <div>
                            <motion.h1
                                className="text-xl font-bold text-gray-900"
                                key={getActiveTabTitle()}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* {getActiveTabTitle()} */}
                            </motion.h1>
                            <Breadcrumb />
                        </div>
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center space-x-4">
                    {/* Token Status */}
                    {/* <TokenStatus className="hidden lg:flex" /> */}


                    {/* Search */}
                        {/* <div className="hidden md:flex items-center space-x-2 bg-gray-50 rounded-xl px-4 py-2.5 min-w-[300px] border border-slate-700/20">
                            <i className="fas fa-search text-gray-400"></i>
                            <input
                                type="text"
                                placeholder="Search employees, departments..."
                                className="bg-transparent flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                            />
                        </div> */}
                    

                    {/* Notifications */}
                    {/* <motion.button
                        className="relative p-2.5 text-gray-500 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <FiBell className="text-xl" />
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                            3
                        </span>
                    </motion.button> */}

                    {/* Profile Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <motion.div
                            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                            className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-all duration-200"
                            whileHover={{ scale: 1.02 }}
                        >
                            <div className="w-8 h-8 bg-slate-100 border border-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                                {userType === 'SH' && scholarProfileData?.profilePicture ? (
                                    <img
                                        src={`${baseFileURL}/${scholarProfileData.profilePicture}`}
                                        alt="Profile"
                                        className="w-full h-full object-fitcover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : userType === 'SUP' && supervisorDocuments?.photo ? (
                                    <img
                                        src={`${baseFileURL}/${supervisorDocuments.photo}`}
                                        alt="Profile"
                                        className="w-full h-full object-fitcover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <FiUser className={(userType === 'SH' && scholarProfileData?.profilePicture) || (userType === 'SUP' && supervisorDocuments?.photo) ? 'hidden' : 'block'} />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-sm font-medium text-gray-900">
                                    {userType === 'SH' ? (scholarProfileData?.scholarName || `Scholar ${user?.sId || 'N/A'}`) : 
                                     userType === 'SUP' ? (user?.name || user?.username || 'Supervisor') : 
                                     user?.name || user?.selectedRole?.roleName || 'Staff User'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {userType === 'SH' ? 'Scholar' : 
                                     userType === 'SUP' ? 'Supervisor' : 
                                     'Administrator'}
                                </p>
                            </div>
                            <motion.i
                                className="fas fa-chevron-down text-gray-400 text-xs"
                                animate={{ rotate: profileDropdownOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            />
                        </motion.div>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                            {profileDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200/80 py-2 z-50"
                                >
                                    {/* User Info */}
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <p className="text-sm font-medium text-gray-900">
                                            {userType === 'SH' ? (scholarProfileData?.scholarName || `Scholar ${user?.sId || 'N/A'}`) : 
                                             userType === 'SUP' ? (user?.name || user?.username || 'Supervisor') : 
                                             user?.name || user?.selectedRole?.roleName || 'Staff User'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {userType === 'SH' ? (scholarProfileData?.emailID || user?.email || 'N/A') : 
                                             user?.email || 'N/A'}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {userType === 'SH' ? `Scholar ID: ${user?.sId || 'N/A'}` : 
                                             userType === 'SUP' ? `ID: ${user?.supId || user?.username || 'N/A'}` : 
                                             `Username: ${user?.fullName || 'N/A'}`}
                                        </p>
                                    </div>

                                    {/* Menu Items */}
                                    <div className="py-1">
                                        <motion.button
                                            onClick={() => {
                                                // For supervisors, navigate to print profile page
                                                const profileRoute = userType === 'SUP' 
                                                    ? '/supervisor-dashboard/print-profile' 
                                                    : '/dashboard/profile';
                                                navigate(profileRoute);
                                                setProfileDropdownOpen(false);
                                            }}
                                            whileHover={{ backgroundColor: '#f9fafb' }}
                                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 cursor-pointer"
                                        >
                                            <FiUser className="text-gray-400" />
                                            <span>View Profile</span>
                                        </motion.button>

                                        {/* <div className="border-t border-gray-100 my-1"></div> */}

                                        <motion.button
                                            onClick={handleLogout}
                                            whileHover={{ backgroundColor: '#fef2f2' }}
                                            className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:text-red-700 transition-colors duration-200 cursor-pointer"
                                        >
                                            <FiLogOut className="text-red-500" />
                                            <span>Logout</span>
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.header>
    );
};

export default Navbar;
