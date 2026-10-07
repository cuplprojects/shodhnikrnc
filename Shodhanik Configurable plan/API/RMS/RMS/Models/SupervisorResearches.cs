namespace RMS.Models
{
    public class SupervisorResearches
    {
        public int Id { get; set; }
        public int SupId { get; set; }
        public string ResearchArea { get; set; }
        public int ResearchYear { get; set; }
        public int? Phd_Awarded { get; set; }
        public int? MPhil_Awarded { get; set; }
        public int? Dissertation { get; set; }
        public int? Phd_UnderSupervision { get; set; }
        public int? MPhil_UnderSupervision { get; set; }
        public int? DissertationUnderSupervision { get; set; }
        public string? Scopus { get; set; }
        public string? Orchid { get; set; }
        public string? PublOns { get; set; }
        public string? Vidwan { get; set; }
        public string? GoogleScholar { get; set; }

    }
}
