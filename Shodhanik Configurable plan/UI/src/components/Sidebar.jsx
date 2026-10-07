import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiLogOut, FiChevronDown } from "react-icons/fi";
import { FaHome, FaLock } from "react-icons/fa";
import { NavLink, useLocation } from "react-router-dom";
import { Tooltip } from "antd";
import useStaffAuthStore from "@/store/staffAuthStore";
import useSelectedScholarAuthStore from "@/store/selectedScholarAuthStore";
import useSupervisorAuthStore from "@/store/supervisorAuthStore";
import { useNavigate } from "react-router-dom";
import { confirm } from "@/services/ConfirmationService";
import notification from "@/services/NotificationService";
import { hasPermission } from "@/services/hasPermissionService";
import StorageService from "@/utils/storage";
import { isRouteLockedForScholar, getRouteLockReason } from "@/utils/routeLockUtils";


const headerConfig = {
  header: {
    type: "text", // "text" | "image"
    title: "SODHANIK",
    imagePath:""
 },
};

const Sidebar = ({ sidebarOpen, setSidebarOpen, menuItems }) => {
  const [isMobile, setIsMobile] = React.useState(false);
  // Initialize expandedSection from storage to persist state across refreshes
  const [expandedSection, setExpandedSection] = useState(() => {
    return StorageService.get('sidebar-expanded-section') || null;
  });
  
  // Get all auth stores
  const staffAuth = useStaffAuthStore();
  const scholarAuth = useSelectedScholarAuthStore();
  const supervisorAuth = useSupervisorAuthStore();
  
  // Subscribe to both course work and synopsis status changes for scholars
  const courseWorkCompleted = scholarAuth.courseWorkCompleted;
  const courseWorkFeePaid = scholarAuth.courseWorkFeePaid;
  const synopsisApproved = scholarAuth.synopsisApproved;
  const pendingPaymentsCount = scholarAuth.pendingPaymentsCount;
  
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);

  // Determine current user and auth store
  const getCurrentUser = () => {
    if (staffAuth.isAuthenticated) {
      // All staff roles now use the single dashboard
      return { user: staffAuth.user, type: 'STAFF', logout: staffAuth.logout, basePath: '/dashboard' };
    }
    if (scholarAuth.isAuthenticated) {
      return { user: scholarAuth.user, type: 'SH', logout: scholarAuth.logout, basePath: '/scholar-dashboard' };
    }
    if (supervisorAuth.isAuthenticated) {
      return { user: supervisorAuth.user, type: 'SUP', logout: supervisorAuth.logout, basePath: '/supervisor-dashboard' };
    }
    return { user: null, type: null, logout: null, basePath: '/dashboard' };
  };

  const { user, type: userType, logout, basePath } = getCurrentUser();

  // Get Logo Constrains
  const { type, title, imagePath } = headerConfig.header;

  // Helper function to check if route should show pending payments badge
  const shouldShowPaymentBadge = (item) => {
    if (userType !== 'SH') return false;
    // Check if this is the fee-payments route
    const isFeePaymentsRoute = item.path === 'fee-payments' || item.id === 'fee-payments';
    return isFeePaymentsRoute && pendingPaymentsCount > 0;
  };

  // Separate direct items and grouped items with permission filtering
  const { directItems, groupedMenuItems } = React.useMemo(() => {
    const direct = [];
    const grouped = [];

    // console.log('Processing menuItems:', menuItems); // Debug log

    menuItems.forEach((item) => {
      // Check permissions for each item
      const hasAccess = !item.permission || hasPermission(item.permission);
      
      if (!hasAccess) return; // Skip items without permission

      if (item.type === "direct") {
        // For scholar routes, check if route is locked
        if (userType === 'SH') {
          const isLocked = isRouteLockedForScholar(item);
          direct.push({ ...item, switch: !isLocked });
        } else {
          direct.push(item);
        }
      } else if (item.type === "heading" && item.items) {
        // Filter items within the section for permissions and locks
        const accessibleItems = item.items.filter(subItem => {
          const hasSubAccess = !subItem.permission || hasPermission(subItem.permission);
          return hasSubAccess;
        }).map(subItem => {
          // For scholar routes, check if route is locked
          if (userType === 'SH') {
            const isLocked = isRouteLockedForScholar(subItem);
            return { ...subItem, switch: !isLocked };
          }
          return subItem;
        });
        
        // Only add section if it has accessible items
        if (accessibleItems.length > 0) {
          grouped.push({
            ...item,
            items: accessibleItems
          });
        }
      }
    });

    // console.log('Processed navigation:', { directItems: direct, groupedMenuItems: grouped }); // Debug log

    return {
      directItems: direct,
      groupedMenuItems: grouped,
    };
  }, [menuItems, userType, courseWorkCompleted, courseWorkFeePaid, synopsisApproved, pendingPaymentsCount]); // Add all status dependencies

  // Initialize with first section expanded only if no saved state exists
  React.useEffect(() => {
    if (groupedMenuItems.length > 0 && !expandedSection && !StorageService.get('sidebar-expanded-section')) {
      const newExpandedSection = groupedMenuItems[0].id;
      setExpandedSection(newExpandedSection);
      StorageService.set('sidebar-expanded-section', newExpandedSection);
    }
  }, [groupedMenuItems, expandedSection]);

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: "Confirm Logout",
      message: "Are you sure you want to log out of your account?",
    });

    if (confirmed) {
      notification().success("Logged out");
      logout();
      navigate("/login");
    }
  };

  // Handle accordion toggle
  const toggleSection = (sectionId) => {
    console.log('toggleSection called with:', sectionId, 'current expandedSection:', expandedSection); // Debug log
    const newExpandedSection = expandedSection === sectionId ? null : sectionId;
    console.log('Setting expandedSection to:', newExpandedSection); // Debug log
    setExpandedSection(newExpandedSection);
    // Save to storage to persist across refreshes
    if (newExpandedSection) {
      StorageService.set('sidebar-expanded-section', newExpandedSection);
      console.log('Saved to storage:', newExpandedSection); // Debug log
    } else {
      StorageService.remove('sidebar-expanded-section');
      console.log('Removed from storage'); // Debug log
    }
  };

  // Check if current route belongs to a section and expand it (only when route changes)
  React.useEffect(() => {
    const currentPath = location.pathname;
    
    // Find which section contains the current route by checking the full path
    const currentSection = groupedMenuItems.find((section) =>
      section.items.some((item) => {
        const itemPath = item.path || `${basePath}/${item.id}`;
        // Check if current path matches the item path exactly or starts with it (for nested routes)
        return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
      })
    );
    
    if (currentSection) {
      // Auto-expand the section containing the current route
      if (expandedSection !== currentSection.id) {
        console.log('Auto-expanding section:', currentSection.id); // Debug log
        const newExpandedSection = currentSection.id;
        setExpandedSection(newExpandedSection);
        StorageService.set('sidebar-expanded-section', newExpandedSection);
      }
    }
    // Note: We don't collapse sections when on direct items anymore
    // This allows manual toggle to work without interference
  }, [location.pathname, groupedMenuItems, basePath]); // Removed expandedSection and directItems from dependencies

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        sidebarOpen &&
        isMobile
      ) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sidebarOpen, isMobile]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <motion.div
      ref={sidebarRef}
      initial={false}
      animate={{
        x: isMobile ? (sidebarOpen ? 0 : -280) : 0,
        opacity: isMobile ? (sidebarOpen ? 1 : 0) : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl border-r border-gray-200/80
        lg:relative lg:translate-x-0 lg:opacity-100 lg:shadow-lg
        ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-center h-13 bg-gradient-to-r from-gray-600 to-slate-700
                       border-b border-gray-500/20 cursor-pointer gap-2"
        onClick={() => navigate(basePath)}
      >
        {type === "image" && imagePath ? (
          <motion.img
            src={imagePath}
            alt="Logo"
            className="h-16 object-contain"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          />
        ) : (
          <>
            <span className="text-white">
              <FaHome size={25} />
            </span>{" "}
            <motion.h1
              className="text-white text-xl font-bold tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {title}
            </motion.h1>
          </>
        )}
      </div>

      {/* Navigation - Accordion Style */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto h-[calc(100vh-3.24rem)]">
        {/* Direct Navigation Items */}
        {directItems.length > 0 && (
          <div className="mb-4 space-y-1">
            {directItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {item.switch !== false ? (
                  <NavLink
                    to={item.path || `${basePath}/${item.id}`}
                    onClick={() => isMobile && setSidebarOpen(false)}
                    className={({ isActive }) => {
                      const currentPath = location.pathname;
                      const linkPath = item.path || `${basePath}/${item.id}`;
                      const isExactMatch = currentPath === linkPath;

                      return `w-full flex items-center px-4 py-2.5 rounded-md text-left text-sm font-medium transition-all duration-200 group ${
                        isExactMatch
                          ? "bg-gradient-to-r from-gray-100 to-gray-50 border-l-4 border-gray-600 text-gray-800 font-semibold shadow-sm"
                          : "text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:pl-5"
                      }`;
                    }}
                  >
                    <div className="mr-3 text-base text-gray-400 group-hover:text-gray-600 transition-colors duration-200">
                      {item.icon}
                    </div>
                    <span className="flex-1">{item.name}</span>
                    {shouldShowPaymentBadge(item) && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-bold text-white bg-blue-500 rounded-full blink-badge">
                       New {pendingPaymentsCount}
                      </span>
                    )}
                  </NavLink>
                ) : (
                  <Tooltip 
                    title={getRouteLockReason(item)} 
                    placement="right"
                    color="#f59e0b"
                  >
                    <div className="w-full flex items-center px-4 py-2.5 rounded-md text-left text-sm font-medium cursor-not-allowed opacity-50">
                      <div className="mr-3 text-base text-gray-300">
                        {item.icon}
                      </div>
                      <span className="text-gray-400 flex items-center gap-2">
                        {item.name}
                        <FaLock size={12} className="text-amber-500" />
                      </span>
                    </div>
                  </Tooltip>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Grouped Navigation Items (Accordion) */}
        <AnimatePresence>
          {groupedMenuItems.map((section, sectionIndex) => {
            return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: sectionIndex * 0.05 }}
              className="mb-2"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200 group"
              >
                <span className="uppercase tracking-wider text-xs">
                  {section.name}
                </span>
                <motion.div
                  animate={{
                    rotate: expandedSection === section.id ? 0 : 90,
                  }}
                  transition={{ duration: 0.2 }}
                  className="text-gray-400 group-hover:text-gray-600"
                >
                  <FiChevronDown size={16} />
                </motion.div>
              </button>

              {/* Section Items */}
              <AnimatePresence>
                {expandedSection === section.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pl-2 space-y-1">
                      {section.items.map((item, itemIndex) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: itemIndex * 0.05 }}
                        >
                          {item.switch !== false ? (
                            <NavLink
                              to={item.path || `${basePath}/${item.id}`}
                              onClick={() => isMobile && setSidebarOpen(false)}
                              className={({ isActive }) => {
                                // Check for exact match to prevent parent route highlighting
                                const currentPath = location.pathname;
                                const linkPath = item.path || `${basePath}/${item.id}`;
                                const isExactMatch = currentPath === linkPath;

                                return `w-full flex items-center px-4 py-2.5 rounded-md text-left text-sm font-medium transition-all duration-200 group ${
                                  isExactMatch
                                    ? "bg-gradient-to-r from-gray-100 to-gray-50 border-l-4 border-gray-600 text-gray-800 font-semibold shadow-sm"
                                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:pl-5"
                                }`;
                              }}
                            >
                              <div className="mr-3 text-base text-gray-400 group-hover:text-gray-600 transition-colors duration-200">
                                {item.icon}
                              </div>
                              <span className="flex-1">{item.name}</span>
                              {shouldShowPaymentBadge(item) && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full blink-badge">
                                  {pendingPaymentsCount}
                                </span>
                              )}
                            </NavLink>
                          ) : (
                            <Tooltip 
                              title={getRouteLockReason(item)} 
                              placement="right"
                              color="#f59e0b"
                            >
                              <div className="w-full flex items-center px-4 py-2.5 rounded-md text-left text-sm font-medium cursor-not-allowed opacity-50">
                                <div className="mr-3 text-base text-gray-300">
                                  {item.icon}
                                </div>
                                <span className="text-gray-400 flex items-center gap-2">
                                  {item.name}
                                  <FaLock size={12} className="text-amber-500" />
                                </span>
                              </div>
                            </Tooltip>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )})}
        </AnimatePresence>
      </nav>

      {/* Bottom User Info */}
      {/* <div className="p-0 border-t border-gray-200">
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-1 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <i className="fas fa-user text-white text-sm"></i>
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email || "Admin User"}
              </p>
              <p className="text-xs text-gray-500">System Administrator</p>
            </div>
          </div>
          <motion.button
            onClick={handleLogout}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-all duration-200 group cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FiLogOut size={25} />
          </motion.button>
        </div>
      </div> */}
    </motion.div>
  );
};

export default Sidebar;
