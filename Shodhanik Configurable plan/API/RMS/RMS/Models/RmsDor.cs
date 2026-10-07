namespace RMS.Models
{
    public class RmsDor
    {
        public int Id { get; set; }
        public int DepartmentId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string ContactNo { get; set; }
        public string Address { get; set; }
        public DateTime From {  get; set; }
        public DateTime To { get; set; }
    }
}
