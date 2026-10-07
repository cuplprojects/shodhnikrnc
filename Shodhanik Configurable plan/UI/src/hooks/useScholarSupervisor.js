import { useState, useEffect } from 'react';
import scholarSupervisorService from '@/services/scholarSupervisorService';
import useSelectedScholarAuthStore from '@/store/selectedScholarAuthStore';

export const useScholarSupervisor = () => {
  const [loading, setLoading] = useState(false);
  const [supervisors, setSupervisors] = useState([]);
  const [existingData, setExistingData] = useState(null);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [error, setError] = useState('');

  const { getSId } = useSelectedScholarAuthStore();
  const sid = getSId();

  const checkExistingData = async () => {
    if (!sid) return;
    
    try {
      setLoading(true);
      setError('');
      const data = await scholarSupervisorService.getScholarSupervisorBySid(sid);
      if (data) {
        setExistingData(data);
        setIsFirstTime(false);
      }
    } catch (error) {
      // If no data found, it's first time
      setIsFirstTime(true);
    } finally {
      setLoading(false);
    }
  };

  const loadSupervisors = async () => {
    if (!sid) return;
    
    try {
      setError('');
      const data = await scholarSupervisorService.getSupervisorsForScholar(sid);
      setSupervisors(data || []);
    } catch (error) {
      console.error('Error loading supervisors:', error);
      setError('Failed to load supervisors');
    }
  };

  const submitSupervisorAssignment = async (formData) => {
    try {
      setError('');
      
      // Upload files
      const supervisorConsentPath = await scholarSupervisorService.uploadFile(
        formData.supervisorConsentFile, 
        'SUP1'
      );
      
      let coSupervisorConsentPath = '';
      if (formData.selectedCoSupervisor && formData.coSupervisorConsentFile) {
        coSupervisorConsentPath = await scholarSupervisorService.uploadFile(
          formData.coSupervisorConsentFile, 
          'COSUP'
        );
      }

      // Submit data
      const payload = {
        sid: parseInt(sid),
        supiD1: parseInt(formData.selectedSupervisor),
        suP1ConsentFilePath: supervisorConsentPath,
        nocFilePath: '',
        cosupid: formData.selectedCoSupervisor ? parseInt(formData.selectedCoSupervisor) : 0,
        cosupConsentFilePath: coSupervisorConsentPath,
        requestedAt: new Date().toISOString(),
        secondRequestAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        secondApprovedAt: new Date().toISOString()
      };

      await scholarSupervisorService.createScholarSupervisor(payload);
      await checkExistingData(); // Refresh data
      
      return { success: true, message: 'Supervisor assignment submitted successfully!' };
    } catch (error) {
      console.error('Error submitting:', error);
      return { success: false, message: 'Failed to submit supervisor assignment' };
    }
  };

  const submitSupervisorChange = async (formData) => {
    try {
      setError('');
      
      // Upload NOC file
      const nocFilePath = await scholarSupervisorService.uploadFile(formData.nocFile, 'NOC');

      // Submit change request
      const payload = {
        scsuid: existingData.scsuid,
        sid: parseInt(sid),
        supiD2: parseInt(formData.newSupervisor),
        suP2ConsentFilePath: '',
        nocFilePath: nocFilePath,
        secondRequestAt: new Date().toISOString(),
        secondApprovedAt: new Date().toISOString()
      };

      await scholarSupervisorService.updateScholarSupervisor(sid, payload);
      await checkExistingData(); // Refresh data
      
      return { success: true, message: 'Supervisor change request submitted successfully!' };
    } catch (error) {
      console.error('Error submitting change:', error);
      return { success: false, message: 'Failed to submit supervisor change request' };
    }
  };

  const getSupervisorName = (supId) => {
    const supervisor = supervisors.find(s => s.supId === supId);
    return supervisor ? supervisor.fullName : 'Unknown Supervisor';
  };

  useEffect(() => {
    if (sid) {
      checkExistingData();
      loadSupervisors();
    }
  }, [sid]);

  return {
    loading,
    supervisors,
    existingData,
    isFirstTime,
    error,
    sid,
    submitSupervisorAssignment,
    submitSupervisorChange,
    getSupervisorName,
    refetch: checkExistingData
  };
};

export default useScholarSupervisor;