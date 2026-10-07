import React from 'react';
import { motion } from 'framer-motion';

const Footer = () => {
  return (
    <motion.footer
      className="bg-white/95 backdrop-blur-sm border-t border-gray-200/80 px-6 py-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.8 }}
    >
      <div className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>© Copyright Protected. Chaudhary Charan Singh University, Meerut.</span>
        </div>
        <div className="version">
          <span className="hidden md:inline text-slate-700 bg-slate-100 p-1 rounded">Version {import.meta.env.VITE_APP_VERSION}</span>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
