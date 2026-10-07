import PrintHeader from '@/components/cms/PrintHeader'

const RDCProceedingLetter = ({ profileData, synopsisData }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-GB')
  }

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-GB')
  }

  return (
    <>
      <style jsx>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          
          @page {
            size: A4;
            margin: 15mm;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
      
      <div style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        margin: '0 auto',
        padding: '15mm',
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        lineHeight: '1.3',
        boxSizing: 'border-box',
        backgroundColor: 'white',
        color: 'black'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '10px' }}>
          <PrintHeader />
        </div>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h4 style={{ 
            fontSize: '12px', 
            fontWeight: 'bold', 
            margin: '0',
            textDecoration: 'underline',
            color: '#1f2937'
          }}>
            RDC PROCEEDING LETTER
          </h4>
        </div>

        {/* Applicant Details Table */}
        <div style={{ marginBottom: '20px' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1px solid #6b7280',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ 
                  border: '1px solid #6b7280', 
                  padding: '6px', 
                  textAlign: 'left', 
                  fontWeight: 'bold' 
                }} colSpan="4">
                  Applicant Details
                </th>
                <th style={{ 
                  border: '1px solid #6b7280', 
                  padding: '6px', 
                  textAlign: 'right',
                  fontWeight: 'bold'
                }}>
                  RDC Date: {getCurrentDate()}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb',
                  width: '20%'
                }}>
                  Admission Session:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px',
                  width: '15%'
                }}>
                  {profileData?.admissionYear || '-'}
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb',
                  width: '15%'
                }}>
                  Shodhanik ID
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="2">
                  {profileData?.shodhanikID || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Enrollment No.:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }}>
                  {profileData?.enrollmentNo || '-'}
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Roll No.
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="2">
                  {profileData?.rollNo || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Department/Subject:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="4">
                  {profileData?.subject || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Applicant Name:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }}>
                  {profileData?.scholarName || '-'}
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Category:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="2">
                  {profileData?.category || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Correspondence Address:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="4">
                  {profileData?.correspondanceAddress || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Proposed Research Title:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="4">
                  {synopsisData?.synopsis1Title || '-'}
                </td>
              </tr>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Synopsis Submission Date:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }}>
                  {formatDate(synopsisData?.synopsis1Date)}
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="3">
                </td>
              </tr>
              <tr>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px', 
                  fontWeight: '600', 
                  backgroundColor: '#f9fafb'
                }}>
                  Proposed Research Supervisor:
                </td>
                <td style={{ 
                  border: '1px solid #6b7280', 
                  padding: '4px'
                }} colSpan="4">
                  {profileData?.supervisor1Name || '-'}
                  {profileData?.supervisor2Name && `, ${profileData.supervisor2Name}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Content Sections */}
        <div style={{ textAlign: 'justify', lineHeight: '1.5' }}>
          {/* Section 1 */}
          <div style={{ marginBottom: '30px' }}>
            <p style={{ 
              fontSize: '15px', 
              marginBottom: '12px',
              fontWeight: '600'
            }}>
              रूपरेखा /सीनॉप्सिस के सम्बन्ध में विषय गत निम्न निर्देश है :-
            </p>
          </div>

          {/* Section 2 */}
          <div style={{ marginBottom: '30px',marginTop: '250px' }}>
            <p style={{ 
              fontSize: '15px', 
              marginBottom: '12px',
              fontWeight: '600'
            }}>
              शोध निर्देशक के सम्बन्ध में निर्णय निम्नवत है:-
            </p>
          </div>

          {/* Signatures Section */}
          <div style={{ marginTop: '30px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <p style={{ 
                fontSize: '16px', 
                fontWeight: 'bold',
                margin: '0'
              }}>
                हस्ताक्षर
              </p>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '30px'
            }}>
              <div style={{ width: '45%' }}>
                <p style={{ marginBottom: '6px', fontSize: '14px' }}>1. संकायाध्यक्ष</p>
              </div>
              <div style={{ width: '45%' }}>
                <p style={{ marginBottom: '6px', fontSize: '14px' }}>2. बाहय विशेषज्ञ</p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '30px'
            }}>
              <div style={{ width: '45%' }}>
                <p style={{ marginBottom: '6px', fontSize: '14px' }}>3.  विभागाध्यक्ष / सयोजक</p>
              </div>
              <div style={{ width: '45%' }}>
                <p style={{ marginBottom: '6px', fontSize: '14px' }}>4. बाहय विशेषज्ञ</p>
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <p style={{ marginBottom: '6px', fontSize: '14px' }}>5. निदेशक-प्रतिनिधि</p>
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <p style={{ 
                fontSize: '16px', 
                fontWeight: 'bold',
                marginBottom: '12px'
              }}>
                कुलपति
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default RDCProceedingLetter