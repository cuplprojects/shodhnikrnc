using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class WorkflowAction
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ActionID { get; set; }

        [Required]
        [StringLength(100)]
        public string ActionName { get; set; }

        [Required]
        [StringLength(100)]
        public string ActionKey { get; set; } // Matches the keys used in WorkflowService logic

        public string? Description { get; set; }
    }
}
