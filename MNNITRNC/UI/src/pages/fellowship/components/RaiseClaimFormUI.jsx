import React, { useEffect, useState } from "react";
import { X, Calendar, Download, Loader2 } from "lucide-react";
import { raiseFellowshipClaim, getMyStipendFormDraft, editRejectedClaim } from "../../../api/fellowshipApi";
import { uploadDocument } from "../../../api/documentsApi";
import { MONTHS, HRA_SLIP_NOTE } from "../../../constants/fellowshipEnums";
import { formatCurrency } from "../../projects/utils/currency";

export default function RaiseClaimFormUI({ claimToEdit = null, isArrears = false, stipend = 0, onClose, onRaised, showToast }) {
  const now = new Date();
  const [formData, setFormData] = useState({
    claimYear: claimToEdit?.claimYear ?? now.getFullYear(),
    claimMonth: claimToEdit?.claimMonth ?? now.getMonth() + 1,
    leaveDaysTakenThisMonth: claimToEdit?.leaveDaysTakenThisMonth ?? 0,
    unauthorisedAbsenceDays: claimToEdit?.unauthorisedAbsenceDays ?? 0,
    remarks: claimToEdit?.remarks ?? (isArrears ? "Arrears claim for fellowship period." : ""),
  });
  const [claimPeriod, setClaimPeriod] = useState(claimToEdit?.claimPeriod ?? "21st-20th");
  const [hraClaimed, setHraClaimed] = useState(claimToEdit?.hraClaimed ?? true);
  const [hraSlipFile, setHraSlipFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(true);

  // Arrears Date Range (From - To Calendar inputs)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Arrears Editable Fields (Sections 1-5 and Section 7)
  const [arrearsFellowName, setArrearsFellowName] = useState("");
  const [arrearsBankAccountNo, setArrearsBankAccountNo] = useState("");
  const [arrearsIfscCode, setArrearsIfscCode] = useState("");
  const [arrearsMobile, setArrearsMobile] = useState("");
  const [arrearsEmail, setArrearsEmail] = useState("");
  const [arrearsJoinedOn, setArrearsJoinedOn] = useState("");
  const [arrearsRenewalDate, setArrearsRenewalDate] = useState("N/A");
  const [arrearsDesignation, setArrearsDesignation] = useState("");
  const [arrearsDepartment, setArrearsDepartment] = useState("");
  const [arrearsFellowshipAmount, setArrearsFellowshipAmount] = useState("");
  const [arrearsHraAmount, setArrearsHraAmount] = useState("0");

  useEffect(() => {
    let active = true;
    setDraftLoading(true);
    getMyStipendFormDraft(formData.claimYear, formData.claimMonth)
      .then((data) => {
        if (active) {
          setDraft(data);
          if (data) {
            setArrearsFellowName(data.fellowName || "");
            setArrearsBankAccountNo(data.bankAccountNo || "");
            setArrearsIfscCode(data.ifscCode || "");
            setArrearsMobile(data.mobile || "");
            setArrearsEmail(data.email || "");
            setArrearsJoinedOn(
              data.joinedOn
                ? new Date(data.joinedOn).toLocaleDateString("en-IN")
                : ""
            );
            const fAmt = data.fellowshipAmount ?? stipend ?? 31000;
            const hAmt = data.hraAmount && data.hraAmount > 0 ? data.hraAmount : Math.round(Number(fAmt) * 0.20);
            setArrearsFellowshipAmount(fAmt);
            setArrearsHraAmount(hAmt);
          }
        }
      })
      .catch((err) => {
        if (active) setError("Failed to load form details from the server.");
      })
      .finally(() => {
        if (active) setDraftLoading(false);
      });
    return () => {
      active = false;
    };
  }, [formData.claimYear, formData.claimMonth, stipend]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // We use the draft amounts if available, otherwise compute a preview (default 20% HRA)
  const fellowshipAmount = draft?.fellowshipAmount ?? stipend;
  const draftHra = draft?.hraAmount && draft.hraAmount > 0 ? draft.hraAmount : Math.round((Number(fellowshipAmount) || 0) * 0.20);
  const hraAmountPreview = hraClaimed ? draftHra : 0;
  const totalAmountPreview = fellowshipAmount + hraAmountPreview;

  // Raising a new (non-arrears) claim requires a non-blank remark
  // server-side (FellowshipService.RaiseClaimAsync throws
  // WorkflowTransitionException when Remarks is null/whitespace). Editing a
  // rejected claim goes through EditRejectedClaimAsync, which is
  // unaffected, and the arrears path always builds a non-blank composite
  // remarksStr regardless of formData.remarks, so this gate applies only to
  // the plain raise path.
  const remarksBlank = !claimToEdit && !isArrears && !formData.remarks.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (remarksBlank) {
      setError("A remark is required to raise a fellowship claim.");
      return;
    }

    if (hraClaimed && !claimToEdit?.hraClaimed && !hraSlipFile) {
      setError("HRA slip document attachment is mandatory to claim HRA allowance. Please attach your HRA slip file.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let claimId;
      if (claimToEdit) {
        claimId = claimToEdit.id;
        await editRejectedClaim(claimId, {
          hraClaimed,
          leaveDaysTakenThisMonth: Number(formData.leaveDaysTakenThisMonth) || 0,
          unauthorisedAbsenceDays: Number(formData.unauthorisedAbsenceDays) || 0,
          remarks: formData.remarks || null,
        });
      } else if (isArrears) {
        const fromD = new Date(fromDate);
        const year = fromD.getFullYear();
        const month = fromD.getMonth() + 1;
        const periodStr = `Arrears (${fromDate} to ${toDate})`;
        const remarksStr = `[Arrears Claim: ${fromDate} to ${toDate}] Staff: ${arrearsFellowName}, Acc: ${arrearsBankAccountNo} (IFSC: ${arrearsIfscCode}), Mob: ${arrearsMobile}, Desig: ${arrearsDesignation}, Dept: ${arrearsDepartment}, Fellowship: ₹${arrearsFellowshipAmount}, HRA: ₹${arrearsHraAmount}. ${formData.remarks || ""}`;

        claimId = await raiseFellowshipClaim({
          claimYear: year,
          claimMonth: month,
          claimPeriod: periodStr,
          claimType: "Raise Arrears",
          fellowshipAmount: Number(arrearsFellowshipAmount) || 0,
          hraAmount: Number(arrearsHraAmount) || 0,
          hraClaimed,
          leaveDaysTakenThisMonth: Number(formData.leaveDaysTakenThisMonth) || 0,
          unauthorisedAbsenceDays: Number(formData.unauthorisedAbsenceDays) || 0,
          remarks: remarksStr,
        });
      } else {
        claimId = await raiseFellowshipClaim({
          claimYear: Number(formData.claimYear),
          claimMonth: Number(formData.claimMonth),
          claimPeriod,
          claimType: "Claim for Month",
          hraClaimed,
          leaveDaysTakenThisMonth: Number(formData.leaveDaysTakenThisMonth) || 0,
          unauthorisedAbsenceDays: Number(formData.unauthorisedAbsenceDays) || 0,
          remarks: formData.remarks || null,
        });
      }

      if (hraClaimed && hraSlipFile) {
        const payload = new FormData();
        payload.append("File", hraSlipFile);
        payload.append("OwnerType", "FellowshipClaim");
        payload.append("OwnerId", claimId);
        payload.append("Kind", "HraSlip");

        await uploadDocument(payload);
      }

      showToast?.(
        claimToEdit
          ? "Claim resubmitted successfully!"
          : isArrears
          ? "Fellowship arrears claim raised successfully!"
          : "Fellowship claim raised successfully!"
      );
      onRaised?.();
      onClose();
    } catch (err) {
      setError(err.message ?? "Failed to submit claim.");
      setIsSubmitting(false);
    }
  };

  const fieldClass = "px-2 py-0.5 text-sm bg-blue-50/50 border-b-2 border-blue-200 focus:border-blue-500 focus:bg-blue-50 outline-none transition-colors dark:bg-slate-800 dark:border-slate-600 dark:text-white";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {claimToEdit ? "Edit & resubmit claim" : isArrears ? "Raise Fellowship Arrears" : "Claim fellowship"} (Digital Form)
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full"
          >
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

          {draftLoading && !draft ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Generating your form draft...</p>
            </div>
          ) : (
            <form id="claim-form" onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6 text-slate-800 dark:text-slate-200 font-serif leading-relaxed">
              
              {/* Form Header imitating physical form */}
              <div className="text-center space-y-1 mb-8 border-b-2 border-slate-200 pb-6">
                <h1 className="text-xl font-bold font-sans">OFFICE OF THE DEAN (RESEARCH AND CONSULTANCY)</h1>
                <h2 className="text-lg font-bold font-sans">MOTILAL NEHRU NATIONAL INSTITUTE OF TECHNOLOGY</h2>
                <h3 className="text-base font-semibold font-sans">Allahabad – 211 004 (India)</h3>
                
                <h4 className="mt-6 text-lg font-bold underline font-sans">
                  {isArrears ? "FORM FOR CLAIMING FELLOWSHIP ARREARS" : "FORM FOR CLAIMING FELLOWSHIP/SALARY/REMUNERATION"}
                </h4>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 text-sm sm:text-base">
                <div className="flex flex-wrap gap-2 items-baseline">
                  <span className="font-bold">1. Name of the Project Staff:</span>
                  {isArrears ? (
                    <input
                      type="text"
                      required
                      value={arrearsFellowName}
                      onChange={(e) => setArrearsFellowName(e.target.value)}
                      className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1 min-w-[200px]`}
                    />
                  ) : (
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[200px]">
                      {draft?.fellowName || "..."}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 items-baseline">
                  <span className="font-bold">2. Account No of Project Staff:</span>
                  {isArrears ? (
                    <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Account No"
                        required
                        value={arrearsBankAccountNo}
                        onChange={(e) => setArrearsBankAccountNo(e.target.value.replace(/\D/g, ''))}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1`}
                      />
                      <span>/ IFSC:</span>
                      <input
                        type="text"
                        placeholder="IFSC Code"
                        required
                        value={arrearsIfscCode}
                        onChange={(e) => setArrearsIfscCode(e.target.value)}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 w-36`}
                      />
                    </div>
                  ) : (
                    <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[200px]">
                      {draft?.bankAccountNo || "..."} / IFSC: {draft?.ifscCode || "..."}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-baseline">
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">3. Contact Details (Mob.):</span>
                    {isArrears ? (
                      <input
                        type="text"
                        value={arrearsMobile}
                        onChange={(e) => setArrearsMobile(e.target.value)}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1 min-w-[120px]`}
                      />
                    ) : (
                      <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[120px]">
                        {draft?.mobile || "..."}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">Email ID:</span>
                    {isArrears ? (
                      <input
                        type="email"
                        value={arrearsEmail}
                        onChange={(e) => setArrearsEmail(e.target.value)}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1 min-w-[150px]`}
                      />
                    ) : (
                      <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[150px]">
                        {draft?.email || "..."}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-baseline">
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">4. Date of Joining:</span>
                    {isArrears ? (
                      <input
                        type="text"
                        value={arrearsJoinedOn}
                        onChange={(e) => setArrearsJoinedOn(e.target.value)}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1 min-w-[120px]`}
                      />
                    ) : (
                      <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[120px]">
                        {draft?.joinedOn ? new Date(draft.joinedOn).toLocaleDateString('en-IN') : "..."}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">Date of Renewal/termination:</span>
                    {isArrears ? (
                      <input
                        type="text"
                        value={arrearsRenewalDate}
                        onChange={(e) => setArrearsRenewalDate(e.target.value)}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1 min-w-[120px]`}
                      />
                    ) : (
                      <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[120px]">
                        N/A
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-baseline">
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">5. Designation:</span>
                    {isArrears ? (
                      <input
                        type="text"
                        value={arrearsDesignation}
                        onChange={(e) => setArrearsDesignation(e.target.value)}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1 min-w-[150px]`}
                      />
                    ) : (
                      <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[150px]">
                        {draft?.designation || "..."}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-baseline flex-1">
                    <span className="font-bold">Department:</span>
                    {isArrears ? (
                      <input
                        type="text"
                        value={arrearsDepartment}
                        onChange={(e) => setArrearsDepartment(e.target.value)}
                        className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 flex-1 min-w-[150px]`}
                      />
                    ) : (
                      <span className="font-bold text-blue-800 dark:text-blue-300 border-b border-dashed border-slate-400 flex-1 min-w-[150px]">
                        {draft?.piDepartment || "..."}
                      </span>
                    )}
                  </div>
                </div>

                {/* Section 6 for Claim Period */}
                {isArrears ? (
                  <div className="flex flex-wrap gap-4 items-center bg-blue-50/30 dark:bg-blue-900/10 p-3 rounded-lg -mx-2">
                    <span className="font-bold text-blue-900 dark:text-blue-200">
                      6. Period for which the claim of Fellowship/Salary Arrears is to be made:
                    </span>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">From Date:</span>
                        <input
                          type="date"
                          required
                          value={fromDate}
                          onChange={(e) => {
                            const newFrom = e.target.value;
                            setFromDate(newFrom);
                            if (toDate && newFrom > toDate) {
                              setToDate(newFrom);
                            }
                          }}
                          className={fieldClass}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">To Date:</span>
                        <input
                          type="date"
                          required
                          min={fromDate}
                          value={toDate}
                          onChange={(e) => {
                            const newTo = e.target.value;
                            if (fromDate && newTo < fromDate) {
                              setToDate(fromDate);
                            } else {
                              setToDate(newTo);
                            }
                          }}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 items-baseline bg-blue-50/30 dark:bg-blue-900/10 p-2 rounded-lg -mx-2">
                    <span className="font-bold text-blue-900 dark:text-blue-200">
                      6. Period for which the claim of Fellowship/Salary is to be made:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select required name="claimMonth" disabled={!!claimToEdit} value={formData.claimMonth} onChange={handleChange} className={fieldClass}>
                        {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <input required type="number" disabled={!!claimToEdit} name="claimYear" min="2000" max="2100" value={formData.claimYear} onChange={handleChange} className={`${fieldClass} w-20`} />
                    </div>
                  </div>
                )}

                {/* Section 7 */}
                {isArrears ? (
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="font-bold">7. Rate of Fellowship/Salary per month: Rs.</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={arrearsFellowshipAmount}
                      onChange={(e) => setArrearsFellowshipAmount(e.target.value)}
                      className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 w-32`}
                      placeholder="0.00"
                    />
                    <span className="font-bold pl-2">HRA: Rs.</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={arrearsHraAmount}
                      onChange={(e) => setArrearsHraAmount(e.target.value)}
                      className={`${fieldClass} font-bold text-blue-800 dark:text-blue-300 w-28`}
                      placeholder="0.00"
                    />
                    <span className="font-bold pl-2">Total: Rs.</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">
                      {formatCurrency((Number(arrearsFellowshipAmount) || 0) + (Number(arrearsHraAmount) || 0))}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 items-baseline">
                    <span className="font-bold">7. Rate of Fellowship/Salary per month: Rs.</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{formatCurrency(fellowshipAmount)}</span>
                    <span className="font-bold pl-2">HRA: Rs.</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{formatCurrency(hraAmountPreview)}</span>
                    <span className="font-bold pl-2">Total: Rs.</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{formatCurrency(totalAmountPreview)}</span>
                  </div>
                )}

                {/* Leave Inputs */}
                <div className="mt-6">
                  <div className="flex gap-4 mb-2">
                    <span className="font-bold">8. Number of yearly leaves during the project period:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{draft?.yearlyLeaveEntitlement || 0}</span>
                  </div>
                  <div className="flex gap-4 mb-4">
                    <span className="font-bold">Total number of leaves taken:</span>
                    <span className="font-bold text-blue-800 dark:text-blue-300">{draft?.totalLeavesTaken || 0}</span>
                  </div>

                  <div className="pl-6 space-y-3 bg-blue-50/30 dark:bg-blue-900/10 p-4 rounded-lg">
                    <div className="flex flex-wrap gap-2 items-baseline">
                      <span>a) Casual Leave/Medical Leave taken during the month:</span>
                      <input type="number" min="0" max="31" name="leaveDaysTakenThisMonth" value={formData.leaveDaysTakenThisMonth} onChange={handleChange} className={`${fieldClass} w-20`} />
                      <span>days</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-baseline">
                      <span>b) Unauthorised absence during the month:</span>
                      <input type="number" min="0" max="31" name="unauthorisedAbsenceDays" value={formData.unauthorisedAbsenceDays} onChange={handleChange} className={`${fieldClass} w-20`} />
                      <span>days</span>
                    </div>
                  </div>
                </div>

                {/* HRA Upload Section */}
                <div className="mt-6 bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800/50">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={hraClaimed} onChange={(e) => { setHraClaimed(e.target.checked); if (!e.target.checked) setHraSlipFile(null); }} className="mt-1 w-5 h-5 text-blue-600 focus:ring-blue-500 rounded" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        9. Has the Project Staff been accommodated in Hostels or provided accommodation? (Claim HRA)
                      </span>
                      <span className="block mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {HRA_SLIP_NOTE}
                      </span>
                    </div>
                  </label>
                  
                  {hraClaimed && (
                    <div className="mt-4 pl-8">
                      <label className="block text-sm font-semibold mb-1">
                        {claimToEdit?.hraClaimed ? 'Upload New HRA Slip Document (Optional)' : 'Upload HRA Slip Document'} <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="file" required={!claimToEdit?.hraClaimed} accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setHraSlipFile(e.target.files[0])}
                        className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                      />
                    </div>
                  )}
                </div>

                {/* Remarks Input */}
                <div className="mt-6">
                  <span className="font-bold mb-2 block">
                    10. Remarks:{!claimToEdit && !isArrears && <span className="text-red-500"> *</span>}
                  </span>
                  <textarea required={!claimToEdit && !isArrears} name="remarks" rows="2" value={formData.remarks} onChange={handleChange} className="w-full px-3 py-2 bg-blue-50/30 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none transition-colors" placeholder={!claimToEdit && !isArrears ? "A remark is required to raise this claim" : "Enter remarks if any..."} />
                </div>

                {/* Greyed out PI section */}
                <div className="mt-8 border-t-2 border-dashed border-slate-300 dark:border-slate-600 pt-6 opacity-60 pointer-events-none">
                  <h4 className="text-center font-bold mb-4">(TO BE COMPLETED BY THE PRINCIPAL INVESTIGATOR/ DEPARTMENTAL OFFICE)</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span>1. Title of the Project:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2">{draft?.projectTitle}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span>2. Sanction No. / Project No.:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2">{draft?.sanctionNo}</span>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-1 items-baseline">
                        <span>3. Total Sanctioned Amount:</span>
                        <span className="border-b border-dotted border-slate-400 flex-1 ml-2">{formatCurrency(draft?.totalSanctioned)}</span>
                      </div>
                      <div className="flex flex-1 items-baseline">
                        <span>Total Funds Received:</span>
                        <span className="border-b border-dotted border-slate-400 flex-1 ml-2">{formatCurrency(draft?.totalFundReceived)}</span>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-1 items-baseline">
                        <span>4. Date of commencement:</span>
                        <span className="border-b border-dotted border-slate-400 flex-1 ml-2">{draft?.projectStartDate ? new Date(draft.projectStartDate).toLocaleDateString() : ""}</span>
                      </div>
                      <div className="flex flex-1 items-baseline">
                        <span>Date of completion:</span>
                        <span className="border-b border-dotted border-slate-400 flex-1 ml-2">{draft?.projectEndDate ? new Date(draft.projectEndDate).toLocaleDateString() : ""}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 items-baseline">
                      <span>5. Fund available in Manpower Head:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2">{formatCurrency(draft?.manpowerHeadFund)}</span>
                      <span>Recommended Amount:</span>
                      <span className="border-b border-dotted border-slate-400 flex-1 ml-2 text-center">..................</span>
                    </div>
                  </div>
                </div>

              </div>
            </form>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300">
            Cancel
          </button>
          <button type="submit" form="claim-form" disabled={isSubmitting || draftLoading || remarksBlank} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-lg shadow-md transition-all">
            {isSubmitting ? 'Submitting…' : (claimToEdit ? 'Resubmit Claim' : 'Submit Claim')}
          </button>
        </div>
      </div>
    </div>
  );
}
