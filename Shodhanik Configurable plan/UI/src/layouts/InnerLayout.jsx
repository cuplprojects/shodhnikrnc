import { useState, useEffect } from "react";
import { motion as M, AnimatePresence } from "framer-motion";

// layouts/InnerLayout.jsx
import { Outlet, useLocation } from "react-router-dom";

// components imports
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import Footer from '@/components/Footer';

// navigation hook
import { useNavigation } from '@/hooks/useNavigation';

const InnerLayout = () => {
  const location = useLocation();

  // Use reactive navigation hook
  const { userType, menuItems, isLoading } = useNavigation();

  const [activeTab, setActiveTab] = useState("");
  // Initialize sidebar state based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Check if we're on desktop (lg breakpoint and above)
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });


  useEffect(() => {
    const currentPath = location.pathname.split("/")[2];
    // e.g., "add-employee" from "/dashboard/add-employee" or "home" from "/supervisor-dashboard/home"
    const defaultTab = userType === 'SUP' ? "home" : userType === 'SH' ? "dashboard" : "dashboard";
    setActiveTab(currentPath || defaultTab);
  }, [location, userType]);


  // Handle window resize to manage sidebar state
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      // Auto-open on desktop, auto-close on mobile
      if (isDesktop && !sidebarOpen) {
        setSidebarOpen(true);
      } else if (!isDesktop && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Navigation is now reactive through useNavigation hook 

  const getActiveTabTitle = () => {
    // First check direct items
    let item = menuItems.find(
      (item) => item.id === activeTab && (item.type === "direct" || item.type === "item")
    );
    
    if (item) {
      return item.name;
    }
    
    // Default titles based on user type and active tab
    if (activeTab === "home" && userType === 'SUP') {
      return "Home";
    } else if (activeTab === "dashboard") {
      return "Dashboard";
    }
    
    // Fallback: capitalize the activeTab
    return activeTab ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace(/-/g, ' ') : "Dashboard";
  };

  return (
    <>
      <style>{`
        @media print {
          .sidebar-container,
          .navbar-container,
          .footer-container,
          .mobile-overlay {
            display: none !important;
          }
          .main-content-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          .inner-layout {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }
          .inner-layout > div {
            height: auto !important;
            overflow: visible !important;
          }
          /* Ensure content flows naturally */
          body {
            overflow: visible !important;
          }
          * {
            overflow: visible !important;
          }
        }
      `}</style>
      <div className="inner-layout h-screen w-full flex overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">

        {/* Sidebar Container */}
        <div className="sidebar-container h-full overflow-y-auto z-50">
          <Sidebar
            menuItems={menuItems}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        </div>

        {/* Mobile Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <M.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mobile-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
          <div className="navbar-container">
            <Navbar
              getActiveTabTitle={getActiveTabTitle}
              setSidebarOpen={setSidebarOpen}
              sidebarOpen={sidebarOpen}
            />
          </div>

          <M.main
            className="main-content-wrapper flex-1 p-4 m-4 bg-white rounded-lg shadow-lg overflow-y-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </M.main>

          <div className="footer-container">
            <Footer />
          </div>
        </div>
      </div>
    </>
  );
};

export default InnerLayout;
