using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace RMS.Models
{
    public class WorkflowStep
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int StepID { get; set; }

        [Required]
        public int WorkflowID { get; set; }

        [ForeignKey("WorkflowID")]
        [JsonIgnore]
        public WorkflowDefinition? Workflow { get; set; }

        [Required]
        public int StepOrder { get; set; }

        [Required]
        [StringLength(100)]
        public string StepName { get; set; }

        [Required]
        public int RequiredRoleID { get; set; }

        [ForeignKey("RequiredRoleID")]
        public Role? RequiredRole { get; set; }

        public bool IsFinalStep { get; set; } = false;

        public string? ActionToTrigger { get; set; } // e.g., "ActivateUser", "GenerateLetter"
    }
}
