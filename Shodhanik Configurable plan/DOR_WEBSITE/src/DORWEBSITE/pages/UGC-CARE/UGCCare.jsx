import { useState } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const UGCCare = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                UGC-CARE List
              </h1>
              <p className="text-lg text-gray-600">
                University Grants Commission - Consortium for Academic and Research Ethics
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-blue-800 mb-3">
                About UGC-CARE
              </h2>
              <p className="text-blue-700 leading-relaxed">
                The UGC-CARE (Consortium for Academic and Research Ethics) is an initiative by the University Grants Commission 
                to promote quality research and provide a database of quality journals. The CARE list includes journals that 
                meet certain quality parameters and are recommended for academic and research publications.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Purpose of UGC-CARE
                </h3>
                <ul className="text-gray-600 space-y-2">
                  <li>• Promote quality research publications</li>
                  <li>• Provide a database of quality journals</li>
                  <li>• Help researchers identify credible journals</li>
                  <li>• Support academic career advancement</li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Benefits for Researchers
                </h3>
                <ul className="text-gray-600 space-y-2">
                  <li>• Access to quality journal database</li>
                  <li>• Recognition for publications</li>
                  <li>• Career advancement opportunities</li>
                  <li>• Research quality assurance</li>
                </ul>
              </div>
            </div>

            <div className="text-center bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                Coming Soon
              </h3>
              <p className="text-yellow-700">
                The UGC-CARE journal list and search functionality will be available soon. 
                Please check back later for updates.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default UGCCare;