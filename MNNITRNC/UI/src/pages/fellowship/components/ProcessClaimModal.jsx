import React, { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { getStipendFormData, recommendAmount as submitRecommendAmount, approveClaim } from "../../../api/fellowshipApi";
import { formatCurrency } from "../../projects/utils/currency";
import StipendFormModal from "./StipendFormModal";

export default function ProcessClaimModal({ claim, isHOD, initialAmount, onClose, onProcessed, showToast }) {
  const [step, setStep] = useState(1); // 1 = Form, 2 = Download/Upload
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recommendedAmount, setRecommendedAmount] = useState(initialAmount || 0);
  const [leaveTakenThisMonth, setLeaveTakenThisMonth] = useState(0);
  const [unauthorisedAbsenceDays, setUnauthorisedAbsenceDays] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getStipendFormData(claim.id)
      .then((data) => {
        if (active) {
          setFormData(data);
          if (initialAmount === undefined || initialAmount === null) {
            setRecommendedAmount(data.recommendedAmount ?? data.totalAmount);
          } else {
            setRecommendedAmount(initialAmount);
          }
          setLeaveTakenThisMonth(data.leaveTakenThisMonth ?? 0);
          setUnauthorisedAbsenceDays(data.unauthorisedAbsenceDays ?? 0);
        }
      })
      .catch((err) => {
        if (active) setError("Failed to load form details from the server.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [claim.id, initialAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Submit the recommendation first
      await submitRecommendAmount(claim.id, { 
        recommendedAmount: Number(recommendedAmount),
        leaveDaysTakenThisMonth: Number(leaveTakenThisMonth),
        unauthorisedAbsenceDays: Number(unauthorisedAbsenceDays),
        remarks: remarks.trim() || null
      });
      
      // Both PI and HOD must approve to advance the workflow stage
      await approveClaim(claim.id, remarks.trim() || (isHOD ? "Approved and forwarded" : "Recommended and forwarded"));

      showToast?.("Claim processed successfully!");
      onProcessed?.(); // Trigger reload of the parent dashboard
      setStep(2); // Move to Download/Upload step
    } catch (err) {
      setError(err.message ?? "Failed to process claim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If in step 2, render the StipendFormModal for the download/upload flow
  if (step === 2) {
    return (
      <StipendFormModal 
        claim={claim} 
        onClose={onClose} 
        canUpload={true} 
        showToast={showToast} 
      />
    );
  }

  // Step 1: Render the digital form
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {isHOD ? "Approve & Forward Claim (Digital Form)" : "Recommend Claim (Digital Form)"}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative">
          {error && (
            <div className="mb-4 p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && !formData ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading form details...</p>
            </div>
          ) : formData ? (
            <form id="recommend-form" onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 text-slate-800 dark:text-slate-200 font-serif leading-relaxed">
              
              {/* Form Header */}
              <div className="text-center space-y-1 mb-8 border-b-2 border-slate-200 pb-6">
                <h1 className="text-xl font-bold font-sans">OFFICE OF THE DEAN (RESEARCH AND CONSULTANCY)</h1>
                <h2 className="text-lg font-bold font-sans">MOTILAL NEHRU NATIONAL INSTITUTE OF TECHNOLOGY</h2>
                <h3 className="text-base font-semibold font-sans">Allahabad – 211 004 (India)</h3>
                <h4 className="mt-6 text-lg font-bold underline font-sans">
                  FORM FOR CLAIMING FELLOWSHIP/SALARY/REMUNERATION
                </h4>
              </div>

              {/* Read-only Fellow Fields */}
              <div className="space-y-4 text-sm sm:text-base opacity-70 pointer-events-none">
                <div className="flex flex-wrap gap-2 items-baseline">
                  <span className="font-bold">1. Name of the Project Staff:</span>
                  <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[200px]">
                    {formData.fellowName || "..."}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 items-baseline">
                  <span className="font-bold">2. Account No of Project Staff:</span>
                  <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[200px]">
                    {formData.bankAccountNo || "..."} / IFSC: {formData.ifscCode || "..."}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-baseline">
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">3. Contact Details (Mob.):</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[120px]">
                      {formData.mobile || "..."}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">Email ID:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[150px]">
                      {formData.email || "..."}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-baseline">
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">4. Date of Joining:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[120px]">
                      {formData.joinedOn ? new Date(formData.joinedOn).toLocaleDateString('en-IN') : "..."}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">Date of Renewal/termination:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[120px]">N/A</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-baseline">
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">5. Designation:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[150px]">
                      {formData.designation || "..."}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">Department:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[150px]">
                      {formData.piDepartment || "..."}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-baseline bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg -mx-2">
                  <span className="font-bold">
                    6. Period for which the claim of Fellowship/Salary is to be made:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap text-blue-800 dark:text-blue-300 font-bold">
                    {formData.periodFrom ? new Date(formData.periodFrom).toLocaleDateString('en-IN') : ""} to {formData.periodTo ? new Date(formData.periodTo).toLocaleDateString('en-IN') : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 items-baseline">
                  <span className="font-bold">7. Rate of Fellowship/Salary per month: Rs.</span>
                  <span className="font-bold text-blue-800 dark:text-blue-300">{formatCurrency(formData.fellowshipAmount)}</span>
                  <span className="font-bold pl-2">HRA: Rs.</span>
                  <span className="font-bold text-blue-800 dark:text-blue-300">{formatCurrency(formData.hraAmount)}</span>
                  <span className="font-bold pl-2">Total: Rs.</span>
                  <span className="font-bold text-blue-800 dark:text-blue-300">{formatCurrency(formData.totalAmount)}</span>
                </div>
                <div className="mt-6">
                  <div className="flex gap-4 mb-2">
                    <span className="font-bold">8. Number of yearly leaves during the project period:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{formData.yearlyLeaveEntitlement || 0}</span>
                  </div>
                  <div className="flex gap-4 mb-4">
                    <span className="font-bold">Total number of leaves taken:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{formData.totalLeavesTaken || 0}</span>
                  </div>
                  <div className="pl-6 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg pointer-events-auto opacity-100">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span>a) Casual Leave/Medical Leave taken during the month:</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="31" 
                        value={leaveTakenThisMonth} 
                        onChange={e => setLeaveTakenThisMonth(e.target.value)} 
                        className="w-16 px-2 py-1 text-sm font-bold bg-white dark:bg-slate-800 border-2 border-blue-400 rounded focus:ring-2 focus:ring-blue-100 outline-none text-blue-900 dark:text-blue-100" 
                      />
                      <span>days</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span>b) Unauthorised absence during the month:</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="31" 
                        value={unauthorisedAbsenceDays} 
                        onChange={e => setUnauthorisedAbsenceDays(e.target.value)} 
                        className="w-16 px-2 py-1 text-sm font-bold bg-white dark:bg-slate-800 border-2 border-blue-400 rounded focus:ring-2 focus:ring-blue-100 outline-none text-blue-900 dark:text-blue-100" 
                      />
                      <span>days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable PI section */}
              <div className="mt-8 border-t-2 border-slate-300 dark:border-slate-600 pt-6">
                <h4 className="text-center font-bold mb-6 bg-blue-100 text-blue-900 py-2 rounded">
                  (TO BE COMPLETED BY THE PRINCIPAL INVESTIGATOR/ DEPARTMENTAL OFFICE)
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline opacity-70 pointer-events-none">
                    <span className="font-bold">1. Title of the Project:</span>
                    <span className="border-b border-dotted border-slate-400 flex-1 ml-2 font-bold text-blue-900 dark:text-blue-300">{formData.projectTitle}</span>
                  </div>
                  <div className="flex justify-between items-baseline opacity-70 pointer-events-none">
                    <span className="font-bold">2. Sanction No. / Project No.:</span>
                    <span className="border-b border-dotted border-slate-400 flex-1 ml-2 font-bold text-blue-900 dark:text-blue-300">{formData.sanctionNo}</span>
                  </div>
                  <div className="flex gap-4 opacity-70 pointer-events-none">
                    <div className="flex flex-1 items-baseline">
                      <span className="font-bold">3. Total Sanctioned Amount:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2 font-bold text-blue-900 dark:text-blue-300">{formatCurrency(formData.totalSanctioned)}</span>
                    </div>
                    <div className="flex flex-1 items-baseline">
                      <span className="font-bold">Total Funds Received:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2 font-bold text-blue-900 dark:text-blue-300">{formatCurrency(formData.totalFundReceived)}</span>
                    </div>
                  </div>
                  <div className="flex gap-4 opacity-70 pointer-events-none">
                    <div className="flex flex-1 items-baseline">
                      <span className="font-bold">4. Date of commencement:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2 font-bold text-blue-900 dark:text-blue-300">{formData.projectStartDate ? new Date(formData.projectStartDate).toLocaleDateString('en-IN') : ""}</span>
                    </div>
                    <div className="flex flex-1 items-baseline">
                      <span className="font-bold">Date of completion:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2 font-bold text-blue-900 dark:text-blue-300">{formData.projectEndDate ? new Date(formData.projectEndDate).toLocaleDateString('en-IN') : ""}</span>
                    </div>
                  </div>
                  
                  {/* The actual editable field for PI & HOD */}
                  <div className="flex gap-4 items-baseline bg-blue-50/50 p-4 rounded-xl border border-blue-200 mt-6 dark:bg-blue-900/20 dark:border-blue-800">
                    <span className="font-bold">5. Fund available in Manpower Head:</span>
                    <span className="border-b border-dotted border-slate-400 font-bold text-blue-900 dark:text-blue-300">{formatCurrency(formData.manpowerHeadFund)}</span>
                    <span className="font-bold ml-6 text-blue-700 dark:text-blue-400">Recommended Amount Rs.:</span>
                    <input 
                      type="number" 
                      required 
                      min="0"
                      max={formData.totalAmount}
                      value={recommendedAmount}
                      onChange={(e) => setRecommendedAmount(e.target.value)}
                      className="ml-2 w-32 px-3 py-1 text-lg font-bold bg-white dark:bg-slate-800 border-2 border-blue-400 rounded-lg focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none transition-all text-blue-900 dark:text-blue-100"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="flex flex-col gap-2 bg-blue-50/50 p-4 rounded-xl border border-blue-200 mt-4 dark:bg-blue-900/20 dark:border-blue-800">
                    <span className="font-bold text-blue-900 dark:text-blue-300">Remarks / Comments (Optional):</span>
                    <textarea 
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter any remarks or notes... (these will be visible in the workflow history)"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border-2 border-blue-300 rounded-lg focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none transition-all text-blue-900 dark:text-blue-100 resize-none"
                    />
                  </div>
                </div>
              </div>

            </form>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300">
            Cancel
          </button>
          <button
            type="submit"
            form="recommend-form"
            disabled={!formData || isSubmitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
            {isHOD ? "Approve & Forward" : "Recommend Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
