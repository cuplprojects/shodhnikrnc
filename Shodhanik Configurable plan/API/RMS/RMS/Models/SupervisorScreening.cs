namespace RMS.Models
{
    public class SupervisorScreening
    {
        public int Id { get; set; }
        public int SupId { get; set; }
        public string? Screening1Remark1 { get; set; }
        public string? ScreeningRemark2 { get; set; }
        public int? Screening1Count { get; set; } = 0;
        public int? Screening2Count { get; set; } = 0;
        public string? Screening2Remark1 { get; set; }
        public string? Screening2Remark2 { get; set; }
        public int? User1 { get; set; }
        public int? User2 { get; set; }
        public int? User3 { get; set; }
        public int? User4 { get; set; }
        public DateTime? Screening1Time { get; set; }
        public DateTime? Screening2Time { get; set; }
        public int? Screening1Status { get; set; } = 0;
        public int? Screening2Status { get; set; } = 0;
        public string? Screening3Remark1 { get; set; }
        public string? Screening3Remark2 { get; set; }
        public int? Screening3Count { get; set; } = 0;
        public int? Screening4Count { get; set; } = 0;
        public DateTime? Screening3Time { get; set; }
        public int? Screening3Status { get; set; } = 0;
        public DateTime? Screening4Time { get; set; }
        public int? Screening4Status { get; set; } = 0;
        public string? Screening4Remark1 { get; set; }
        public string? Screening4Remark2 { get; set; }
        public DateTime? Screening5Time { get; set; }
        public int? Screening5Status { get; set; } = 0;
        public string? Screening5Remark1 { get; set; }
        public string? Screening5Remark2 { get; set; }
        public int? Screening6Status { get; set; } = 0;
        public DateTime? Screening6Time { get; set; }
        public string? Screening6Remark1 { get; set; } 
        public string? Screening6Remark2 { get; set; }
        public int? Screening5Count { get; set; } = 0;
        public int? Screening6Count { get; set; } = 0;
        public int? User5 { get; set; }
        public int? User6 { get; set; }
    }
}
