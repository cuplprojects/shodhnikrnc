import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';

const ScholarTnC = () => {
  const navigate = useNavigate();
  const [isAccepted, setIsAccepted] = useState(false);

  const handleProceed = () => {
    if (!isAccepted) {
      return;
    }
    // Navigate to registration form
    navigate('/register-scholar/register');
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white/20 p-3 rounded-full">
                <GraduationCap className="h-10 w-10" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center">
              INSTRUCTIONS TO THE APPLICANTS
            </h1>
          </div>

          {/* Content */}
          <div className="px-6 py-8 space-y-8">
            {/* Required Documents Section */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-blue-600 text-center">
                REQUIRED DOCUMENTS AND DETAILS FOR FILLING APPLICATION
              </h2>

              <div className="space-y-4 text-gray-700">
                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">◆</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Email ID & Mobile Number</h3>
                    <p className="text-sm mt-1">
                      All relevant information regarding application will be sent to this mobile number and e-mail ID.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">◆</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Academic Eligibility Criteria</h3>
                    <ul className="text-sm mt-2 space-y-1 ml-4">
                      <li className="list-disc">
                        General / Women: <b>55%</b>
                      </li>
                      <li className="list-disc">
                        SC / ST / OBC / EWS / PH: <b>50%</b>
                      </li>
                      <li className="list-disc ">
                        Appearing PG candidates must:
                        <ul className='ml-6 mt-1 space-y-1'>
                          <li className="list-disc">
                            Produce final marksheet at the time of interview
                          </li>
                          <li className="list-disc">
                            Upload the final marksheet before interview once available
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">◆</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Scanned Photograph in JPEG/JPG format (Maximum upload size is 50 KB only)
                    </h3>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">◆</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Scanned Signature in JPEG/JPG format (Maximum upload size is 50 KB only)
                    </h3>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 text-sm">
                    It is the responsibility of the applicant to read instructions and check his/ her eligibility at the time of filling application. We are not verifying the eligibility at the time of filling application. The eligibility will be verified by the University at the time of Admission.
                  </p>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">◆</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Photo Identity proof</h3>
                    <ul className="text-sm mt-2 space-y-1 ml-4">
                      <li className="list-disc">
                        Any one of the following for entering the Identity Proof number during filling application form.
                      </li>
                      <li className="list-disc">
                        Aadhar Card, Voter ID, Driving License, Passport.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">◆</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Application Fee</h3>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">◆</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Caste / EWS Certificate</h3>
                    <div className="text-sm mt-2 space-y-1">
                      <p>
                        The number of CASTE/EWS certificate issued by the competent authority will have to be filled for availing the benefit of reservation for EWS, OBC, SC and ST applicants. Authenticity of these certificates will be verified from the Government website.
                      </p>
                      <p className="mt-2">OBC Certificate issued on or after July 1, 2018.</p>
                      <p className="text-red-600">
                        The OBC Non Creamy layer certificate issued before July 1, 2018 will not be considered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Filling Instructions */}
            <div className="space-y-4 border-t pt-6">
              <h2 className="text-2xl font-bold text-blue-600 text-center">
                FORM FILLING INSTRUCTIONS
              </h2>

              <div className="space-y-4 text-gray-700">
                <p>
                  While form filling process the applicant can make the entries and save the information at each steps.
                </p>

                <p>
                  If the applicant is unable to fill the form in one sitting or somehow the process is interrupted there is no need to register again. They can login using the credentials sent on their mobile or email and continue the remaining process.
                </p>

                <p>
                  Applicants are advised to check all the data they have filled before submitting the application fee. If there is some error they can update it or start the entire process again. Once they have paid the application fee the data filled in the registration page cannot be edited under any circumstances.
                </p>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">▸</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Registration</h3>
                    <p className="text-sm mt-1">
                      Applicants have to fill the relevant details in the form. These fields cannot be edited later.
                    </p>
                    <p className="text-sm mt-2">
                      Applicants will receive their login details in the mobile number and email ID provided at the time of registration.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">▸</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Step 1 : Personal Details.</h3>
                    <p className="text-sm mt-1 ml-4">○ Applicants have to enter their personal details.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">▸</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Step 2 : Educational Details.</h3>
                    <p className="text-sm mt-1 ml-4">
                      ○ Applicants provide his/her High School, Intermediate, Graduation & Post Graduation
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">▸</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Step 3 : Upload Documents.</h3>
                    <p className="text-sm mt-1 ml-4">
                      ○ Upload Scanned Photograph, Signature & Qualifying Exam Marksheet as per instructions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">▸</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Step 4 : Application Preview.</h3>
                    <p className="text-sm mt-1 ml-4">
                      ○ Review your application and its all data filled by you is correct or not. If not you can update.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">▸</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Step 5 : Payment.</h3>
                    <p className="text-sm mt-1 ml-4">
                      ○  You can pay online Fee using Credit / Debit Card / Net Banking etc.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-blue-600 mt-1">▸</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">Step 6 : Print Application.</h3>
                    <p className="text-sm mt-1 ml-4">○ Print your application for future use.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Declaration Statement */}
            <div className="border-t pt-6">
              <h2 className="text-2xl font-bold text-red-600 text-center mb-4">
                DECLARATION STATEMENT
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <p className="text-gray-700 text-sm leading-relaxed">
                  I have read and understood all the eligibility conditions and instructions regarding the Admission Process for the Ph. D. Programme of the Chaudhary Charan Singh University - Meerut. I understand that it is my responsibility to check the eligibility criteria and other conditions. I am also aware that the University is not verifying the eligibility at the time of submission of online application and will be verified by the University at the time of admission. I understand that if any information filled by me is found to be false, my application and my right to admission in the University shall null and void.
                </p>
              </div>
            </div>

            {/* Acceptance Checkbox */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <input
                type="checkbox"
                id="accept"
                checked={isAccepted}
                onChange={(e) => setIsAccepted(e.target.checked)}
                className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="accept" className="text-gray-700 font-medium cursor-pointer select-none">
                I have read and accept all the terms, conditions, and instructions mentioned above.
              </label>
            </div>

            {/* Warning Message */}
            {!isAccepted && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertCircle size={20} />
                <p className="text-sm">
                  Please accept the declaration statement to proceed with registration.
                </p>
              </div>
            )}

            {/* Proceed Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleProceed}
                disabled={!isAccepted}
                className={`px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 flex items-center gap-2 ${isAccepted
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                  : 'bg-gray-400 cursor-not-allowed'
                  }`}
              >
                {isAccepted && <CheckCircle2 size={20} />}
                Proceed to Start Registration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScholarTnC;