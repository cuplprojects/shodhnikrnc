import { useState, useEffect } from 'react';
import { Users, Save, Calendar, Settings } from 'lucide-react';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const SeatAvailability = () => {
  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();
  const notify = notification();

  const [seatAvailabilityData, setSeatAvailabilityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Seat allocation form data
  const [seatAllocation, setSeatAllocation] = useState({
    id: 0,
    supId: supId || 0,
    pri_Seat: 0,
    sec_Seat1: 0,
    sec_Seat2: 0,
    availableSeat:0,
  });

  // Fetch seat availability data
  useEffect(() => {
    if (supId) {
      fetchSeatAvailability();
      fetchCurrentSeatAllocation();
    }
  }, [supId]);

  const fetchSeatAvailability = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/SupervisorSeatAvailability/BySupervisorSeatsGrouped?supId=${supId}`);
      setSeatAvailabilityData(response.data || []);
    } catch (error) {
      console.error('Error fetching seat availability:', error);
      notify.error('Failed to load seat availability data');
    } finally {
      setLoading(false);
    }
  };

const fetchCurrentSeatAllocation = async () => {
  try {
    const response = await API.get(`/SupervisorSeatAvailability/${supId}`);

    if (response.data) {
      const { supervisorSeatAvailability, totalSeats } = response.data;

      setSeatAllocation({
        id: supervisorSeatAvailability?.id ,
        supId: supId,
        pri_Seat: supervisorSeatAvailability?.pri_Seat,
        sec_Seat1: supervisorSeatAvailability?.sec_Seat1,
        sec_Seat2: supervisorSeatAvailability?.sec_Seat2,
        totalSeats: totalSeats,
        availableSeat: supervisorSeatAvailability?.availableSeat ?? totalSeats
      });
    }
  } catch (error) {
    console.log('No existing seat allocation found, using defaults');
  }
};


  const handleSeatAllocationChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    setSeatAllocation(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSaveSeatAllocation = async () => {
    try {
      setSaving(true);
      
      // Validate allocation - only include sec_Seat2 if it should be shown
      const allocatedSeats = seatAllocation.pri_Seat + Number(seatAllocation.sec_Seat1 || 0) + (shouldShowSecondary2 ? Number(seatAllocation.sec_Seat2 || 0) : 0);
      if (allocatedSeats > seatAllocation.totalSeats) {
        notify.error('Allocated seats cannot exceed total seats');
        return;
      }

      // Calculate available seats (remaining seats after allocation)
      const availableSeats = totalAvailableSeats - allocatedSeats;

      // Prepare payload with availableSeat field - set sec_Seat2 to 0 if not shown
      const payload = {
        ...seatAllocation,
        sec_Seat2: shouldShowSecondary2 ? seatAllocation.sec_Seat2 : 0,
        availableSeat: availableSeats
      };

      let response;
      
      // Use POST for new allocation or PUT for updating existing
      if (seatAllocation.id && seatAllocation.id > 0) {
        response = await API.post('/SupervisorSeatAvailability', payload);
      } else {
        response = await API.post('/SupervisorSeatAvailability', payload);
      }
      
      if (response.data) {
        notify.success('Seat allocation saved successfully!');
        setIsEditing(false);
        
        // Update the allocation state with the returned data
        setSeatAllocation(prev => ({
          ...prev,
          id: response.data.id || prev.id,
          availableSeat: availableSeats
        }));
        
        // Refresh seat availability data
        await fetchSeatAvailability();
      }
    } catch (error) {
      console.error('Error saving seat allocation:', error);
      notify.error('Failed to save seat allocation');
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalOccupied = () => {
    return seatAvailabilityData.reduce((total, yearData) => {
      return total + yearData.subjects.reduce((yearTotal, subject) => {
        return yearTotal + subject.occupiedSeats;
      }, 0);
    }, 0);
  };

  // Calculate total available subjects across all years
  const getTotalAvailableSubjects = () => {
    return seatAvailabilityData.reduce((total, yearData) => {
      return total + yearData.subjects.length;
    }, 0);
  };

  const totalAvailableSubjects = getTotalAvailableSubjects();
  const shouldShowSecondary2 = totalAvailableSubjects > 2;
    const shouldShowSecondary1 = totalAvailableSubjects > 1;


  const totalAvailableSeats =
    seatAllocation.totalSeats - calculateTotalOccupied();


  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading seat availability data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Seat Availability & Allocation</h1>
          <p className="text-gray-600">View current seat status and manage seat allocation</p>
        </div>
        <button
          onClick={async () => {
            if (!isEditing) {
              // Fetch fresh allocation data when starting to edit
              await fetchCurrentSeatAllocation();
            }
            setIsEditing(!isEditing);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Settings size={20} />
          {isEditing ? 'Cancel' : 'Manage Allocation'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{seatAllocation.totalSeats}</p>
              <p className="text-sm text-gray-600">Total Seats Allocated</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Users size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{calculateTotalOccupied()}</p>
              <p className="text-sm text-gray-600">Currently Occupied</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{seatAllocation.availableSeat}</p>
              <p className="text-sm text-gray-600">Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Seat Allocation Management */}
      {isEditing && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Settings size={20} className="text-blue-600" />
            Seat Allocation Management
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Seats Available
                </label>
                <input
                  type="number"
                  value={totalAvailableSeats}
                  onChange={(e) => handleSeatAllocationChange('totalSeats', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max="20"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Maximum seats you're willing to supervise</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Subject Seats
                </label>
                <input
                  type="number"
                  value={seatAllocation.pri_Seat}
                  onChange={(e) => handleSeatAllocationChange('pri_Seat', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max={seatAllocation.totalSeats}
                />
              </div>
  {shouldShowSecondary1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Subject 1 Seats
                </label>
                <input
                  type="number"
                  value={seatAllocation.sec_Seat1}
                  onChange={(e) => handleSeatAllocationChange('sec_Seat1', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  max={seatAllocation.totalSeats}
                />
              </div>
  )}
              {shouldShowSecondary2 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Subject 2 Seats
                  </label>
                  <input
                    type="number"
                    value={seatAllocation.sec_Seat2}
                    onChange={(e) => handleSeatAllocationChange('sec_Seat2', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    max={seatAllocation.totalSeats}
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-3">Allocation Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Seats:</span>
                  <span className="font-medium">{totalAvailableSeats}</span>
                </div>
                <div className="flex justify-between">
                  <span>Primary Subject:</span>
                  <span className="font-medium">{seatAllocation.pri_Seat}</span>
                </div>
                  {shouldShowSecondary1 && (
                <div className="flex justify-between">
                  <span>Secondary Subject 1:</span>
                  <span className="font-medium">{seatAllocation.sec_Seat1}</span>
                </div>
                  )}
                {shouldShowSecondary2 && (
                  <div className="flex justify-between">
                    <span>Secondary Subject 2:</span>
                    <span className="font-medium">{seatAllocation.sec_Seat2}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Allocated Seats:</span>
                  <span className={`${
                    (seatAllocation.pri_Seat + seatAllocation.sec_Seat1 + (shouldShowSecondary2 ? seatAllocation.sec_Seat2 : 0)) > seatAllocation.totalSeats 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {seatAllocation.pri_Seat + Number(seatAllocation.sec_Seat1 || 0) + (shouldShowSecondary2 ? Number(seatAllocation.sec_Seat2 || 0) : 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining:</span>
                  <span className="font-medium">
                    {totalAvailableSeats - (seatAllocation.pri_Seat + Number(seatAllocation.sec_Seat1 || 0) + (shouldShowSecondary2 ? Number(seatAllocation.sec_Seat2 || 0) : 0))}
                  </span>
                </div>
              </div>

              {(seatAllocation.pri_Seat + seatAllocation.sec_Seat1 + (shouldShowSecondary2 ? seatAllocation.sec_Seat2 : 0)) > seatAllocation.totalSeats && (
                <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-xs">
                  ⚠️ Allocated seats exceed total seats!
                </div>
              )}

              <button
                onClick={handleSaveSeatAllocation}
                disabled={saving || (seatAllocation.pri_Seat + seatAllocation.sec_Seat1 + (shouldShowSecondary2 ? seatAllocation.sec_Seat2 : 0)) > seatAllocation.totalSeats}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Allocation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Allocation Status */}
      {(seatAllocation.pri_Seat > 0 || seatAllocation.sec_Seat1 > 0 || (shouldShowSecondary2 && seatAllocation.sec_Seat2 > 0)) && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Settings size={20} className="text-green-600" />
            Current Seat Allocation
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{seatAllocation.totalSeats}</p>
              <p className="text-sm text-blue-700">Total Seats</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{seatAllocation.pri_Seat}</p>
              <p className="text-sm text-green-700">Primary Subject</p>
            </div>
              {shouldShowSecondary1 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{seatAllocation.sec_Seat1}</p>
              <p className="text-sm text-yellow-700">Secondary Subject 1</p>
            </div>
              )}
            {shouldShowSecondary2 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{seatAllocation.sec_Seat2}</p>
                <p className="text-sm text-purple-700">Secondary Subject 2</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Seat Availability by Year and Subject */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-blue-600" />
          Current Seat Availability by Year & Subject
        </h3>
        
        {seatAvailabilityData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No seat availability data found
          </div>
        ) : (
          <div className="space-y-6">
            {seatAvailabilityData.map((yearData, yearIndex) => (
              <div key={yearIndex} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3 text-lg">
                  Academic Year: {yearData.year}
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 p-3 text-left">Subject Name</th>
                        <th className="border border-gray-300 p-3 text-center">Occupied Seats</th>
                        <th className="border border-gray-300 p-3 text-center">Remaining Seats</th>
                        <th className="border border-gray-300 p-3 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearData.subjects.map((subject, subjectIndex) => (
                        <tr key={subjectIndex}>
                          <td className="border border-gray-300 p-3 font-medium">{subject.subjectName}</td>
                          <td className="border border-gray-300 p-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {subject.occupiedSeats}
                            </span>
                          </td>
                          <td className="border border-gray-300 p-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {subject.remainingSeats}
                            </span>
                          </td>
                          <td className="border border-gray-300 p-3 text-center font-medium">
                            {subject.occupiedSeats + subject.remainingSeats}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guidelines */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="font-semibold text-yellow-800 mb-3">Seat Allocation Guidelines:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Set your total seats based on your supervision capacity</li>
          <li>• Distribute seats across primary and secondary subjects</li>
          <li>• Primary subject should have the highest allocation</li>
          <li>• Ensure total allocated seats don't exceed your capacity</li>
          <li>• Update allocation before each admission cycle</li>
          <li>• Seat allocation is subject to university approval</li>
        </ul>
      </div>
    </div>
  );
};

export default SeatAvailability;