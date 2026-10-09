// import { useState } from 'react';
// import { Receipt } from 'lucide-react';
// import { processBill } from '../../../api/procurementApi';

// const FIELD_CLASS =
//   'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
//   'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

// const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

// /** Above this, an e-way bill number is required. Mirrors the server's rule. */
// const EWAY_BILL_THRESHOLD = 50_000;

// const STOCK_CONDITIONS = [
//   { value: 'working', label: 'Working' },
//   { value: 'not_working', label: 'Not Working' },
//   { value: 'unserviceable', label: 'Un-serviceable' },
//   { value: 'obsolete', label: 'Obsolete' },
//   { value: 'not_applicable', label: 'Not Applicable' },
// ];

// export default function ProcessBillForm({ indentType, indent, onProcessed }) {
//   const [formData, setFormData] = useState({
//     originalBillReference: '',
//     stockEntryConfirmed: false,
//     eWayBillNumber: '',
//     eWayBillPartA: '',
//     eWayBillPartB: '',
//     measurementBookNumber: '',
//     stockBookPage: '',
//     stockDescription: '',
//     stockQuantity: '',
//     stockActualCost: '',
//     stockCondition: '',
//     miscellaneousExpenditure: '',
//     purchaseOrderNumber: '',
//     purchaseOrderDate: '',
//     bindingLocation: 'Prayagraj',
//     comparativeStatementNumber: '',
//     comparativeStatementSigned: false,
//   });
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [error, setError] = useState(null);

//   const requiresEWayBill = Number(indent?.estimatedCost) > EWAY_BILL_THRESHOLD;
//   const isEquipment = indentType === 'Equipment';

//   const missingEWayBill = requiresEWayBill && !formData.eWayBillNumber.trim();
//   const missingMeasurementBook = isEquipment && !formData.measurementBookNumber.trim();
//   const blocked = missingEWayBill || missingMeasurementBook;

//   const handleChange = (e) => {
//     const { name, value, type, checked } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (isSubmitting || blocked) return;

//     setIsSubmitting(true);
//     setError(null);

//     try {
//       await processBill(indentType, indent.id, {
//         originalBillReference: formData.originalBillReference,
//         stockEntryConfirmed: formData.stockEntryConfirmed,
//         eWayBillNumber: formData.eWayBillNumber || null,
//         eWayBillPartA: formData.eWayBillPartA || null,
//         eWayBillPartB: formData.eWayBillPartB || null,
//         measurementBookNumber: formData.measurementBookNumber || null,
//         stockBookPage: formData.stockBookPage || null,
//         stockDescription: formData.stockDescription || null,
//         stockQuantity: formData.stockQuantity || null,
//         stockActualCost: formData.stockActualCost || null,
//         stockCondition: formData.stockCondition || null,
//         miscellaneousExpenditure: formData.miscellaneousExpenditure ? Number(formData.miscellaneousExpenditure) : null,
//         purchaseOrderNumber: formData.purchaseOrderNumber || null,
//         purchaseOrderDate: formData.purchaseOrderDate || null,
//         bindingLocation: formData.bindingLocation || 'Prayagraj',
//         comparativeStatementNumber: formData.comparativeStatementNumber || null,
//         comparativeStatementSigned: formData.comparativeStatementSigned,
//       });
//       onProcessed?.();
//     } catch (err) {
//       // Error is shown via the global toast notification
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-5">
//       <div className="flex items-center gap-2">
//         <Receipt size={18} className="text-slate-500 dark:text-slate-400" />
//         <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Process Bill</h3>
//       </div>

//       {error && (
//         <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
//           {error}
//         </div>
//       )}

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
//         <div className="space-y-1">
//           <label className={LABEL_CLASS}>Original Bill Reference <span className="text-red-500">*</span></label>
//           <input required type="text" name="originalBillReference" value={formData.originalBillReference} onChange={handleChange} className={FIELD_CLASS} />
//         </div>

//         <div className="space-y-1">
//           <label className={LABEL_CLASS}>
//             E-Way Bill Number {requiresEWayBill && <span className="text-red-500">*</span>}
//           </label>
//           <input
//             type="text"
//             name="eWayBillNumber"
//             value={formData.eWayBillNumber}
//             onChange={handleChange}
//             placeholder="e.g. EWAY/90123891"
//             className={FIELD_CLASS}
//           />
//           {requiresEWayBill && (
//             <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
//               Mandatory for purchases above ₹{EWAY_BILL_THRESHOLD.toLocaleString('en-IN')}.
//             </p>
//           )}
//         </div>

