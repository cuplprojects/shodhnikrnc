using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace RMS.Models
{
    public class DocumentMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int DocumentMasterID { get; set; }
        public string DocumentName { get; set; }
        public bool Status { get; set; }
        public string DocType { get; set; }

        public string? Validations { get; set; }


        [NotMapped]
        public DocumentValidationRules? ValidationRules
        {
            get => string.IsNullOrEmpty(Validations)
                ? null
                : JsonSerializer.Deserialize<DocumentValidationRules>(Validations);

            set => Validations = value == null
                ? null
                : JsonSerializer.Serialize(value);
        }

        public string Stage { get; set; }
    }
    public class DocumentValidationRules
    {
        public bool IsAlphanumeric { get; set; }
        public bool IsSpecialCharacterAllowed { get; set; }
        public int MinLength { get; set; }
        public int MaxLength { get; set; }
        public decimal MaxFileSizeMB { get; set; }
    }
}
