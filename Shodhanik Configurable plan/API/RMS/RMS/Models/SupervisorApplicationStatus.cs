using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SuplicationApplicationStatus
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SupId { get; set; }
        public DateTime RegAt { get; set; }
        public bool Step_1 { get; set; }
        public bool Step_2 { get; set; }
        public bool Step_3 { get; set; }
        public bool Step_4 { get; set; }
        public bool Step_5 { get; set; }
        public bool Step_6 { get; set; }
        public bool Step_7 { get; set; }
        public bool Step_8 { get; set; }
        public DateTime Step_1At { get; set; }
        public DateTime? Step_2At { get; set; }
        public DateTime? Step_3At { get; set; }
        public DateTime? Step_4At { get; set; }
        public DateTime? Step_5At { get; set; }
        public DateTime? Step_6At { get; set; }
        public DateTime? Step_7At { get; set; }
        public DateTime? Step_8At { get; set; }

    }
}
