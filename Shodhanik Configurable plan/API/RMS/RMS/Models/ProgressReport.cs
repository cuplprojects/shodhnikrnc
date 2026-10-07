using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ProgressReport
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int PRID { get; set; }
        public int? SID { get; set; }

        public string? PRTitle { get; set; }

        public DateTime? LastDate { get; set; }

        public string? ReportFilePath { get; set; }
        public DateTime? UploadDate { get; set; }

        public int? isApprovedbySupervisor { get; set; }

        public string? SupervisorComments { get; set; }

        public DateTime? SupervisorApprovalDate { get; set; }

    }
}
