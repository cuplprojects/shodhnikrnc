import { useState, useEffect } from "react";
import {
  listProjects,
  getSanctionedManpowerPositions,
  getProject,
  createOfferLetter,
} from "../api/projectsApi";
import { useTheme } from "../layout/useTheme";
import toast from 'react-hot-toast';
import {
  BriefcaseBusiness,
  UserRound,
  UsersRound,
  MapPin,
  IndianRupee,
  FileText,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
} from "lucide-react";

const SectionHeader = ({ icon: Icon, title, type = "blue" }) => {
  const styles =
    type === "green"
      ? {
          wrapper: "bg-[#eaf8f2] dark:bg-slate-700",
          icon: "bg-[#d9f3e7] dark:bg-slate-600 text-[#0b9b68] dark:text-green-400",
          text: "text-[#064c39] dark:text-green-300",
        }
      : {
          wrapper: "bg-[#edf4ff] dark:bg-slate-700",
          icon: "bg-[#dceaff] dark:bg-slate-600 text-[#1769e8] dark:text-blue-400",
          text: "text-[#123b70] dark:text-blue-300",
        };

  return (
    <div
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 mb-4 ${styles.wrapper} transition-colors duration-200`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${styles.icon}`}
      >
        <Icon size={18} strokeWidth={2.2} />
      </div>

      <h2 className={`text-[16px] font-bold ${styles.text}`}>{title}</h2>
    </div>
  );
};

const FormField = ({
  label,
  required = false,
  icon: Icon,
  placeholder,
  value,
  onChange,
  onBlur,
  onKeyDown,
  maxLength,
  type = "text",
  children,
  full = false,
  error,
}) => {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-[13px] font-semibold text-[#17365d] dark:text-slate-200 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        {Icon && (
          <div className="absolute left-0 top-0 h-full w-[46px] flex items-center justify-center border-r border-[#dce3ee] dark:border-slate-600 text-[#1769e8] dark:text-blue-400">
            <Icon size={19} strokeWidth={2} />
          </div>
        )}

        {children ? (
          children
        ) : type === "textarea" ? (
          <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={3}
            className="w-full rounded-md border border-[#d4deeb] dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-[14px] text-[#1d2c42] dark:text-slate-100 outline-none transition placeholder:text-[#71819a] dark:placeholder:text-slate-400 focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 resize-none"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            maxLength={maxLength}
            placeholder={placeholder}
            className={`w-full h-[44px] rounded-md border ${
              error
                ? "border-red-500 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900"
                : "border-[#d4deeb] dark:border-slate-600 focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-blue-100 dark:focus:ring-blue-900"
            } bg-white dark:bg-slate-700 text-[14px] text-[#1d2c42] dark:text-slate-100 outline-none transition placeholder:text-[#71819a] dark:placeholder:text-slate-400 focus:ring-2 ${
              Icon ? "pl-[58px] pr-4" : "px-4"
            }`}
          />
        )}
      </div>
      {error && (
        <p className="mt-1 text-[12px] font-semibold text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

const SelectField = ({
  label,
  required = false,
  icon: Icon,
  value,
  onChange,
  children,
}) => {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#17365d] dark:text-slate-200 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-[1px] top-[1px] bottom-[1px] w-[46px] flex items-center justify-center border-r border-[#dce3ee] dark:border-slate-600 bg-[#f8fafc] dark:bg-slate-800 text-[#1769e8] dark:text-blue-400 pointer-events-none z-10 rounded-l-[5px]">
            <Icon size={19} strokeWidth={2} />
          </div>
        )}

        <select
          value={value}
          onChange={onChange}
          className={`appearance-none w-full h-[44px] rounded-md border border-[#d4deeb] dark:border-slate-600 bg-white dark:bg-slate-700 text-[14px] text-[#1d2c42] dark:text-slate-100 outline-none focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition ${
            Icon ? "pl-[58px]" : "pl-4"
          } pr-10`}
        >
          {children}
        </select>

        <ChevronDown
          size={17}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#172a45] dark:text-slate-400 pointer-events-none"
        />
      </div>
    </div>
  );
};

