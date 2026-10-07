import { useEffect, useState } from "react";
import { createFacultyUser } from "../api/facultyUsersApi";
import { listActiveDepartments } from "../api/departmentsApi";
import { GENDER_OPTIONS, QUALIFICATION_OPTIONS } from "../constants/facultyProfileOptions";
import {
  GraduationCap,
  User,
  Building2,
  Users,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CalendarDays,
  BriefcaseBusiness,
  ShieldCheck,
  X,
  UserPlus,
  ChevronDown,
  Loader2,
} from "lucide-react";

const CreateFacultyUser = () => {
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: "",
    department: "",
    fullName: "",
    gender: "",
    email: "",
    qualification: "",
    password: "",
    joiningDate: "",
    designation: "",
    researchArea: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const [departmentOptions, setDepartmentOptions] = useState([]);

  useEffect(() => {
    listActiveDepartments()
      .then((departments) => setDepartmentOptions(departments.map((d) => d.name)))
      .catch(() => setDepartmentOptions([]));
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.employeeId.trim()) {
      showToast("Employee ID is required", "error");
      return;
    }
    if (!formData.fullName.trim()) {
      showToast("Full Name is required", "error");
      return;
    }
    if (!formData.email.trim()) {
      showToast("Email is required", "error");
      return;
    }
    if (!formData.password) {
      showToast("Password is required", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await createFacultyUser({
        employeeId: formData.employeeId.trim(),
        fullName: formData.fullName.trim(),
        department: formData.department,
        designation: formData.designation.trim() || null,
        gender: formData.gender,
        email: formData.email.trim(),
        qualification: formData.qualification,
        password: formData.password,
        joiningDate: formData.joiningDate || null,
        researchArea: formData.researchArea.trim() || null,
        photo: null,
      });

      showToast(`Faculty User '${response.name || formData.fullName}' created successfully!`, "success");
      handleCancel();
    } catch (error) {
      console.error("Failed to create faculty user:", error);
      const errMsg = error.problemDetails?.detail || error.message || "Failed to create faculty user";
      showToast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      employeeId: "",
      department: "",
      fullName: "",
      gender: "",
      email: "",
      qualification: "",
      password: "",
      joiningDate: "",
      designation: "",
      researchArea: "",
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f8fc] dark:bg-slate-900 px-4 py-5 md:px-6 lg:px-8 transition-colors duration-200">
      {/* ================= TOAST NOTIFICATION ================= */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-medium transition-all duration-300 ${
          toast.type === "error" ? "bg-red-600 dark:bg-red-700" : "bg-emerald-600 dark:bg-emerald-700"
        }`}>
          {toast.type === "error" ? (
            <X size={20} className="rounded-full bg-white/20 p-0.5" />
          ) : (
            <ShieldCheck size={20} className="rounded-full bg-white/20 p-0.5" />
          )}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast({ ...toast, show: false })} className="ml-2 opacity-80 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="max-w-[1530px]">

          {/* =================  PAGE HEADER  ======================= */}

        <div className="relative mb-4 overflow-hidden rounded-2xl border border-[#e4e9f2] dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-2 shadow-[0_3px_15px_rgba(30,60,100,0.05)] dark:shadow-none transition-colors duration-200">
          <div className="relative z-10 flex items-center gap-4">
            {/* Header Icon */}
            <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[14px] shadow-[0_7px_18px_rgba(61,109,245,0.25)]">
              <GraduationCap
                size={40}
                strokeWidth={1.6}
                className="text-white"
              />
            </div>

            <div>
              <h1 className="text-[25px] font-bold leading-tight text-[#10234b] dark:text-slate-100">
                Create Faculty User
              </h1>

              <p className="mt-1 text-[13px] text-[#66779b] dark:text-slate-400">
                Register a new faculty member. The username will be the Employee
                ID.
              </p>
            </div>
          </div>

          {/* Decorative background */}
          <div className="pointer-events-none absolute right-8 top-[-18px] opacity-[0.12]">
            <div className="flex items-center gap-2">
              <div className="h-32 w-44 rotate-[-8deg] rounded-lg border-[8px] border-[#3d6df5]" />
              <div className="h-28 w-5 rotate-[25deg] rounded-full bg-[#2458d9]" />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
         
              {/*  =============== PERSONAL INFORMATION  ========================  */}
         
          <section className="mb-2 overflow-hidden rounded-2xl border border-[#e2e8f2] dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_2px_12px_rgba(30,60,100,0.035)] dark:shadow-none transition-colors duration-200">
            {/* Section Header */}
            <div className="flex items-center gap-4 px-6 pb-2 pt-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef4ff] dark:bg-slate-700">
                <User size={25} strokeWidth={2} className="text-[#2162ec] dark:text-blue-400" />
              </div>

              <div>
                <h2 className="text-[16px] font-bold text-[#122448] dark:text-slate-100">
                  Personal Information
                </h2>

                <p className="mt-0.5 text-[13px] text-[#71809e] dark:text-slate-400">
                  Enter personal details and account credentials.
                </p>
              </div>
            </div>

            {/* Form Grid */}
            <div className="grid grid-cols-1 gap-x-7 gap-y-5 px-6 pb-6 pt-3 lg:grid-cols-2">
              {/* Employee ID */}
              <FormField label="Employee ID" required icon={<User size={19} />}>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  placeholder="Enter Employee ID"
                  className="form-input pl-[60px]"
                />
              </FormField>

              {/* Department */}
              <FormField
                label="Department"
                required
                icon={<Building2 size={19} />}
              >
                <SelectInput
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="Select Department"
                  options={departmentOptions}
                />
              </FormField>

              {/* Full Name */}
              <FormField label="Full Name" required icon={<User size={19} />}>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="form-input"
                />
              </FormField>

              {/* Gender */}
              <FormField label="Gender" required icon={<Users size={19} />}>
                <SelectInput
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  placeholder="Select Gender"
                  options={GENDER_OPTIONS}
                />
              </FormField>

              {/* Email */}
              <FormField label="Email" required icon={<Mail size={19} />}>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  className="form-input"
                />
              </FormField>

              {/* Qualification */}
              <FormField
                label="Qualification"
                required
                icon={<GraduationCap size={19} />}
              >
                <SelectInput
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  placeholder="Select Qualification"
                  options={QUALIFICATION_OPTIONS}
                />
              </FormField>

              {/* Password */}
              <FormField label="Password" required icon={<Lock size={19} />}>
                <div >
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter password"
                    className="form-input  "
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#627391] dark:text-slate-400 transition hover:text-[#2865ed] dark:hover:text-blue-400"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* <p className="mt-2 text-[13px] text-[#71809d] dark:text-slate-400">
                  Minimum 6 characters with letters and numbers.
                </p> */}
              </FormField>

              {/* Joining Date */}
              <FormField
                label="Joining Date"
                required
                icon={<CalendarDays size={19} />}
              >
                <div className="relative">
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split("T")[0]}
                    max={
                      new Date(new Date().setMonth(new Date().getMonth() + 1))
                        .toISOString()
                        .split("T")[0]
                    }
                    className="form-input appearance-none pr-12"
                  />

                  <CalendarDays
                    size={20}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5f6f8d] dark:text-slate-400"
                  />
                </div>

                {/* <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#bfd4ff] dark:border-blue-900 bg-[#f2f6ff] dark:bg-blue-950/30 px-3 py-2.5 text-[12.5px] text-[#2360e7] dark:text-blue-400">
                  <Info size={16} />
                  <span>
                    Joining date cannot be more than 1 month from today.
                  </span>
                </div> */}
              </FormField>
            </div>
          </section>

          {/* =====================================================
              PROFESSIONAL INFORMATION
          ====================================================== */}
          <section className="mb-4 overflow-hidden rounded-2xl border border-[#e2e8f2] dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_2px_12px_rgba(30,60,100,0.035)] dark:shadow-none transition-colors duration-200">
            {/* Section Header */}
            <div className="flex items-center gap-4 px-6 pb-2 pt-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff] dark:bg-slate-700">
                <BriefcaseBusiness
                  size={25}
                  strokeWidth={2}
                  className="text-[#5144e8] dark:text-blue-400"
                />
              </div>

              <div>
                <h2 className="text-[18px] font-bold text-[#122448] dark:text-slate-100">
                  Professional Information
                </h2>

                <p className="mt-0.5 text-[14px] text-[#71809e] dark:text-slate-400">
                  Enter designation and research details.
                </p>
              </div>
            </div>

            {/* Professional Form */}
            <div className="grid grid-cols-1 gap-x-7 px-6 pb-6 pt-3 lg:grid-cols-2">
              {/* Designation */}
              <FormField
                label="Designation"
                icon={<BriefcaseBusiness size={19} />}
              >
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="Enter designation"
                  className="form-input"
                />
              </FormField>

              {/* Research Area */}
              <div>
                <label className="mb-2 block text-[14px] font-semibold text-[#142449] dark:text-slate-100">
                  Research Area{" "}
                  <span className="font-normal text-[#7c89a4] dark:text-slate-400">(Optional)</span>
                </label>

                <textarea
                  name="researchArea"
                  value={formData.researchArea}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Enter research area, specialization, subjects or academic interests..."
                  className="w-full resize-none rounded-xl border border-[#d9e0eb] dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-[14px] text-[#25375b] dark:text-slate-100 outline-none transition placeholder:text-[#7c89a7] dark:placeholder:text-slate-500 hover:border-[#bfc9db] dark:hover:border-slate-500 focus:border-[#4b72ed] dark:focus:border-blue-500 focus:ring-2 focus:ring-[#4b72ed]/10 dark:focus:ring-blue-500/10"
                />
              </div>
            </div>
          </section>

          {/* =====================================================
              BOTTOM ACTION BAR
          ====================================================== */}
          <div className="rounded-2xl border border-[#c7d8ff] dark:border-blue-900 dark:dark:p-3.5 transition-colors duration-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Information */}
              <div className="flex items-center gap-4 px-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                  <ShieldCheck
                    size={34}
                    strokeWidth={1.8}
                    className="text-[#2164ee] dark:text-blue-400"
                  />
                </div>

                <div>
                  <h3 className="text-[15px] font-bold text-[#2161e8] dark:text-blue-300">
                    Please review the information
                  </h3>

                  <p className="mt-1 text-[12.5px] text-[#2562d9] dark:text-blue-400">
                    Ensure all required fields are filled correctly before
                    creating the faculty user account.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                {/* Cancel */}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex h-[50px] items-center justify-center gap-3 rounded-xl border border-[#d7deea] dark:border-slate-600 bg-white dark:bg-slate-700 px-8 text-[14px] font-semibold text-[#344464] dark:text-slate-200 shadow-sm transition hover:border-[#c5cedd] dark:hover:border-slate-500 hover:bg-[#f8faff] dark:hover:bg-slate-600"
                >
                  <X size={21} />
                  Cancel
                </button>

                {/* Create */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-[50px] items-center justify-center gap-3 rounded-xl dark:dark:px-8 text-[14px] font-bold text-white shadow-[0_7px_18px_rgba(38,96,235,0.25)] dark:shadow-[0_7px_18px_rgba(37,99,246,0.2)] transition hover:dark:hover:hover:dark:hover:active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={21} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={21} />
                      Create Faculty User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* =====================================================
          TAILWIND CUSTOM CLASSES
      ====================================================== */}
      <style>{`
        .form-input {
          width: 100%;
          height: 47px;
          border-radius: 10px;
          border: 1px solid #d9e0eb;
          background: #ffffff;
          padding: 0 15px 0 50px;
          font-size: 14px;
          color: #25375b;
          outline: none;
          transition: all 0.2s ease;
        }

        .form-input::placeholder {
          color: #7c89a7;
        }

        .form-input:hover {
          border-color: #bec9db;
        }

        .form-input:focus {
          border-color: #4b72ed;
          box-shadow: 0 0 0 3px rgba(75, 114, 237, 0.10);
        }

        :root.dark .form-input {
          border-color: #4b5563;
          background: #1e293b;
          color: #e2e8f0;
        }

        :root.dark .form-input::placeholder {
          color: #94a3b8;
        }

        :root.dark .form-input:hover {
          border-color: #64748b;
        }

        :root.dark .form-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0;
          cursor: pointer;
        }

        select {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

/* ============================================================
   FORM FIELD COMPONENT
============================================================ */

const FormField = ({ label, required, icon, children }) => {
  return (
    <div>
      <label className="mb-2 block text-[14px] font-semibold text-[#142449] dark:text-slate-100">
        {label}

        {required && <span className="ml-1 text-[#ef4444] dark:text-red-400">*</span>}
      </label>

      <div className="relative">
        {/* Input Icon */}
        <div className="pointer-events-none absolute left-2.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-[#f1f4fa] dark:bg-slate-700 text-[#4a6edb] dark:text-blue-400">
          {icon}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
};

/* ============================================================
   SELECT COMPONENT
============================================================ */

const SelectInput = ({ name, value, onChange, placeholder, options }) => {
  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="form-input appearance-none pl-[61px] pr-12"
      >
        <option value="" disabled>
          {placeholder}
        </option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <ChevronDown
        size={19}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5c6d8c] dark:text-slate-400"
      />
    </div>
  );
};

export default CreateFacultyUser;
