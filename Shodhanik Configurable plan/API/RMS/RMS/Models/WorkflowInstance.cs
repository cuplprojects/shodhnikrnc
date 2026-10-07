using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace RMS.Models
{
    public class WorkflowInstance
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int InstanceID { get; set; }

        [Required]
        public int WorkflowID { get; set; }

        [ForeignKey("WorkflowID")]
        [JsonIgnore]
        public WorkflowDefinition? Workflow { get; set; }

        [Required]
        public int EntityID { get; set; } // The ID of the record being approved (e.g., ScholarID)

        [Required]
        [StringLength(50)]
        public string EntityType { get; set; } // e.g., "Scholar", "ProgressReport"

        [Required]
        public int CurrentStepOrder { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected, Cancelled

        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        public DateTime? CompletedAt { get; set; }

        // Rejection tracking for retry logic
        public int RejectionCount { get; set; } = 0; // Total number of rejections across all steps
        
        public int CurrentStepRejectionCount { get; set; } = 0; // Rejections at current step
        
        public bool IsLocked { get; set; } = false; // True if rejected twice (final rejection)

        public ICollection<WorkflowLog>? Logs { get; set; }
    }
}
