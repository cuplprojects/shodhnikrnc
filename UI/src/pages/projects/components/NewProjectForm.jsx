import React, { useEffect, useState } from "react";
import { getAllFacultyUsers } from "../../../api/facultyUsersApi";
import { listActiveDepartments } from "../../../api/departmentsApi";

const BUDGET_HEADS = [
  "Equipment/Non-recurring",
  "Recurring: Consumable",
  "Recurring: Contingency",
  "Recurring: Travel",
  "Recurring: Overhead",
  "Recurring: Field charges",
  "Recurring: Manpower",
  "Other",
];

export default function NewProjectForm({ onSubmit, isSubmitting = false, initialData = null }) {
  // This form is now office-only (see PageCatalogue's projects.new entry):
  // a PI creates a project themselves through /proposals/new, which becomes
  // a Project automatically once the office records the agency's sanction.
  // This form only exists for entering a legacy/offline-sanctioned project
  // that never had a proposal on file, so the office user filling it in is
  // never the project's owner -- they must pick who is.
  const [ownerUserId, setOwnerUserId] = useState(initialData?.ownerUserId || "");
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(true);

  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([getAllFacultyUsers(), listActiveDepartments()])
      .then(([users, deps]) => {
        if (active) {
          setFacultyOptions(users ?? []);
          setDepartments(deps ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setFacultyOptions([]);
          setDepartments([]);
        }
      })
      .finally(() => { if (active) setIsLoadingFaculty(false); });
    return () => { active = false; };
  }, []);

  const [projectType, setProjectType] = useState(initialData?.projectType || "Type-I: Research Projects");
  const [sanctionNo, setSanctionNo] = useState(initialData?.sanctionNo || "");
  const [sanctionDate, setSanctionDate] = useState(initialData?.sanctionDate || "");
  const [projectTitle, setProjectTitle] = useState(initialData?.projectTitle || "");
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [sameDate, setSameDate] = useState(initialData?.sameDate || false);
  const [agency, setAgency] = useState(initialData?.agency || "");
  const [duration, setDuration] = useState(initialData?.duration || "");
  const [totalSanctioned, setTotalSanctioned] = useState(initialData?.totalSanctioned || "");
  const [overheadPercent, setOverheadPercent] = useState(initialData?.overheadPercent ?? "");
  const [validationError, setValidationError] = useState("");
  const [collabCount, setCollabCount] = useState(initialData?.collabCount ?? initialData?.collaborators?.length ?? 0);
  const [collaborators, setCollaborators] = useState(initialData?.collaborators || []);

  // Budget state: array of objects representing each budget head
  const [budgetRows, setBudgetRows] = useState(
    initialData?.budgetRows || BUDGET_HEADS.map((head) => ({
      head,
      checked: false,
      years: {}, // stores values per year: { 1: "", 2: "", ... }
      customLabel: "",
    }))
  );

  // Equipment and Manpower dynamic tables
  const [equipments, setEquipments] = useState(initialData?.equipments?.length ? initialData.equipments : [{ name: "", unit: "", amount: "" }]);

  // Convert backend HRA amount back to percentage for the UI if editing
  const initialManpower = initialData?.manpower?.length ? initialData.manpower.map(mp => {
    const stipendVal = parseFloat(mp.stipend) || 0;
    const hraAmount = parseFloat(mp.hra) || 0;
    const hraPct = stipendVal > 0 ? (hraAmount / stipendVal) * 100 : 0;
    return { ...mp, hra: hraPct > 0 ? hraPct.toString() : "" };
  }) : [{ designation: "", positions: "", stipend: "", hra: "" }];

  const [manpower, setManpower] = useState(initialManpower);

  // "Same as sanction date" mirrors the sanction date into the start date. Both
  // writes happen in the handlers that cause them rather than in an effect, which
  // would re-render a second time after every keystroke on the sanction date.
  const handleSanctionDateChange = (e) => {
    const value = e.target.value;
    setSanctionDate(value);
    if (sameDate && value) {
      setStartDate(value);
    }
  };

  const handleSameDateChange = (e) => {
    const checked = e.target.checked;
    setSameDate(checked);
    setStartDate(checked && sanctionDate ? sanctionDate : "");
  };

  // Render collaborator inputs dynamically
  const handleCollabCountChange = (e) => {
    const count = parseInt(e.target.value) || 0;
    setCollabCount(count);
    setCollaborators((prev) => {
      const next = [...prev];
      if (next.length < count) {
        while (next.length < count) {
          next.push({ isInsideInstitute: false, institute: "", faculty: "", department: "", designation: "" });
        }
      } else {
        next.splice(count);
      }
      return next;
    });
  };

  const handleCollaboratorChange = (index, field, value) => {
    setCollaborators((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleInstituteTypeChange = (index, isInside) => {
    setCollaborators((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isInsideInstitute: isInside,
        institute: isInside ? 'MNNIT Allahabad' : '',
        faculty: '',
        department: '',
        designation: ''
      };
      return next;
    });
  };

  const handleFacultySelection = (index, userId) => {
    const selected = facultyOptions.find(f => f.userId === userId);
    setCollaborators((prev) => {
      const next = [...prev];
      if (selected) {
        next[index] = {
          ...next[index],
          faculty: selected.name || '',
          designation: selected.designation || '',
        };
      } else {
        next[index] = { ...next[index], faculty: '' };
      }
      return next;
    });
  };

  // Helper suffix for collaborators list (1st, 2nd, etc.)
  const getOrdinalSuffix = (n) => {
    if (n % 100 >= 11 && n % 100 <= 13) return "th";
    switch (n % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  // Dynamically calculate years count based on duration (12 months = 1 year, 35 months = 3 years, 44 months = 4 years, etc.)
  const yearsCount = duration && Number(duration) > 0 ? Math.ceil(Number(duration) / 12) : 3;

  // Budget calculations
  const handleBudgetCheckboxChange = (index, checked) => {
    setValidationError("");
    setBudgetRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        checked,
        // Reset years values if unchecked
        years: checked ? next[index].years : {}
      };
      return next;
    });
  };

  const handleBudgetAmountChange = (index, yearNum, value) => {
    setValidationError("");
    setBudgetRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        years: {
          ...next[index].years,
          [yearNum]: value
        }
      };
      return next;
    });
  };

  const addOtherBudgetRow = () => {
    setBudgetRows((prev) => [
      ...prev,
      {
        head: "Other",
        checked: true,
        years: {},
        customLabel: "",
      }
    ]);
  };

  const removeOtherBudgetRow = (index) => {
    setBudgetRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Equipment table operations
  const addEquipmentRow = () => {
    setEquipments((prev) => [...prev, { name: "", unit: "", amount: "" }]);
  };

  const removeEquipmentRow = (index) => {
    setEquipments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEquipmentChange = (index, field, value) => {
    setEquipments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Manpower table operations
  const addManpowerRow = () => {
    setManpower((prev) => [...prev, { designation: "", positions: "", stipend: "", hra: "" }]);
  };

  const removeManpowerRow = (index) => {
    setManpower((prev) => prev.filter((_, i) => i !== index));
  };

  const handleManpowerChange = (index, field, value) => {
    setManpower((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Compute column totals (dynamic based on calculated yearsCount)
  const yearTotals = Array.from({ length: yearsCount }, (_, i) => {
    const yearNum = i + 1;
    return budgetRows.reduce((sum, r) => sum + (parseFloat(r.years[yearNum]) || 0), 0);
  });
  const grandTotal = yearTotals.reduce((sum, val) => sum + val, 0);

  const parsedTotalSanctioned = parseFloat(totalSanctioned) || 0;
  const isBudgetExceeded = parsedTotalSanctioned > 0 && grandTotal > parsedTotalSanctioned;

  // Helper to calculate total for a budget head row
  const getRowTotal = (row) => {
    let sum = 0;
    for (let y = 1; y <= yearsCount; y++) {
      sum += parseFloat(row.years[y]) || 0;
    }
    return sum;
  };

  // Whether Equipment and Manpower sections are visible
  const isEquipmentVisible = budgetRows.some(
    (r) => r.head.toLowerCase().includes("equipment") && r.checked
  );
  const isManpowerVisible = budgetRows.some(
    (r) => r.head.toLowerCase().includes("manpower") && r.checked
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    const currentTotalSanctioned = parseFloat(totalSanctioned) || 0;
    if (currentTotalSanctioned > 0 && grandTotal > currentTotalSanctioned) {
      const errorMsg = `Total budget from sanctioned budget heads (₹${grandTotal.toFixed(2)}) cannot be greater than Total Budget Sanctioned (to MNNIT only) (₹${currentTotalSanctioned.toFixed(2)}).`;
      setValidationError(errorMsg);
      return;
    }

    // Convert HRA percentage to absolute amount before sending to backend
    const processedManpower = manpower.map(mp => {
      const stipendVal = parseFloat(mp.stipend) || 0;
      const hraPct = parseFloat(mp.hra) || 0;
      const hraAmount = (stipendVal * hraPct) / 100;
      return {
        ...mp,
        hra: hraAmount
      };
    });

    onSubmit({
      ownerUserId: ownerUserId || undefined,
      projectType,
      sanctionNo,
      sanctionDate,
      projectTitle,
      startDate,
      sameDate,
      agency,
      duration: Number(duration),
      totalSanctioned: Number(totalSanctioned),
      overheadPercent: overheadPercent === "" ? null : Number(overheadPercent),
      collabCount,
      collaborators,
      budgetRows,
      equipments: isEquipmentVisible ? equipments : [],
      manpower: isManpowerVisible ? processedManpower : []
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md overflow-hidden transition-all duration-300 w-full leading-snug">
      <div className="h-1 " />
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight leading-tight">Add New Project</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
            Fill in the details below to submit a new proposal draft.
          </p>
        </div>

        {validationError && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="font-semibold">{validationError}</div>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Principal Investigator */}
          {/* <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Principal Investigator <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              disabled={isLoadingFaculty}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all disabled:opacity-60"
            >
              <option value="">
                {isLoadingFaculty ? "Loading faculty…" : "-- Select the project's PI --"}
              </option>
              {facultyOptions.map((f) => (
                <option key={f.userId} value={f.userId}>
                  {f.name}{f.department ? ` (${f.department})` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              The project belongs to this faculty member, not to whoever fills in this form.
            </p>
          </div> */}

          {/* Project Type Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Project Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                "Type-I: Research Projects",
                "Type-II: Industry sponsored Projects",
                "Type-III: Consultancy Project",
                "Type IV: Testing",
                "Type V: Other activities"
              ].map((type) => (
                <label
                  key={type}
                  className={`flex items-center space-x-2.5 p-2.5 border rounded-lg cursor-pointer transition ${projectType === type
                    ? "bg-violet-50/50 border-violet-500 text-violet-900 dark:bg-violet-950/20 dark:border-violet-600 dark:text-violet-300"
                    : "border-slate-200 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  <input
                    type="radio"
                    name="project_type"
                    value={type}
                    checked={projectType === type}
                    onChange={() => setProjectType(type)}
                    className="form-radio text-violet-600 focus:ring-violet-500 h-3.5 w-3.5 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-xs font-medium leading-none">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Basic project info */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
              Basic Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sanction No.
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. DST/SERB/2026/001"
                  value={sanctionNo}
                  onChange={(e) => setSanctionNo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition text-xs leading-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sanction Date
                </label>
                <input
                  required
                  type="date"
                  value={sanctionDate}
                  onChange={handleSanctionDateChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition text-xs leading-normal"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Project Title
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="e.g. AI-driven Smart Grid Optimization"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition resize-y text-xs leading-normal"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Date of Start
                  </label>
                  <label className="flex items-center text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sameDate}
                      onChange={handleSameDateChange}
                      className="form-checkbox text-violet-600 focus:ring-violet-500 rounded mr-1 h-3 w-3 border-slate-300 dark:border-slate-700"
                    />
                    Same as sanction date
                  </label>
                </div>
                <input
                  required
                  type="date"
                  value={startDate}
                  readOnly={sameDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition text-xs leading-normal ${sameDate
                    ? "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-500"
                    : "border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white"
                    }`}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Agency
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. DST, SERB, ISRO"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition text-xs leading-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Duration (months)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="e.g. 36"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition text-xs leading-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Budget Sanctioned (to MNNIT only) (₹)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1500000.00"
                  value={totalSanctioned}
                  onChange={(e) => {
                    setTotalSanctioned(e.target.value);
                    if (validationError) setValidationError("");
                  }}
                  className={`w-full px-3 py-1.5 rounded-lg border bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 transition text-xs leading-normal ${isBudgetExceeded
                    ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500 text-rose-900 dark:text-rose-200"
                    : "border-slate-300 dark:border-slate-700 focus:ring-violet-600 focus:border-transparent"
                    }`}
                />
                {isBudgetExceeded && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5 flex items-center gap-1">
                    <span>&bull;</span> Budget heads total (₹{grandTotal.toFixed(2)}) exceeds Total Sanctioned (₹{parsedTotalSanctioned.toFixed(2)})
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Overhead (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 10"
                  value={overheadPercent}
                  onChange={(e) => setOverheadPercent(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition text-xs leading-normal"
                />
              </div>
            </div>
          </div>

          {/* Collaboration section */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
              Co-Principal Investigators (Co-PI) & Collaborating Institutes
            </h3>
            <div className="space-y-2">
              <div className="w-full md:w-1/4 space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  No. of Co-PIs / Collaborators
                </label>
                <select
                  value={collabCount}
                  onChange={handleCollabCountChange}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-violet-600 focus:border-transparent transition cursor-pointer text-xs leading-normal"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>

              {collaborators.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800">
                  {collaborators.map((c, index) => (
                    <div key={index} className="space-y-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {index + 1}{getOrdinalSuffix(index + 1)} Collaborator
                        </label>
                        <div className="flex gap-4 text-[11px]">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              checked={!c.isInsideInstitute}
                              onChange={() => handleInstituteTypeChange(index, false)}
                              className="text-violet-600 focus:ring-violet-500"
                            />
                            Outside Institute
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              checked={c.isInsideInstitute}
                              onChange={() => handleInstituteTypeChange(index, true)}
                              className="text-violet-600 focus:ring-violet-500"
                            />
                            Inside Institute
                          </label>
                        </div>
                      </div>

                      {c.isInsideInstitute ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <select
                            required
                            value={c.department || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCollaborators((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  department: value,
                                  faculty: '',
                                  designation: ''
                                };
                                return next;
                              });
                            }}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:ring-1 focus:ring-violet-600 focus:outline-none transition text-xs"
                          >
                            <option value="">-- Select Department --</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                          <select
                            required
                            value={facultyOptions.find(f => f.name === c.faculty && f.department === c.department)?.userId || ""}
                            onChange={(e) => handleFacultySelection(index, e.target.value)}
                            disabled={!c.department}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:ring-1 focus:ring-violet-600 focus:outline-none transition text-xs"
                          >
                            <option value="">-- Select Faculty --</option>
                            {facultyOptions
                              .filter(f => f.department === c.department)
                              .map(f => (
                                <option key={f.userId} value={f.userId}>
                                  {f.name} ({f.designation || 'Faculty'})
                                </option>
                              ))}
                          </select>
                          <input
                            required
                            type="text"
                            placeholder="Designation"
                            value={c.designation || ""}
                            readOnly
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 cursor-not-allowed text-xs"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <input
                            required
                            type="text"
                            placeholder="Collaborator Name"
                            value={c.faculty || ""}
                            onChange={(e) => handleCollaboratorChange(index, "faculty", e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:ring-1 focus:ring-violet-600 focus:outline-none transition text-xs"
                          />
                          <input
                            required
                            type="text"
                            placeholder="Institute Name"
                            value={c.institute || ""}
                            onChange={(e) => handleCollaboratorChange(index, "institute", e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:ring-1 focus:ring-violet-600 focus:outline-none transition text-xs"
                          />
                          <input
                            required
                            type="text"
                            placeholder="Department"
                            value={c.department || ""}
                            onChange={(e) => handleCollaboratorChange(index, "department", e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:ring-1 focus:ring-violet-600 focus:outline-none transition text-xs"
                          />
                          <input
                            required
                            type="text"
                            placeholder="Designation"
                            value={c.designation || ""}
                            onChange={(e) => handleCollaboratorChange(index, "designation", e.target.value)}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-950 dark:text-white focus:ring-1 focus:ring-violet-600 focus:outline-none transition text-xs"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Budget Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
              Sanctioned Budget Heads
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-[11px] border-collapse min-w-[650px] leading-tight">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                    <th className="text-left px-3 py-2">Tick the budget heads sanctioned</th>
                    {Array.from({ length: yearsCount }, (_, i) => (
                      <th key={i} className="text-center px-3 py-2">
                        {i + 1}
                        {getOrdinalSuffix(i + 1)} year (₹)
                      </th>
                    ))}
                    <th className="text-center px-3 py-2">Total budget (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {budgetRows.map((row, index) => {
                    const otherRows = budgetRows.filter((r) => r.head === "Other");
                    return (
                      <tr
                        key={row.id || `${row.head}-${row.customLabel || index}`}
                        className={`transition ${row.checked ? "bg-violet-50/10 dark:bg-violet-950/5" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/10"
                          }`}
                      >
                        <td className="px-3 py-2">
                          <label className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-medium cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={row.checked}
                              onChange={(e) => handleBudgetCheckboxChange(index, e.target.checked)}
                              className="form-checkbox text-violet-600 focus:ring-violet-500 rounded h-3.5 w-3.5 border-slate-300 dark:border-slate-700"
                            />
                            <span className="text-[11px]">{row.head}</span>
                          </label>
                          {row.head === "Other" && row.checked && (
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="text"
                                placeholder="Describe this budget head (e.g. Car Parts)"
                                value={row.customLabel || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setBudgetRows((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], customLabel: value };
                                    return next;
                                  });
                                }}
                                className="w-full text-[11px] px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                              />
                              {otherRows.length > 1 && (
                                <button
                                  type="button"
                                  title="Remove this Other budget head"
                                  onClick={() => removeOtherBudgetRow(index)}
                                  className="text-rose-500 hover:text-rose-700 px-1 text-sm font-bold shrink-0 cursor-pointer"
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        {Array.from({ length: yearsCount }, (_, i) => {
                          const yearNum = i + 1;
                          return (
                            <td key={i} className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                disabled={!row.checked}
                                placeholder="0"
                                value={row.years[yearNum] || ""}
                                onChange={(e) => handleBudgetAmountChange(index, yearNum, e.target.value)}
                                className="w-full text-center px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition disabled:bg-slate-50 dark:disabled:bg-slate-950/60 disabled:text-slate-400 text-xs leading-none"
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            readOnly
                            placeholder="0.00"
                            value={getRowTotal(row).toFixed(2)}
                            className="w-full text-center px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold text-xs leading-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-950/60 font-bold border-t border-slate-200 dark:border-slate-800 text-[11px]">
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                      Year-wise Total (₹)
                    </td>
                    {yearTotals.map((tot, i) => (
                      <td key={i} className="px-3 py-2 text-center text-slate-900 dark:text-white font-semibold">
                        {tot.toFixed(2)}
                      </td>
                    ))}
                    <td
                      className={`px-3 py-2 text-center font-extrabold rounded-br-lg transition-colors ${isBudgetExceeded
                        ? "bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-2 border-rose-500"
                        : "bg-violet-100 dark:bg-violet-950/50 text-violet-900 dark:text-violet-200"
                        }`}
                    >
                      {grandTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={addOtherBudgetRow}
                className="flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 transition cursor-pointer"
              >
                <span className="border border-dashed border-violet-500/50 dark:border-violet-400/40 rounded px-2 py-0.5">
                  + Add Another "Other" Budget Head
                </span>
              </button>
            </div>

            {isBudgetExceeded && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>
                <span>
                  Validation Error: Total budget from sanctioned budget heads (₹{grandTotal.toFixed(2)}) cannot be greater than Total Budget Sanctioned (to MNNIT only) (₹{parsedTotalSanctioned.toFixed(2)}).
                </span>
              </div>
            )}
          </div>

          {/* Equipment / Non-recurring details section */}
          {isEquipmentVisible && (
            <div className="space-y-3 pt-1 animate-fadeIn">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
                Equipment / Non-recurring Details
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-[11px] border-collapse min-w-[550px] leading-tight">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      <th className="w-10 text-center px-3 py-2">S. No.</th>
                      <th className="text-left px-3 py-2">Equipment Name</th>
                      <th className="w-28 text-center px-3 py-2">Unit</th>
                      <th className="w-40 text-right px-3 py-2">Amount Sanctioned (₹)</th>
                      <th className="w-14 text-center px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {equipments.map((eq, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="px-3 py-1.5 text-center font-medium text-slate-500">{index + 1}</td>
                        <td className="px-3 py-1.5">
                          <input
                            required
                            type="text"
                            placeholder="e.g. Server Cluster"
                            value={eq.name}
                            onChange={(e) => handleEquipmentChange(index, "name", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition text-xs leading-none"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            required
                            type="text"
                            placeholder="e.g. Nos / Set"
                            value={eq.unit}
                            onChange={(e) => handleEquipmentChange(index, "unit", e.target.value)}
                            className="w-full text-center px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition text-xs leading-none"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            required
                            type="number"
                            min="0"
                            placeholder="0"
                            value={eq.amount}
                            onChange={(e) => handleEquipmentChange(index, "amount", e.target.value)}
                            className="w-full text-right px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition text-xs leading-none"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {equipments.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeEquipmentRow(index)}
                              className="text-rose-600 dark:text-rose-400 font-bold hover:text-rose-800 transition px-1.5 text-sm cursor-pointer"
                            >
                              &times;
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={addEquipmentRow}
                  className="flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 transition cursor-pointer"
                >
                  <span className="border border-dashed border-violet-500/50 dark:border-violet-400/40 rounded px-2 py-0.5">
                    + Add Equipment Row
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Manpower details section */}
          {isManpowerVisible && (
            <div className="space-y-3 pt-1 animate-fadeIn">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
                Manpower Details
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-[11px] border-collapse min-w-[650px] leading-tight">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      <th className="w-10 text-center px-3 py-2">S. No.</th>
                      <th className="text-left px-3 py-2">Designation</th>
                      <th className="w-20 text-center px-3 py-2">Positions</th>
                      <th className="w-32 text-right px-3 py-2">Monthly Stipend (₹)</th>
                      <th className="w-28 text-right px-3 py-2">HRA (%)</th>
                      <th className="w-14 text-center px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {manpower.map((mp, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="px-3 py-1.5 text-center font-medium text-slate-500">{index + 1}</td>
                        <td className="px-3 py-1.5">
                          <input
                            required
                            type="text"
                            placeholder="e.g. JRF / SRF"
                            value={mp.designation}
                            onChange={(e) => handleManpowerChange(index, "designation", e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition text-xs leading-none"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            required
                            type="number"
                            min="1"
                            placeholder="1"
                            value={mp.positions}
                            onChange={(e) => handleManpowerChange(index, "positions", e.target.value)}
                            className="w-full text-center px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition text-xs leading-none"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            required
                            type="number"
                            min="0"
                            placeholder="0"
                            value={mp.stipend}
                            onChange={(e) => handleManpowerChange(index, "stipend", e.target.value)}
                            className="w-full text-right px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition text-xs leading-none"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            required
                            type="number"
                            min="0"
                            placeholder="0"
                            value={mp.hra}
                            onChange={(e) => handleManpowerChange(index, "hra", e.target.value)}
                            className="w-full text-right px-2 py-1 border border-slate-200 dark:border-slate-800 rounded bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition text-xs leading-none"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {manpower.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeManpowerRow(index)}
                              className="text-rose-600 dark:text-rose-400 font-bold hover:text-rose-800 transition px-1.5 text-sm cursor-pointer"
                            >
                              &times;
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={addManpowerRow}
                  className="flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 transition cursor-pointer"
                >
                  <span className="border border-dashed border-violet-500/50 dark:border-violet-400/40 rounded px-2 py-0.5">
                    + Add Manpower Row
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2 bg-gray-400 rounded-lg hover:hover:text-gray-900 font-semibold text-xs shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? "Saving Project..." : "Save Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
