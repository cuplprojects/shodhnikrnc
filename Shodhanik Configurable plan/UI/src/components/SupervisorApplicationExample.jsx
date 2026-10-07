import { useState } from 'react';
import PreviewApplication from '../pages/Registration/SupervisorRegistration/forms/PreviewApplication';
import PrintFinalApplication from '../pages/Registration/SupervisorRegistration/forms/PrintFinalApplication';
import useSupervisorRegAuthStore from '@/store/supervisorRegAuthStore';

const SupervisorApplicationExample = () => {
  const [currentView, setCurrentView] = useState('preview');
  
  // Get supervisor ID from auth store
  const { getSupId } = useSupervisorRegAuthStore();
  const supId = getSupId();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">
              Supervisor Application System
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Supervisor ID: <span className="font-mono text-blue-600">{supId || 'Not logged in'}</span>
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentView('preview')}
                  className={`px-4 py-2 text-sm font-medium rounded ${
                    currentView === 'preview'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Preview Application
                </button>
                <button
                  onClick={() => setCurrentView('print')}
                  className={`px-4 py-2 text-sm font-medium rounded ${
                    currentView === 'print'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Print Final Application
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-6">
        {currentView === 'preview' ? (
          <PreviewApplication />
        ) : (
          <PrintFinalApplication />
        )}
      </div>
    </div>
  );
};

export default SupervisorApplicationExample;