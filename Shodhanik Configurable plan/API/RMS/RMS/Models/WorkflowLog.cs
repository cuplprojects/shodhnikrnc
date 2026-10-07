using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace RMS.Models
{
    public class WorkflowLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int LogID { get; set; }

        [Required]
        public int InstanceID { get; set; }

        [ForeignKey("InstanceID")]
        [JsonIgnore]
        public WorkflowInstance? Instance { get; set; }

        [Required]
        public int StepID { get; set; }

        [ForeignKey("StepID")]
        [JsonIgnore]
        public WorkflowStep? Step { get; set; }

        [Required]
        public int ActionByUserID { get; set; }

        [Required]
        [StringLength(20)]
        public string Action { get; set; } // Approve, Reject

        public string? Comments { get; set; }
        
        public string? FilePath { get; set; }

        public DateTime ActionTimestamp { get; set; } = DateTime.UtcNow;
        
        // Additional metadata for specific workflow steps
        public DateTime? ScheduledMeetingDate { get; set; } // For RDC meeting scheduling, viva dates, etc.
    }
}