const AmountField = ({
  label,
  required = false,
  placeholder,
  value,
  onChange,
  prefix = "₹",
  max,
  disabled = false,
}) => {
  const handleChange = (e) => {
    if (disabled) return;
    let value = e.target.value;

    // Remove anything except numbers and decimal point
    value = value.replace(/[^0-9.]/g, "");

    // Allow only one decimal point
    const parts = value.split(".");
    if (parts.length > 2) {
      value = parts[0] + "." + parts.slice(1).join("");
    }

    // Prevent negative values
    if (Number(value) < 0) {
      value = "0";
    }

    // Optional maximum value
    if (max !== undefined && Number(value) > max) {
      value = max.toString();
    }

    onChange &&
      onChange({
        target: {
          value,
        },
      });
  };

  return (
    <div>
      <label className="block text-[12px] font-semibold text-[#17365d] dark:text-slate-200 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div
        className={`flex h-[44px] rounded-md border border-[#d4deeb] dark:border-slate-600 overflow-hidden ${
          disabled
            ? "bg-[#f1f5f9] dark:bg-slate-800/80 cursor-not-allowed opacity-90"
            : "bg-white dark:bg-slate-700 focus-within:border-[#1769e8] dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900"
        } transition`}
      >
        <div className="w-[45px] flex items-center justify-center bg-[#f5f7fa] dark:bg-slate-600 border-r border-[#dce3ee] dark:border-slate-500 text-[#17365d] dark:text-slate-200 font-semibold">
          {prefix}
        </div>

        <input
          type="number"
          min="0"
          max={max}
          step="0.01"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          readOnly={disabled}
          onKeyDown={(e) => {
            // Prevent minus key
            if (e.key === "-" || e.key === "e") {
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
          className={`flex-1 min-w-0 px-3 outline-none text-[14px] ${
            disabled
              ? "bg-transparent text-[#64748b] dark:text-slate-400 cursor-not-allowed font-medium"
              : "bg-white dark:bg-slate-700 text-[#1d2c42] dark:text-slate-100 placeholder:text-[#71819a] dark:placeholder:text-slate-400"
          }`}
        />
      </div>
    </div>
  );
};

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export default function GenerateManpowerOfferLetter() {
  useTheme();
  const [form, setForm] = useState({
    project: "",
    position: "",
    candidateName: "",
    gender: "",
    parentName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    defaultFellowship: "",
    fellowship: "",
    hraPercentage: "",
    defaultHra: "",
    joiningDate: new Date().toISOString().split("T")[0],
  });

  const [projects, setProjects] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState(null);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [pincodeError, setPincodeError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoadingProjects(true);
    setProjectsError(null);
    listProjects()
      .then((data) => {
        if (isMounted) {
          const rawList = Array.isArray(data)
            ? data
            : data?.items || data?.data || data?.projects || [];
          const uniqueMap = new Map();
          rawList.forEach((p) => {
            if (p && p.id) {
              if (!uniqueMap.has(p.id)) {
                uniqueMap.set(p.id, p);
              }
            }
          });
          setProjects(Array.from(uniqueMap.values()));
        }
      })
      .catch((err) => {
        console.error("Failed to load projects:", err);
        if (isMounted) {
          setProjectsError(err.message || "Failed to load projects.");
        }
      })
      .finally(() => {
        if (isMounted) setLoadingProjects(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);


  useEffect(() => {
    listProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    if (form.project) {
      getProject(form.project).then(data => {
        setPositions(data.sanctionedManpowerPositions || []);
      }).catch(console.error);
    } else {
      setPositions([]);
    }
  }, [form.project]);

  const updateField = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handlePincodeChange = (e) => {
    let val = e.target.value;
    // Remove all non-digit characters (prevents alphabets, minus sign, decimals)
    val = val.replace(/\D/g, "");

    // Capped at 6 digits
    if (val.length > 6) {
      val = val.slice(0, 6);
    }

    setForm((prev) => ({
      ...prev,
      pincode: val,
    }));

    if (val.length > 0 && val.length < 6) {
      setPincodeError("Please enter valid 6 digit pincode number");
    } else {
      setPincodeError("");
    }
  };

  const handlePincodeBlur = () => {
    // Hide error when field loses focus
    setPincodeError("");
  };

  const handleProjectChange = (e) => {
    const projectId = e.target.value;
    setForm((prev) => ({
      ...prev,
      project: projectId,
      position: "",
      defaultFellowship: "",
      fellowship: "",
      hraPercentage: "",
      defaultHra: "",
    }));
    setPositions([]);

    if (projectId) {
      setLoadingPositions(true);
      getSanctionedManpowerPositions(projectId)
        .then((data) => {
          const rawPositions = Array.isArray(data)
            ? data
            : data?.sanctionedManpowerPositions ||
              data?.positions ||
              data?.data ||
              [];
          setPositions(rawPositions);
        })
        .catch((err) => {
          console.error(
            "Failed to fetch manpower positions, trying fallback getProject:",
            err,
          );
          getProject(projectId)
            .then((p) => {
              const fallback =
                p?.sanctionedManpowerPositions || p?.positions || [];
              setPositions(fallback);
            })
            .catch((err2) => {
              console.error("Failed to fetch project details:", err2);
            });
        })
        .finally(() => {
          setLoadingPositions(false);
        });
    }
  };

  const handlePositionChange = (e) => {
    const posId = e.target.value;
    const selectedPos = positions.find((p) => String(p.id) === String(posId));

    if (selectedPos) {
      const stipendVal =
        selectedPos.stipend !== undefined && selectedPos.stipend !== null
          ? String(selectedPos.stipend)
          : selectedPos.stipendAmount !== undefined &&
              selectedPos.stipendAmount !== null
            ? String(selectedPos.stipendAmount)
            : "";
      const hraVal =
        selectedPos.hra !== undefined && selectedPos.hra !== null
          ? String(selectedPos.hra)
          : selectedPos.hraAmount !== undefined &&
              selectedPos.hraAmount !== null
            ? String(selectedPos.hraAmount)
            : "";

      let calculatedHraPct = "";
      if (Number(stipendVal) > 0 && Number(hraVal) >= 0) {
        calculatedHraPct = (
          (Number(hraVal) / Number(stipendVal)) *
          100
        ).toFixed(2);
        if (calculatedHraPct.endsWith(".00")) {
          calculatedHraPct = calculatedHraPct.slice(0, -3);
        }
      }

      setForm((prev) => ({
        ...prev,
        position: posId,
        defaultFellowship: stipendVal,
        fellowship: stipendVal,
        defaultHra: hraVal,
        hraPercentage: calculatedHraPct,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        position: posId,
        defaultFellowship: "",
        fellowship: "",
        defaultHra: "",
        hraPercentage: "",
      }));
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  const handleGenerate = async () => {
    if (!form.project) {
      toast.error("Please select a project.");
      return;
    }
    if (!form.position) {
      toast.error("Please select a manpower position.");
      return;
    }
    if (!form.candidateName.trim()) {
      toast.error("Please enter Candidate Name.");
      return;
    }
    if (!form.gender) {
      toast.error("Please select Gender.");
      return;
    }
    if (!form.parentName.trim()) {
      toast.error("Please enter Father / Husband / Guardian Name.");
      return;
    }
    if (!form.address.trim()) {
      toast.error("Please enter Address.");
      return;
    }
    if (!form.city.trim()) {
      toast.error("Please enter City.");
      return;
    }
    if (!form.state.trim()) {
      toast.error("Please enter State.");
      return;
    }
    const cleanPincode = form.pincode.trim();
    if (!cleanPincode || !/^\d{6}$/.test(cleanPincode)) {
      setPincodeError("Please enter valid 6 digit pincode number");
      toast.error("Please enter valid 6 digit pincode number");
      return;
    }
    if (!form.fellowship) {
      toast.error("Please enter Fellowship Amount.");
      return;
    }
    if (!form.hraPercentage) {
      toast.error("Please enter HRA Percentage.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitMessage(null);

      const payload = {
        projectId: form.project,
        manpowerId: form.position,
        candidateName: form.candidateName.trim(),
        gender: form.gender,
        parentName: form.parentName.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        fellowshipAmount: parseFloat(form.fellowship) || 0,
        hraPercentage: parseFloat(form.hraPercentage) || 0,
        joiningDate: form.joiningDate,
      };

      await createOfferLetter(payload);
      setSubmitMessage({
        type: "success",
        text: "Offer letter generated and saved successfully!",
      });

      // Reset all form fields to default initial state
      setForm({
        project: "",
        position: "",
        candidateName: "",
        gender: "",
        parentName: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        defaultFellowship: "",
        fellowship: "",
        hraPercentage: "",
        defaultHra: "",
        joiningDate: new Date().toISOString().split("T")[0],
      });
      setPositions([]);
      setPincodeError("");
    } catch (err) {
      console.error("Failed to generate offer letter:", err);
      setSubmitMessage({
        type: "error",
        text:
          err.message || "Failed to generate offer letter. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-[#17294c] dark:text-slate-100 transition-colors duration-200 px-2 sm:px-4 lg:px-6 py-3">
      {/* ================= PAGE HEADER ================= */}
      <div className="max-w-[1530px] mb-5 bg-white dark:bg-slate-800 rounded-lg shadow-[0_2px_8px_rgba(25,40,80,0.04)] border border-[#edf0f5] dark:border-slate-700 p-3 md:p-4 transition-colors duration-200">
        <div className="flex items-start gap-4">
          <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#102650] dark:text-slate-100 tracking-[-0.5px] mt-2">
            Generate Manpower Offer Letter
          </h1>

          {/* Decorative document icon */}
          <div className="hidden lg:flex ml-auto w-[105px] h-[60px] items-center justify-center">
            <div className="relative">
              <div className="w-[60px] h-[70px] rounded-md border-2 border-[#75a9f7] dark:border-blue-400 bg-white dark:bg-slate-700 shadow-sm p-2">
                <div className="w-4 h-4 rounded-full bg-[#d8e8ff] dark:bg-blue-900 mb-2" />
                <div className="h-1 bg-[#cbdcf6] dark:bg-slate-600 rounded mb-1.5" />
                <div className="h-1 bg-[#cbdcf6] dark:bg-slate-600 rounded mb-1.5 w-4/5" />
                <div className="h-1 bg-[#cbdcf6] dark:bg-slate-600 rounded w-3/5" />
              </div>

              <FileText
                className="absolute -right-5 top-5 text-[10px] text-[#75a9f7] dark:text-blue-400"
                size={33}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= MAIN CARD ================= */}
      <div className="max-w-[1530px] bg-white dark:bg-slate-800 rounded-lg shadow-[0_2px_8px_rgba(25,40,80,0.04)] border border-[#edf0f5] dark:border-slate-700 p-4 sm:p-5 md:p-6 transition-colors duration-200">
        {/* ================= PROJECT ================= */}
        <section>
          <SectionHeader icon={BriefcaseBusiness} title="Project & Position" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectField
              label="Select Project"
              required
              icon={BriefcaseBusiness}
              value={form.project}
              onChange={handleProjectChange}
            >
              <option value="">
                {loadingProjects
                  ? "-- Loading Projects... --"
                  : projectsError
                    ? `-- Error: ${projectsError} --`
                    : projects.length === 0
                      ? "-- No Projects Available --"
                      : "-- Select Project --"}
              </option>
              {projects.map((p, index) => {
                const sanction =
                  p.sanctionNo || p.sanctionNumber || p.code || "";
                const title = p.projectTitle || p.title || p.name || "";
                const label =
                  sanction && title
                    ? `${sanction} - ${title}`
                    : sanction || title || p.id;
                return (
                  <option key={p.id ? `${p.id}-${index}` : index} value={p.id}>
                    {label}
                  </option>
                );
              })}
              <option value="">-- Select Project --</option>
              {(projects || []).map(p => (
                <option key={p.id} value={p.id}>{p.projectTitle || p.agency}</option>
              ))}
            </SelectField>

            <SelectField
              label="Select Manpower Position"
              required
              icon={BriefcaseBusiness}
              value={form.position}
              onChange={handlePositionChange}
            >
              <option value="">
                {loadingPositions
                  ? "-- Loading Positions... --"
                  : "-- Select Position --"}
              </option>
              {positions.map((pos, index) => {
                const designation =
                  pos.designation ||
                  pos.title ||
                  pos.name ||
                  pos.positionName ||
                  "Position";
                const stipendNum = Number(
                  pos.stipend ?? pos.stipendAmount ?? 0,
                );
                const hraNum = Number(pos.hra ?? pos.hraAmount ?? 0);
                const stipendFormatted = stipendNum.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const hraFormatted = hraNum.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
                const label = `${designation} (Stipend: ₹${stipendFormatted} + HRA: ₹${hraFormatted})`;
                return (
                  <option
                    key={pos.id ? `${pos.id}-${index}` : index}
                    value={pos.id}
                  >
                    {label}
                  </option>
                );
              })}
              <option value="">-- Select Position --</option>
              {(positions || []).map(p => (
                <option key={p.id} value={p.id}>{p.designation}</option>
              ))}
            </SelectField>
          </div>
        </section>

        <div className="border-b border-[#e5eaf1] dark:border-slate-700 my-5" />

        {/* ================= CANDIDATE ================= */}
        <section>
          <SectionHeader icon={UserRound} title="Candidate Details" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <FormField
              label="Candidate Name"
              required
              icon={UserRound}
              placeholder="Enter candidate name"
              value={form.candidateName}
              onChange={updateField("candidateName")}
            />

            <SelectField
              label="Gender"
              required
              icon={UsersRound}
              value={form.gender}
              onChange={updateField("gender")}
            >
              <option value="">-- Select Gender --</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </SelectField>

            <FormField
              label="Father's/Mother's Name"
              required
              icon={UserRound}
              placeholder="Enter father's / mother's name"
              value={form.parentName}
              onChange={updateField("parentName")}
            />

            <div />

            <FormField
              label="Address"
              required
              type="textarea"
              placeholder="Enter complete address"
              value={form.address}
              onChange={updateField("address")}
              full
            />

            <FormField
              label="City"
              required
              icon={MapPin}
              placeholder="Enter city"
              value={form.city}
              onChange={updateField("city")}
            />

            {/* <FormField
              label="State"
              required
              icon={MapPin}
              placeholder="Enter state"
              value={form.state}
              onChange={updateField("state")}
            /> */}

            <SelectField
              label="State"
              required
              value={form.state}
              onChange={updateField("state")}
            >
              <option value="">Select state</option>
              {indianStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </SelectField>


            <FormField
              label="Pincode"
              required
              icon={MapPin}
              placeholder="Enter 6 digit pincode"
              value={form.pincode}
              onChange={handlePincodeChange}
              onBlur={handlePincodeBlur}
              onKeyDown={(e) => {
                if (["e", "E", "+", "-", "."].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              maxLength={6}
              error={pincodeError}
            />
          </div>
        </section>

        <div className="border-b border-[#e5eaf1] dark:border-slate-700 my-5" />

        {/* ================= FINANCIAL ================= */}
        <section>
          <SectionHeader
            icon={IndianRupee}
            title="Financial Details"
            type="green"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            <AmountField
              label="Default Fellowship Amount (from selected position)"
              placeholder="Default fellowship amount"
              value={form.defaultFellowship}
              disabled
            />

            <AmountField
              label="Fellowship Amount (₹)"
              required
              placeholder="Enter fellowship amount"
              value={form.fellowship}
              onChange={updateField("fellowship")}
            />

            <AmountField
              label="HRA Percentage (%)"
              required
              prefix="%"
              placeholder="Enter HRA percentage"
              value={form.hraPercentage}
              onChange={updateField("hraPercentage")}
            />

            <AmountField
              label="Default HRA Amount (from selected position)"
              placeholder="Default HRA amount"
              value={form.defaultHra}
              disabled
            />

            {/* Joining Date */}
            <div>
              <label className="block text-[13px] font-semibold text-[#17365d] dark:text-slate-200 mb-1.5">
                Joining Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={(() => {
                    const date = new Date();
                    date.setDate(date.getDate() - 7);

                    return date.toISOString().split("T")[0];
                  })()}
                  value={form.joiningDate}
                  onChange={updateField("joiningDate")}
                  className="w-full h-[44px] rounded-md border border-[#d4deeb] dark:border-slate-600 bg-white dark:bg-slate-700 px-4 text-[14px] text-[#1d2c42] dark:text-slate-100 outline-none focus:border-[#1769e8] dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ================= ACTION ================= */}
        <div className="border-b border-[#e5eaf1] dark:border-slate-700 mt-5 mb-4" />

        {submitMessage && (
          <div
            className={`mb-4 p-3 rounded-md text-[14px] font-medium flex items-center gap-2 ${
              submitMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
            }`}
          >
            <CheckCircle2 size={18} />
            <span>{submitMessage.text}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={submitting}
            className={`h-[42px] px-6 rounded-md bg-[#1769e8] hover:bg-[#0f5bd0] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-[14px] flex items-center gap-2 shadow-sm transition ${
              submitting ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <FileText size={18} />
            {submitting
              ? "Generating Offer Letter..."
              : "Generate Offer Letter"}
          </button>
        </div>
      </div>

      {/* ================= INSTRUCTIONS ================= */}
      <div className="max-w-[1530px] mt-5">
        <div className="relative overflow-hidden rounded-lg border border-[#bcd5ff] dark:border-blue-800 bg-[#f3f7ff] dark:bg-slate-800 px-5 py-3 sm:py-4 transition-colors duration-200">
          <div className="flex gap-3">
            <div>
              <h3 className="text-[16px] font-bold text-[#123b70] dark:text-blue-300 mb-2">
                Instructions
              </h3>

              <div className="space-y-1.5 text-[13px] text-[#1e3555] dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={15}
                    className="text-[#1769e8] dark:text-blue-400"
                    fill="currentColor"
                  />
                  <span>
                    Select a project to view available manpower positions.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={15}
                    className="text-[#1769e8] dark:text-blue-400"
                    fill="currentColor"
                  />
                  <span>
                    Choose the appropriate manpower position for the candidate.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={15}
                    className="text-[#1769e8] dark:text-blue-400"
                    fill="currentColor"
                  />
                  <span>
                    Fill in all candidate and financial details carefully before
                    generating the offer letter.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right decoration */}
          <div className="hidden md:flex absolute right-8 bottom-5 opacity-70">
            <ClipboardList
              size={78}
              strokeWidth={1.2}
              className="text-[#5d9cf5] dark:text-blue-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
