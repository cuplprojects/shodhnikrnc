using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class ContactSettings
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? UniversityName { get; set; }
        public string? StreetAddress { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Helpline { get; set; }
        public string? HelpdeskEmail { get; set; }
        public string? WorkingHours { get; set; }
        public string? MapUrl { get; set; }
        public string? RailwayDistance { get; set; }
        public string? OldBusStandDistance { get; set; }
        public string? NewBusStandDistance { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}