namespace RMS.Models
{
    public class SupervisorExperience
    {
        public int Id { get; set; }
        public int SupId { get; set; }
        public string OrganizationName { get; set; }
        public string Designation {  get; set; }
        public DateTime DateFrom { get; set; }
        public DateTime? DateTo { get; set; }
        public string NatureOfDuties { get; set; }
        public string? ResExperience { get; set; }
        public string? Category { get; set; }
        public string? AreaOfSpec { get; set; }
        public string? Doc { get; set; }
    }
}
