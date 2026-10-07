import { useState, useEffect } from 'react';
import API from '@/services/API';
import { Button } from 'antd';
import useSupervisorAuthStore from '@/store/supervisorAuthStore';
import notification from '@/services/NotificationService';


const ResearchDetails = () => {
  const [loading, setLoading] = useState(false);

  const { getSupId } = useSupervisorAuthStore();
  const supId = getSupId();
  const [form, setForm] = useState({
    supId,
    researchArea: '',
    researchYear: '',
    phd_Awarded: 0,
    phd_UnderSupervision: 0,
    mPhil_Awarded: 0,
    dissertation: 0,
    mPhil_UnderSupervision: 0,
    dissertationUnderSupervision: 0,
    scopus: '',
    orchid: '',
    publOns: '',
    vidwan: '',
    googleScholar: '',
    researchGate: ''
  });

  // 🔁 Fetch existing data function
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/SupervisorResearches/BySupervisor?supid=${supId}`);
      if (response.data && response.data.length > 0) {
        // Assume API returns an array, pick first item
        setForm(response.data[0]);
      }
    } catch (err) {
      console.error(err);
      notification().error('Failed to fetch research details');
    } finally {
      setLoading(false);
    }
  };

  // 🔁 Fetch existing data on mount
  useEffect(() => {
    fetchData();
  }, [supId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle numeric fields
    if (['researchYear', 'phd_Awarded', 'phd_UnderSupervision', 'mPhil_Awarded', 'dissertation', 'mPhil_UnderSupervision', 'dissertationUnderSupervision'].includes(name)) {
      // Allow only non-negative integers
      const numericValue = value.replace(/[^0-9]/g, '');
      setForm((prev) => ({ ...prev, [name]: numericValue }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.researchArea.trim()) {
      notification().error('Research Area is required');
      return;
    }
    if (!form.researchYear || form.researchYear <= 0) {
      notification().error('Research Experience (Years) is required and must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      const response = form.id
        ? await API.put(`/SupervisorResearches/${form.id}`, form)
        : await API.post(`/SupervisorResearches`, form);
      
      // Refresh data after successful save/update
      await fetchData();

      notification().success(form.id ? 'Research details updated successfully' : 'Research details saved successfully');
      
      if (!form.id && response.data?.id) {
        // Update id after creating
        setForm((prev) => ({ ...prev, id: response.data.id }));
      }
    } catch (err) {
      console.error('Error saving research details:', err);
      
      if (err.response?.status === 400) {
        if (err.response.data?.message) {
          notification().error(`Validation Error: ${err.response.data.message}`);
        } else {
          notification().error('Please check all required fields and try again');
        }
      } else if (err.response?.status === 500) {
        notification().error('Server error occurred. Please try again later');
      } else if (err.response?.data?.message) {
        notification().error(`Error: ${err.response.data.message}`);
      } else {
        notification().error('Failed to save research details. Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl bg-white shadow-lg border border-gray-200">
          {/* Header */}
          <div className="rounded-t-xl px-6 py-4">
            <h2 className="text-2xl font-bold text-black">
              Research Details
            </h2>
          </div>

          <div className="p-6 space-y-8">
            {/* Research Area & Experience */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Research Area / Specialization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="researchArea"
                  value={form.researchArea}
                  onChange={handleChange}
                  className={inputStyle}
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Research Experience (Years) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="researchYear"
                  value={form.researchYear}
                  onChange={handleChange}
                  className={inputStyle}
                />
              </div>
            </div>

            {/* Students Details */}
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700">
                Research Students Details (Numbers Only) <span className="text-red-500">*</span>
              </label>

              <div className="overflow-hidden rounded-lg border border-gray-300">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">
                        Programme
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-gray-700">
                        Awarded
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-gray-700">
                        Under Supervision
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      ['Ph. D.', 'phd_Awarded', 'phd_UnderSupervision'],
                      ['M. Phil.', 'mPhil_Awarded', 'mPhil_UnderSupervision'],
                      [
                        'Dissertation / Projects',
                        'dissertation',
                        'dissertationUnderSupervision'
                      ]
                    ].map(([label, awarded, supervision]) => (
                      <tr key={label}>
                        <td className="px-4 py-2 text-gray-700">{label}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            name={awarded}
                            value={form[awarded]}
                            onChange={handleChange}
                            className={inputStyle + ' text-center'}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            name={supervision}
                            value={form[supervision]}
                            onChange={handleChange}
                            className={inputStyle + ' text-center'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Researcher IDs */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-gray-800 uppercase tracking-wide">
                Researcher Profiles
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  ['Scopus', 'scopus'],
                  ['ORCID', 'orchid'],
                  ['Publons', 'publOns'],
                  ['Vidwan', 'vidwan'],
                  ['Google Scholar', 'googleScholar'],
                   ['Research Gate', 'researchGate']
                ].map(([label, name]) => (
                  <div
                    key={name}
                    //className={name === ''}
                  >
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {label}
                    </label>
                    <input
                      type="text"
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      className={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Action */}
            <div className="flex justify-between items-center border-t pt-6">
              <Button type="primary"
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-md bg-black px-8 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50 transition"
              >
                {loading
                  ? 'Saving...'
                  : form.id
                    ? 'Update Details'
                    : 'Save Details'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchDetails;
