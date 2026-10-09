import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { listActiveDepartments } from '../../../api/departmentsApi';
import { getAllFacultyUsers } from '../../../api/facultyUsersApi';

const FIELD_CLASS =
  'w-full px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 ' +
  'rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-sm shadow-sm';

const SELECT_CLASS =
  'w-full px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 ' +
  'rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-sm shadow-sm cursor-pointer';

export default function ProposalCoPiFieldArray({ items, onChange }) {
  const [departments, setDepartments] = useState([]);
  const [faculty, setFaculty] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([listActiveDepartments(), getAllFacultyUsers()])
      .then(([deps, facs]) => {
        if (active) {
          setDepartments(deps || []);
          setFaculty(facs || []);
        }
      })
      .catch(err => console.error("Failed to fetch deps/faculty for CoPI picker", err));
    return () => { active = false; };
  }, []);

  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addItem = () => onChange([...items, { isInsideInstitute: false, instituteName: '', name: '', department: '', designation: '' }]);
  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));

  const handleInstituteTypeChange = (index, isInside) => {
    const next = [...items];
    next[index] = {
      ...next[index],
      isInsideInstitute: isInside,
      instituteName: isInside ? 'MNNIT Allahabad' : '',
      name: '',
      department: '',
      designation: ''
    };
    onChange(next);
  };

  const handleFacultySelection = (index, userId) => {
    const selected = faculty.find(f => f.userId === userId);
    if (selected) {
      const next = [...items];
      next[index] = {
        ...next[index],
        name: selected.name || '',
        designation: selected.designation || '',
      };
      onChange(next);
    } else {
      updateItem(index, 'name', '');
    }
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50 relative">
          <button
            type="button" onClick={() => removeItem(index)}
            aria-label={`Remove Co-PI ${index + 1}`}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>

          <div className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">
            Co-PI {index + 1}
          </div>

          <div className="flex gap-4 items-center text-sm mb-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                checked={!item.isInsideInstitute}
                onChange={() => handleInstituteTypeChange(index, false)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              Outside Institute
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                checked={item.isInsideInstitute}
                onChange={() => handleInstituteTypeChange(index, true)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              Inside Institute
            </label>
          </div>

          {item.isInsideInstitute ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                required
                value={item.department}
                onChange={(e) => {
                  const next = [...items];
                  next[index] = { 
                    ...next[index], 
                    department: e.target.value,
                    name: '',
                    designation: '' 
                  };
                  onChange(next);
                }}
                className={SELECT_CLASS}
              >
                <option value="">-- Select Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <select
                required
                value={faculty.find(f => f.name === item.name && f.department === item.department)?.userId || ''}
                onChange={(e) => handleFacultySelection(index, e.target.value)}
                className={SELECT_CLASS}
                disabled={!item.department}
              >
                <option value="">-- Select Faculty --</option>
                {faculty
                  .filter(f => f.department === item.department)
                  .map(f => (
                    <option key={f.userId} value={f.userId}>
                      {f.name} ({f.designation || 'Faculty'})
                    </option>
                  ))}
              </select>
              <input
                required value={item.designation} placeholder="Designation"
                readOnly
                className={`${FIELD_CLASS} bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed`}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                required value={item.name || ''} placeholder="Co-PI Name"
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className={FIELD_CLASS}
              />
              <input
                required value={item.instituteName || ''} placeholder="Institute Name"
                onChange={(e) => updateItem(index, 'instituteName', e.target.value)}
                className={FIELD_CLASS}
              />
              <input
                required value={item.department || ''} placeholder="Department"
                onChange={(e) => updateItem(index, 'department', e.target.value)}
                className={FIELD_CLASS}
              />
              <input
                required value={item.designation || ''} placeholder="Designation"
                onChange={(e) => updateItem(index, 'designation', e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          )}
        </div>
      ))}
      <button
        type="button" onClick={addItem}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <Plus size={14} /> Add Co-PI
      </button>
    </div>
  );
}
