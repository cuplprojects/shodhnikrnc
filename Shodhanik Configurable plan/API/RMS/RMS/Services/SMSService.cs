using System;

using System.Net;

using System.Text; // for class Encoding

using System.IO; // for StreamReader

namespace NLUSONEPATAPI.Services

{

    public class SmsService

    {

        private readonly string _apiUrl;

        private readonly string _apiKey;

        private readonly string _userId;

        private readonly string _senderId;

        private readonly string _password;

        public SmsService(string apiUrl, string apiKey, string userId, string senderId, string password)

        {

            _apiUrl = apiUrl;

            _apiKey = apiKey;

            _userId = userId;

            _senderId = senderId;

            _password = password;

        }

        public string SendSms(string mobileNumber, string message, string templateId)

        {

            var request = (HttpWebRequest)WebRequest.Create(_apiUrl);

            var postData = $"apiKey={_apiKey}&userId={_userId}&password={_password}&senderId={_senderId}&mobile={mobileNumber}&sendMethod=simplemsg";

            postData += $"&msgType=TEXT&msg={Uri.EscapeDataString(message)}&format=json&templateId={templateId}";

            var data = Encoding.ASCII.GetBytes(postData);

            request.Method = "POST";

            request.ContentType = "application/x-www-form-urlencoded";

            request.ContentLength = data.Length;

            using (var stream = request.GetRequestStream())

            {

                stream.Write(data, 0, data.Length);

            }

            using (var response = (HttpWebResponse)request.GetResponse())

            using (var reader = new StreamReader(response.GetResponseStream()))

            {

                return reader.ReadToEnd();

            }

        }

    }

}