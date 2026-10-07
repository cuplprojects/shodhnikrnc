

using RMS.Data;
using RMS.Models;
using System.Diagnostics;



namespace RMS.Services
{
    public class LoggerService : ILoggerService
    {
        private readonly RMSDbContext _rMSDbContext;

        public LoggerService(RMSDbContext rMSDbContext)
        {
            _rMSDbContext = rMSDbContext;
        }



        public void LogEvent(string message, string category, int triggeredBy, string oldValue = null, string newValue = null)
        {
            var log = new Models.EventLog
            {
                Event = message,
                EventTriggeredBy = triggeredBy,
                Category = category,
                OldValue = oldValue,  // Log the old value if available
                NewValue = newValue   // Log the new value if available
            };
            _rMSDbContext.EventLogs.Add(log);
            _rMSDbContext.SaveChanges();
        }
        public void LogError(string error, string errormessage, string Controller)
        {
            var log = new ErrorLog
            {
                Error = error,
                Message = errormessage,
                OccuranceSpace = Controller,
            };

            _rMSDbContext.ErrorLogs.Add(log);
            _rMSDbContext.SaveChanges();
        }
    }
}
