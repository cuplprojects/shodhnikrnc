// Content mirrors docs/manual/MNNIT_RC_HOD_User_Manual.pdf, one slide per
// numbered step in that PDF, in the PDF's own order.
const modules = import.meta.glob('../../assets/manual/hod/*.{png,jpg,jpeg}', { eager: true, import: 'default' });

function img(page) {
  const key = Object.keys(modules).find((k) => k.endsWith(`hod-p${String(page).padStart(2, '0')}.png`)
    || k.endsWith(`hod-p${String(page).padStart(2, '0')}.jpg`)
    || k.endsWith(`hod-p${String(page).padStart(2, '0')}.jpeg`));
  return key ? modules[key] : null;
}

export const hodManual = {
  title: 'HOD User Manual',
  subtitle: 'Research, Consultancy, Projects, Grants, Indents, Travel & Process Bills',
  cover: img(1),
  slides: [
    { title: 'Login to the MNNIT R&C Portal', body: 'Open the MNNIT R&C Portal login page. Enter your registered credentials in the login form and click "Faculty Sign In" to access the portal. Use the credentials assigned to your HOD account.', image: img(3) },
    { title: 'Open and update your profile', body: 'After signing in, open your profile from the top-right user menu. Review the Professional Details and account information displayed for your faculty account. Update the available fields as required.', image: img(4) },
    { title: 'Save profile changes', body: 'Complete or correct the required professional and bank details, then click "Save Profile". Keep the information accurate because it is used across research, project, travel and payment workflows.', image: img(5) },
    { title: 'HOD Dashboard', body: 'The HOD Dashboard is the starting point for HOD activities. It shows Pending Actions, Active Projects, Notifications and the items currently waiting for your action. Use the left sidebar to open Proposal, Payment, Recruitment, Fellowship & Leave, HOD Portal and Reports.', image: img(6) },
    { title: 'Review a Research Proposal pending with HOD', body: 'Open the Research Proposal item from Pending Your Action. Review the proposal title, agency, proposed amount, overhead, total amount, duration, PI/Co-PI details and approval timeline before taking action.', image: img(7) },
    { title: 'Take action on the Research Proposal', body: 'Use the Available Actions area to record the HOD decision. Enter remarks when required and select the appropriate action, such as approval/forwarding. Check the approval timeline after submitting the action to confirm that the workflow stage has changed.', image: img(8) },
    { title: 'Confirm proposal forwarded to R&C Office', body: 'After the HOD action is completed, verify that the proposal status has moved to the R&C Office and that the timeline records the HOD forwarding action. The page also provides Agency Processing and Internal Queries information for follow-up.', image: img(9) },
    { title: 'Review the Project approval and workflow status', body: 'Open the relevant project from the Projects area. Review the project type, PI/Co-PI, sanction number, agency, sanctioned amount, budget plus overhead, approval history and current workflow stage. Project-dependent actions remain restricted until the required approval is completed.', image: img(10) },
    { title: 'Review Department Grant Receipt information', body: 'From the HOD workflow area, open the Grant Receipt items waiting for action. The dashboard lists the project/grant receipt records and provides a View action so the HOD can review the details.', image: img(11) },
    { title: 'Review Grant Receipts and budget-head amounts', body: 'Open the Grant Receipts section to review amounts received against budget heads such as Travel, Overhead, Manpower, Consumable, Equipment/Non-recurring and Contingency. Check the received date and amount before proceeding with related project activities.', image: img(12) },
    { title: 'Review an Indent pending with HOD', body: 'The HOD Dashboard displays pending Indent requests under Pending Your Action. Select the relevant indent, such as a consumable request, to open its detailed record.', image: img(13) },
    { title: 'Review and complete the signed Indent step', body: 'Review the indent and estimated cost. The generated indent form must be downloaded, signed and stamped as required, and the signed copy must then be uploaded in the Documents section. Use View/Download or Replace Signed Copy to manage the uploaded document.', image: img(14) },
    { title: 'Review Travel requests pending with HOD', body: 'Open the Travel item from Pending Your Action. Review the faculty member, purpose and travel request before opening the request details.', image: img(15) },
    { title: 'Review Travel Request details and documents', body: 'Check the travel dates, traveler type, primary travel mode, budget allocation, expected cost, journey itinerary and approval timeline. Review the generated travel request form and signed travel request documents in the Documents section.', image: img(16) },
    { title: 'Verify a forwarded Travel Request', body: 'After the HOD action, verify the workflow timeline and current responsible office/user. Confirm that the request has been forwarded to the next stage and that the required travel documents are available for review or download.', image: img(17) },
    { title: 'Review Process Bill items from the HOD Dashboard', body: 'The dashboard lists Process Bill requests that require HOD attention, such as a Consumable Bill or Travel Bill. Select View on the relevant item to open its details and continue the workflow.', image: img(18) },
    { title: 'Review and update Process Bill details', body: 'Review the Process Bill information, including optional E-Way Bill details for applicable product indents, Purchase Order/binding details, comparative statement reference where applicable, and stock-entry information. If the item has been received, complete the stock book page/date, description and quantity and upload the satisfactory certificate when required. Save or update the information after verification.', image: img(19) },
    { title: 'Review Travel Bill information', body: 'For a Travel Bill, verify the bill/reference number, bill generation date, journey start date/time, leg-wise actual arrival details, bill amount and actual distance. Compare actual journey details with the planned itinerary and ensure the entered information is complete before forwarding the bill.', image: img(20) },
    { title: 'Review Recruitment Offer Letter Release', body: 'Open the recruitment record and review the Offer Letter Release stage. The HOD can see the approval-chain status, remarks area and workflow history. If the offer requires HOD action, review the proposal and use Forward or Return as applicable. Add a clear remark when returning the offer.', image: img(23) },
    { title: 'Verify Fellow Joining Details', body: 'After the selected candidate submits joining details, review the joining credentials shown in the HOD Verification panel, including Aadhaar/PAN, bank account and IFSC, stipend, joining date, validity and gender. Check the signed offer letter and signed contract of engagement before taking the HOD action.', image: img(24) },
    { title: 'Confirm Joining Request Forwarded to Dean/DR', body: 'After verifying the joining details and uploaded documents, add the required approval remark and select Verify & Forward to Dean. The approval routing track should then show HOD Verification completed and the request waiting for Dean/DR approval.', image: img(25) },
    { title: 'Review Research Scholar ID Card Requests', body: 'Open Research Scholar ID Card Management under Fellowship & Leave. Review requests in the HOD Queue, confirm the candidate and department details, check the current workflow status, and use Forward or Reject as appropriate. The workflow follows PI → HOD → Dean.', image: img(26) },
    { title: 'Review and Process Fellowship Claims', body: 'Open Fellowship Approvals to review claims forwarded by the PI. Check the scholar, project, claim period, fellowship amount, HRA and total value. Use View History and the available supporting forms when required. After verification, select Approve & Forward, Return to PI or Reject according to the case.', image: img(27) },
    { title: 'Review Leave & Certificate Requests', body: 'Open Leave & NOC Approvals to review scholar leave and certificate-related requests. Check the request type, scholar/project details, dates, entitlement or purpose, and supporting documents. Use Approve/Forward or Return/Reject based on the review.', image: img(28) },
    { title: 'Review PhD NOC Requests', body: 'Open PhD NOC Requests and review requests pending at the HOD stage. Verify the student, department and request status, then use Approve or Reject. The View Certificate option can be used to inspect the generated certificate where available.', image: img(29) },
    { title: 'Review Experience Certificate Requests', body: 'Open Request for Experience Certificate and review the scholar/fellow, project title and number, department and current status. Use View Certificate to inspect the document, then select Approve or Reject according to the verification.', image: img(30) },
    { title: 'Review Medical Facility Requests', body: 'Open Request for Medical Facility and review the scholar/fellow, project, department and request status. Inspect the available certificate/document and use Approve or Reject after verifying the request.', image: img(31) },
  ],
  checklist: [
    'Verify proposal/project identity, PI/Co-PI, agency, amounts and duration before approval or forwarding.',
    'Check the Approval Timeline to confirm the current workflow stage and review any remarks or returned items.',
    'Confirm grant receipt information and budget-head allocations where relevant.',
    'For indents, confirm that the signed and stamped indent copy has been uploaded before completing the workflow.',
    'For travel requests, verify dates, traveler type, mode, budget, itinerary and required supporting documents.',
    'For process bills, verify applicable E-Way Bill, PO, comparative statement and stock-entry information.',
    'For travel bills, compare actual arrival details and distances with the planned itinerary.',
    'For recruitment, verify offer-letter status, candidate joining credentials, signed documents and the approval routing track before forwarding.',
    'For Research Scholar ID cards, verify the candidate/request details and move the request through the PI → HOD → Dean sequence.',
    'For fellowship claims, verify the claim period, fellowship/HRA amounts, supporting forms and PI recommendation before taking HOD action.',
    'For leave, PhD NOC, experience certificate and medical facility requests, review the supporting documents and use Approve/Forward or Return/Reject as appropriate.',
    'After every action, refresh or reopen the record and verify that the updated workflow status is displayed.',
  ],
};
