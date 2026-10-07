import PrintHeader from './PrintHeader';
import getBaseFileURL from '@/utils/getBaseFileUrl';

const IDCard = ({ scholarData, onPrint }) => {
  const currentDate = new Date().toLocaleDateString('en-GB');
  const baseFileURL = getBaseFileURL();

  // Construct the full image URL - try multiple possible paths
  const getImageUrl = () => {
    if (!scholarData?.documentPath) return null;

    const imagePath = scholarData?.documentPath;

    // Try different possible paths
    const possiblePaths = [
      `${baseFileURL}/uploads/${imagePath}`,
      `${baseFileURL}/documents/${imagePath}`,
      `${baseFileURL}/files/${imagePath}`,
      `${baseFileURL}/${imagePath}`,
    ];

    return possiblePaths[3]; // Start with the first one, can be adjusted based on your API structure
  };

  // Construct the signature URL
  const getSignatureUrl = () => {
    if (!scholarData?.signaturePath) return null;

    const signaturePath = scholarData?.signaturePath;

    // Try different possible paths for signature
    const possiblePaths = [
      `${baseFileURL}/uploads/${signaturePath}`,
      `${baseFileURL}/documents/${signaturePath}`,
      `${baseFileURL}/files/${signaturePath}`,
      `${baseFileURL}/${signaturePath}`,
    ];

    return possiblePaths[3];
  };

  const imageUrl = getImageUrl();
  const signatureUrl = getSignatureUrl();

  console.log('Scholar Data in IDCard:', scholarData);
  console.log('Base File URL:', baseFileURL);
  console.log('Image URL:', imageUrl);
  console.log('Signature URL:', signatureUrl);

  return (
    <div className="bg-white">
      {/* Print styles */}
      <style>{`
        @media print {
          /* Hide everything by default */
          body * {
            visibility: hidden;
          }
          
          /* Show only the ID card container and its children */
          .id-card-container,
          .id-card-container * {
            visibility: visible;
          }
          
          /* Reset positioning and layout for print */
          .id-card-container {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            max-width: none !important;
            transform: none !important;
          }
          
          /* Hide print button and back button */
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Ensure proper page setup */
          @page {
            margin: 10mm;
            size: A4;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-size: 12pt !important;
            line-height: 1.4 !important;
          }
          
          /* Fix grid layouts for print */
          .grid {
            display: grid !important;
          }
          
          /* Ensure proper spacing between elements */
          .id-card-container > div {
            margin-bottom: 8pt !important;
          }
          
          /* Fix flexbox layouts for print */
          .flex {
            display: flex !important;
          }
          
          .space-y-1 > * + * {
            margin-top: 4pt !important;
          }
          
          /* Prevent text overlap */
          .id-card-container span,
          .id-card-container div {
            position: static !important;
            float: none !important;
          }
          
          /* Ensure text doesn't break awkwardly */
          .id-card-container h1,
          .id-card-container h2,
          .id-card-container h3 {
            page-break-inside: avoid;
          }
          
          /* Fix image sizing for print */
          .id-card-container img {
            max-width: 100% !important;
            height: auto !important;
          }
        }
        
        .print-only { 
          display: none; 
        }
        
        @media print {
          .print-only { 
            display: block !important; 
          }
        }
      `}</style>

      {/* Print Button */}
      <div className="no-print mb-4 text-center">
        <button
          onClick={onPrint}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Print ID Card
        </button>
      </div>

      {/* ID Card Container */}
      <div className="id-card-container bg-white border-2 border-gray-300 rounded-lg p-4 max-w-xl mx-auto shadow-lg">
        {/* Print Header - Smaller version */}
        <div className="flex justify-center mb-0">
          <PrintHeader isSmall={true} showAddress={false}/>
        </div>

        {/* ID Card Title */}
        <div className="text-center mb-2 border-b-2 border-blue-600 pb-2">
          {/* <h2 className="text-2xl font-bold text-blue-800">STUDENT IDENTITY CARD</h2> */}
          <p className="text-sm text-gray-600 mt-">Ph.D. Research Scholar</p>
        </div>

        {/* Main ID Card Content */}
        <div className="flex gap-8">
          {/* Left Side - Details */}
          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-[120px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-semibold text-gray-800">Name</span>
              <span className="text-sm text-gray-600">:</span>
              <span className="text-sm font-medium text-gray-900">{scholarData?.name || 'N/A'}</span>
            </div>

            <div className="grid grid-cols-[120px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-semibold text-gray-800">Roll No.</span>
              <span className="text-sm text-gray-600">:</span>
              <span className="text-sm font-semibold text-blue-900">{scholarData?.shodhanikID || 'N/A'}</span>
            </div>

            {/* <div className="grid grid-cols-[120px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-semibold text-gray-800">Subject</span>
              <span className="text-sm text-gray-600">:</span>
              <span className="text-sm text-gray-900">{scholarData?.subject || 'N/A'}</span>
            </div> */}
            
            {/* <div className="grid grid-cols-[120px_20px_1fr] gap-2 items-center">
              <span className="text-sm font-semibold text-gray-800">Email</span>
              <span className="text-sm text-gray-600">:</span>
              <span className="text-sm text-gray-900">{scholarData?.email || 'N/A'}</span>
            </div> */}

            {/* 2x2 Grid for Phone, Academic Year, Address, Issue Date */}
            <div className="grid grid-cols-2 gap-6 mt-4">
              {/* Row 1, Col 1 - Phone */}
              <div className="flex flex-col space-y-1">
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-gray-800 w-20">Phone</span>
                  <span className="text-sm text-gray-600 mx-2">:</span>
                  <span className="text-sm text-gray-900">{scholarData?.phoneNumber || 'N/A'}</span>
                </div>
              </div>

              {/* Row 1, Col 2 - Academic Year */}
              <div className="flex flex-col space-y-1">
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-gray-800 w-24">Academic Year</span>
                  <span className="text-sm text-gray-600 mx-2">:</span>
                  <span className="text-sm text-gray-900">{scholarData?.year || 'N/A'}</span>
                </div>
              </div>

              {/* Row 2, Col 1 - Address */}
              <div className="flex flex-col space-y-1">
                <div className="flex items-start">
                  <span className="text-sm font-semibold text-gray-800 w-20">Address</span>
                  <span className="text-sm text-gray-600 mx-2">:</span>
                  <span className="text-sm text-gray-900">{scholarData?.permanentAddress || 'N/A'}</span>
                </div>
              </div>

              {/* Row 2, Col 2 - Issue Date */}
              <div className="flex flex-col space-y-1">
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-gray-800 w-20">Issue Date</span>
                  <span className="text-sm text-gray-600 mx-2">:</span>
                  <span className="text-sm text-gray-900">{currentDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Photo */}
          <div className="w-40 flex flex-col items-center">
            <div className="w-32 h-30 rounded-lg overflow-hidden flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Student Photo"
                  className="w-25 h-f object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`text-gray-500 text-xs text-center p-2 ${imageUrl ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}>
                Student Photo
              </div>
            </div>
            <div className="text-center">
              <div className="w-30 border-b border-gray-400 mt-15"></div>
              <p className="text-xs text-gray-600">Authorized Signature</p>
            </div>
            {/* Signature */}
            {/* <div className="mt-4 w-32 text-center">
              <div className="h-12 border-b border-gray-400 flex items-end justify-center pb-1">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Student Signature"
                    className="max-h-10 max-w-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <div className={`text-gray-400 text-xs ${signatureUrl ? 'hidden' : 'block'}`}>
                  Signature
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1">Student Signature</p>
            </div> */}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 pt-4 border-t border-gray-300">
          <div className="flex justify-center items-center">
            <div className="text-xs text-gray-600 text-center">
              <p>This card is property of the University . If found, please return to the University. <br/> This ID card is valid for six months from the date of issuance.</p>
              <p></p>
            </div>
            {/* <div className="text-right">
              <div className="w-24 border-b border-gray-400 mb-"></div>
              <p className="text-xs text-gray-600">Authorized Signature</p>
            </div> */}
          </div>
        </div>

        {/* Emergency Contact (Back side simulation) */}
        {/* <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-400">
          <h3 className="text-lg font-bold text-center text-gray-800 mb-4">EMERGENCY CONTACT</h3>
          <div className="space-y-2 text-sm">
            <p><strong>University Office:</strong> +91-121-2763001</p>
            <p><strong>Address:</strong> Chaudhary Charan Singh University, Meerut - 250004, Uttar Pradesh</p>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-600 italic">
              "This identity card will be valid for six months."
            </p>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default IDCard;