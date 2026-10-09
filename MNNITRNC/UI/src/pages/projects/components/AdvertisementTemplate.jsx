import React from 'react';

// Using actual Unicode Hindi instead of legacy Kruti Dev font mapping
const AdvertisementTemplate = React.forwardRef(({ project, manpower, formData }, ref) => {
  const date = new Date().toLocaleDateString('en-IN');
  const year = new Date().getFullYear();

  return (
    <div style={{ display: 'none' }}>
      <div 
        ref={ref} 
        style={{ 
          padding: '20px 40px', 
          fontFamily: '"Times New Roman", Times, serif', 
          fontSize: '14px', 
          lineHeight: '1.4',
          color: '#000',
          background: '#fff',
          width: '800px', // Fixed width for A4 proportion
        }}
      >
        {/* Page 1: Advertisement Section */}
        <div style={{ pageBreakAfter: 'always' }}>
          <table style={{ width: '100%', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ width: '120px', verticalAlign: 'middle' }}>
                  {/* Using a placeholder for the logo - in production we'd use the actual MNNIT logo URL */}
                  <div style={{ width: '100px', height: '100px', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', textAlign: 'center' }}>
                    MNNIT<br/>LOGO
                  </div>
                </td>
                <td style={{ verticalAlign: 'middle', textAlign: 'center', paddingLeft: '10px' }}>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'normal', fontFamily: 'Mangal, "Nirmala UI", sans-serif' }}>मोतीलाल नेहरू राष्ट्रीय प्रौद्योगिकी संस्थान इलाहाबाद</h1>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'normal', fontFamily: 'Mangal, "Nirmala UI", sans-serif' }}>प्रयागराज-211004 (भारत)</h1>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Motilal Nehru National Institute of Technology Allahabad</h2>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Prayagraj - 211004 (India)</h2>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{project?.department || ''}</h2>
                </td>
              </tr>
            </tbody>
          </table>
          
          <hr style={{ border: '1px solid black', margin: '10px 0' }} />

          <table style={{ width: '100%', marginBottom: '15px' }}>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', width: '50%' }}>
                  <strong>Advertisement No.:</strong> ___________/{year}
                </td>
                <td style={{ textAlign: 'right', width: '50%' }}>
                  <strong>Date:</strong> {date}
                </td>
              </tr>
            </tbody>
          </table>

          <h2 style={{ fontSize: '16px', margin: '15px 0', textAlign: 'center', textDecoration: 'underline' }}>
            Advertisement for the Post of {manpower?.designation} (On Contract)
          </h2>

          <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
            Applications are invited from Indian nationals for the following position in a research project entitled 
            <strong> "{project?.projectTitle}"</strong> sponsored by the <strong>{project?.agency}</strong>. 
            This project focuses on {formData?.aboutProject}.
          </p>
          
          <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
            The position is purely temporary, co-terminus with the project and will be governed by the project guidelines of 
            {project?.agency} and rules & regulations of Motilal Nehru National Institute of Technology Allahabad, Prayagraj, Uttar Pradesh.
          </p>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <tbody>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', width: '30%' }}>Number of the Position</th>
                <td style={{ border: '1px solid #000', padding: '6px', width: '10%' }}>{manpower?.positions || 1}</td>
                <td style={{ border: '1px solid #000', padding: '6px', width: '60%' }}>{manpower?.designation}</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Educational Qualification</th>
                <td colSpan="2" style={{ border: '1px solid #000', padding: '6px' }}>
                  (i) {formData?.educationalQualification1}<br/>
                  {formData?.educationalQualification2 && `(ii) ${formData?.educationalQualification2}`}
                </td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Desirable Experience</th>
                <td colSpan="2" style={{ border: '1px solid #000', padding: '6px' }}>{formData?.desirableExperience}</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Other Benefits</th>
                <td colSpan="2" style={{ border: '1px solid #000', padding: '6px' }}>{formData?.otherBenefits}</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Fellowship</th>
                <td colSpan="2" style={{ border: '1px solid #000', padding: '6px' }}>{formData?.fellowship}</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Age Limit</th>
                <td colSpan="2" style={{ border: '1px solid #000', padding: '6px' }}>{formData?.ageLimit}</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Tenure of Appointment</th>
                <td colSpan="2" style={{ border: '1px solid #000', padding: '6px' }}>{formData?.tenure}</td>
              </tr>
            </tbody>
          </table>
          
          <div style={{ margin: '15px 0' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Note:</p>
            <ol style={{ paddingLeft: '20px', margin: 0 }}>
              <li style={{ marginBottom: '5px' }}>The applicant will be responsible for the authenticity of information, other documents and photographs submitted.</li>
              <li style={{ marginBottom: '5px' }}>The Institute reserves the right to accept application at any time, and consider candidates of exceptional credentials without applications.</li>
              <li style={{ marginBottom: '5px' }}>Qualification and experience may be relaxed by the Institute at any point of time for otherwise exceptional candidates. Mere, possessing the prescribed qualification does not ensure that the candidate would be called for Interview. The Candidates will be shortlisted on the basis of merit and need of the project.</li>
              <li style={{ marginBottom: '5px' }}>Shortlisted Candidates will be informed by e-mail about the interview date. So, the candidate must provide valid Email IDs in their applications.</li>
              <li style={{ marginBottom: '5px' }}>Shortlisted candidates have to present themselves for the interview on the interview date with updated CV, publications if any and original and attested photocopies of mark sheets/ certificates in support of their academic qualifications.</li>
              <li style={{ marginBottom: '5px' }}>Applicants in employment (private, government or any other organization) are required to submit a "No Objection Certificate" from the employer at the time of interview.</li>
              <li style={{ marginBottom: '5px' }}>No TA/DA will be paid for appearing in the interview.</li>
            </ol>
          </div>
          
          <p style={{ margin: '15px 0', textAlign: 'justify' }}>
            The duly completed application (soft copy in PDF) on prescribed format along with scanned copies of supporting documents must reach to PI's email id: 
            <strong> PI_EMAIL@mnnit.ac.in</strong> (email id of PI Name, {project?.department}) with the subject of the email as "Application for {manpower?.designation} (on contract) in {project?.agency} Project" on or before <strong>{formData?.lastDate}</strong>.
          </p>
          
          <div style={{ marginTop: '15px' }}>
            <p style={{ margin: '0 0 5px 0' }}><strong>Name of Principal Investigator (PI):</strong> PI Name</p>
            <p style={{ margin: '0 0 5px 0' }}><strong>Designation:</strong> PI Designation</p>
            <p style={{ margin: '0 0 5px 0' }}><strong>Department:</strong> {project?.department}</p>
          </div>
        </div>
        
        {/* Page 2: Application Form (Truncated for brevity, but has headers) */}
        <div>
          <table style={{ width: '100%', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ width: '120px', verticalAlign: 'middle' }}>
                  <div style={{ width: '100px', height: '100px', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', textAlign: 'center' }}>
                    MNNIT<br/>LOGO
                  </div>
                </td>
                <td style={{ verticalAlign: 'middle', textAlign: 'center', paddingLeft: '10px' }}>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'normal', fontFamily: 'Mangal, "Nirmala UI", sans-serif' }}>मोतीलाल नेहरू राष्ट्रीय प्रौद्योगिकी संस्थान इलाहाबाद</h1>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'normal', fontFamily: 'Mangal, "Nirmala UI", sans-serif' }}>प्रयागराज-211004 (भारत)</h1>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Motilal Nehru National Institute of Technology Allahabad</h2>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Prayagraj - 211004 (India)</h2>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{project?.department || ''}</h2>
                </td>
              </tr>
            </tbody>
          </table>
          
          <hr style={{ border: '1px solid black', margin: '10px 0' }} />
          
          <div style={{ textAlign: 'center', textDecoration: 'underline', fontWeight: 'bold', margin: '20px 0', fontSize: '16px' }}>
            APPLICATION FORM
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <tbody>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', width: '25%', backgroundColor: '#f0f0f0' }}>Research Project Entitled</th>
                <td style={{ border: '1px solid #000', padding: '6px', width: '50%' }}>{project?.projectTitle}</td>
                <td rowSpan="5" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', verticalAlign: 'middle', width: '25%' }}>
                  <div style={{ border: '1px dashed #000', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    Self-Attested recent<br/>passport size Photograph
                  </div>
                </td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>Funding Agency</th>
                <td style={{ border: '1px solid #000', padding: '6px' }}>{project?.agency}</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>Name of P.I.</th>
                <td style={{ border: '1px solid #000', padding: '6px' }}>PI Name</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>Name of position</th>
                <td style={{ border: '1px solid #000', padding: '6px' }}>{manpower?.designation}</td>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', backgroundColor: '#f0f0f0' }}>Department/Section</th>
                <td style={{ border: '1px solid #000', padding: '6px' }}>{project?.department}</td>
              </tr>
            </tbody>
          </table>
          
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '15px' }}>
            PERSONAL DETAILS
          </div>
          
          <table style={{ width: '100%', marginBottom: '20px' }}>
            <tbody>
              <tr><td style={{ width: '5%', padding: '5px' }}>1.</td><td style={{ width: '40%', padding: '5px' }}>Name of the Candidate</td><td style={{ borderBottom: '1px dotted #000', width: '55%' }}></td></tr>
              <tr><td style={{ padding: '5px' }}>2.</td><td style={{ padding: '5px' }}>Sex (Male/Female)</td><td style={{ borderBottom: '1px dotted #000' }}></td></tr>
              <tr><td style={{ padding: '5px' }}>3.</td><td style={{ padding: '5px' }}>Marital Status</td><td style={{ borderBottom: '1px dotted #000' }}></td></tr>
              <tr><td style={{ padding: '5px' }}>4.</td><td style={{ padding: '5px' }}>Date of Birth</td><td style={{ borderBottom: '1px dotted #000' }}></td></tr>
              <tr><td style={{ padding: '5px' }}>5.</td><td style={{ padding: '5px' }}>Father's/Husband's Name</td><td style={{ borderBottom: '1px dotted #000' }}></td></tr>
            </tbody>
          </table>
          
          {/* Declaration */}
          <div style={{ marginTop: '40px' }}>
            <div style={{ textAlign: 'center', textDecoration: 'underline', fontWeight: 'bold', marginBottom: '15px' }}>DECLARATION</div>
            <p style={{ textAlign: 'justify', marginBottom: '30px' }}>
              I hereby declare that all the statements made in this application are true and complete and nothing has been concealed/ distorted. I am aware that, if at any time I am found to have concealed/distorted any material information, my engagement is liable to be summarily terminated without notice.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px' }}>
              <div>
                <p>Place: ...........................................</p>
                <p>Date: ............................................</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p>......................................................</p>
                <p>Signature of the Applicant</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdvertisementTemplate;
