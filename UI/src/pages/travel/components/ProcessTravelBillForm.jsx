// import { useState } from 'react';
// import { Receipt, Info } from 'lucide-react';
// import { processTravelBill } from '../../../api/travelApi';

// const FIELD_CLASS =
//   'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 ' +
//   'rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white';

// const LABEL_CLASS = 'text-sm font-semibold text-slate-700 dark:text-slate-300';

// /**
//  * Reimbursement entry, available once the request itself is approved.
//  *
//  * The taxi field appears only when the request opted in at submission -- the
//  * client mirroring the server's rule, which rejects a taxi cost outright when
//  * the request did not opt in.
//  */
// export default function ProcessTravelBillForm({ travelRequest, onProcessed }) {
//   const [formData, setFormData] = useState({
//     originalBillReference: '',
//     taxiCost: '',
//     actualCost: '',
//   });
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [error, setError] = useState(null);

//   const optedIn = Boolean(travelRequest?.taxiReimbursementOptedIn);

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (isSubmitting) return;

//     setIsSubmitting(true);
//     setError(null);

//     try {
//       await processTravelBill(travelRequest.id, {
//         originalBillReference: formData.originalBillReference,
//         taxiCost: optedIn && formData.taxiCost ? Number(formData.taxiCost) : null,
//         actualCost: formData.actualCost ? Number(formData.actualCost) : null,
//       });
//       onProcessed?.();
//     } catch (err) {
//       // Error is shown via the global toast notification
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       <div className="flex items-center gap-2">
//         <Receipt size={16} className="text-slate-500 dark:text-slate-400" />
//         <h2 className="text-lg font-bold text-slate-800 dark:text-white">Process Bill</h2>
//       </div>

//       {error && (
//         <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300">
//           {error}
//         </div>
//       )}

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div className="space-y-1">
//           <label className={LABEL_CLASS}>
//             Original Bill Reference <span className="text-red-500">*</span>
//           </label>
//           <input
//             required
//             type="text"
//             name="originalBillReference"
//             value={formData.originalBillReference}
//             onChange={handleChange}
//             className={FIELD_CLASS}
//           />
//         </div>

//         <div className="space-y-1">
//           <label className={LABEL_CLASS}>Actual Cost (₹)</label>
//           <input
//             type="number"
//             step="0.01"
//             min="0"
//             name="actualCost"
//             value={formData.actualCost}
//             onChange={handleChange}
//             className={FIELD_CLASS}
//           />
//         </div>

//         {optedIn ? (
//           <div className="space-y-1">
//             <label className={LABEL_CLASS}>Taxi Cost (₹)</label>
//             <input
//               type="number"
//               step="0.01"
//               min="0"
//               name="taxiCost"
//               value={formData.taxiCost}
//               onChange={handleChange}
//               className={FIELD_CLASS}
//             />
//           </div>
//         ) : (
//           <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 md:col-span-1 self-end pb-2">
//             <Info size={14} className="mt-0.5 shrink-0" />
//             <p>
//               Taxi reimbursement was not selected when this request was submitted,
//               so it cannot be claimed now.
//             </p>
//           </div>
//         )}
//       </div>

//       <div className="flex justify-end">
//         <button
//           type="submit"
//           disabled={isSubmitting}
//           className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 text-white font-semibold rounded-lg shadow-sm transition-all"
//         >
//           {isSubmitting ? 'Processing…' : 'Process Bill'}
//         </button>
//       </div>
//     </form>
//   );
// }