//         {requiresEWayBill && (
//           <>
//             <div className="space-y-1">
//               <label className={LABEL_CLASS}>E-Way Bill Part A (Goods & Doc Ref)</label>
//               <input
//                 type="text"
//                 name="eWayBillPartA"
//                 value={formData.eWayBillPartA}
//                 onChange={handleChange}
//                 placeholder="GSTIN / HSN Code / Doc No."
//                 className={FIELD_CLASS}
//               />
//             </div>
//             <div className="space-y-1">
//               <label className={LABEL_CLASS}>E-Way Bill Part B (Vehicle / Transporter Details)</label>
//               <input
//                 type="text"
//                 name="eWayBillPartB"
//                 value={formData.eWayBillPartB}
//                 onChange={handleChange}
//                 placeholder="Vehicle No. / Transporter Doc No."
//                 className={FIELD_CLASS}
//               />
//             </div>
//           </>
//         )}

//         {isEquipment && (
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Measurement Book Number <span className="text-red-500">*</span></label>
//             <input type="text" name="measurementBookNumber" value={formData.measurementBookNumber} onChange={handleChange} className={FIELD_CLASS} />
//             <p className="text-xs text-slate-500 dark:text-slate-400">Required for equipment bills.</p>
//           </div>
//         )}

//         <div className="space-y-1">
//           <label className={LABEL_CLASS}>Miscellaneous Expenditure (₹)</label>
//           <input type="number" step="0.01" name="miscellaneousExpenditure" value={formData.miscellaneousExpenditure} onChange={handleChange} placeholder="0" className={FIELD_CLASS} />
//           <p className="text-xs text-slate-500 dark:text-slate-400">Office Misc Column</p>
//         </div>
//       </div>

//       {/* PURCHASE ORDER & BINDING LOCATION SECTION */}
//       <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
//         <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
//           Purchase Order (PO) & Binding Details
//         </p>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Purchase Order (PO) No.</label>
//             <input type="text" name="purchaseOrderNumber" value={formData.purchaseOrderNumber} onChange={handleChange} placeholder="e.g. PO/2026/8821" className={FIELD_CLASS} />
//           </div>
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>PO Issuance Date</label>
//             <input type="date" name="purchaseOrderDate" value={formData.purchaseOrderDate} onChange={handleChange} className={FIELD_CLASS} />
//           </div>
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Binding Origin</label>
//             <input type="text" name="bindingLocation" value={formData.bindingLocation} onChange={handleChange} placeholder="Prayagraj" className={FIELD_CLASS} />
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Comparative Statement Ref (₹2L-₹25L)</label>
//             <input type="text" name="comparativeStatementNumber" value={formData.comparativeStatementNumber} onChange={handleChange} placeholder="e.g. CS/2026/041" className={FIELD_CLASS} />
//           </div>
//           <div className="flex items-center pt-5">
//             <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
//               <input type="checkbox" name="comparativeStatementSigned" checked={formData.comparativeStatementSigned} onChange={handleChange} className="w-4 h-4 text-blue-600 rounded" />
//               All Committee Members Signed Comparative Statement
//             </label>
//           </div>
//         </div>
//       </div>

//       <label className="flex items-center gap-2 cursor-pointer">
//         <input
//           type="checkbox"
//           name="stockEntryConfirmed"
//           checked={formData.stockEntryConfirmed}
//           onChange={handleChange}
//           className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
//         />
//         <span className="text-sm text-slate-700 dark:text-slate-300">
//           The item has been received and stock entry has been made
//         </span>
//       </label>

//       <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
//         <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-3 mb-3">
//           Stock Register Entry
//         </p>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Stock Book Page No. and Date</label>
//             <input type="text" name="stockBookPage" value={formData.stockBookPage} onChange={handleChange} className={FIELD_CLASS} />
//           </div>
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Description</label>
//             <input type="text" name="stockDescription" value={formData.stockDescription} onChange={handleChange} className={FIELD_CLASS} />
//           </div>
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Quantity</label>
//             <input type="number" name="stockQuantity" value={formData.stockQuantity} onChange={handleChange} className={FIELD_CLASS} />
//           </div>
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Actual Cost (₹) as per stock book</label>
//             <input type="number" step="0.01" name="stockActualCost" value={formData.stockActualCost} onChange={handleChange} className={FIELD_CLASS} />
//           </div>
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Condition</label>
//             <select name="stockCondition" value={formData.stockCondition} onChange={handleChange} className={FIELD_CLASS}>
//               <option value="">Select Condition</option>
//               {STOCK_CONDITIONS.map((c) => (
//                 <option key={c.value} value={c.value}>{c.label}</option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>

//       <div className="flex justify-end">
//         <button
//           type="submit"
//           disabled={isSubmitting || blocked}
//           className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 text-white font-semibold rounded-lg shadow-sm transition-all"
//         >
//           {isSubmitting ? 'Processing…' : 'Process Bill'}
//         </button>
//       </div>
//     </form>
//   );
// }
