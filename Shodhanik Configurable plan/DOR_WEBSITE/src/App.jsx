import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Notification System
import NotificationContainer from '@/DORWEBSITE/components/NotificationContainer';

// DOR Website Components - Public Access
import DORHome from '@/DORWEBSITE/pages/Home/DORHome';

// About Us Components
import AboutDoR from '@/DORWEBSITE/pages/AboutUS/AboutDoR';
import ResearchPolicy from '@/DORWEBSITE/pages/AboutUS/ResearchPolicy';
import VisionMission from '@/DORWEBSITE/pages/AboutUS/VisionMission';
import VCMessage from '@/DORWEBSITE/pages/AboutUS/VCMessage';
import DirectorMessage from '@/DORWEBSITE/pages/AboutUS/DirectorMessage';
import AssociateDirectors from '@/DORWEBSITE/pages/AboutUS/AssociateDirectors';
import AssistantDirectors from '@/DORWEBSITE/pages/AboutUS/AssistantDirectors';
import AdditionalDirectors from '@/DORWEBSITE/pages/AboutUS/AdditionalDirectors';
import OfficeStaff from '@/DORWEBSITE/pages/AboutUS/OfficeStaff';
import SupportingStaff from '@/DORWEBSITE/pages/AboutUS/SupportingStaff';
import MoUs from '@/DORWEBSITE/pages/AboutUS/MoUs';
import Ordinance from '@/DORWEBSITE/pages/AboutUS/Ordinance';
import ResearchCompendium from '@/DORWEBSITE/pages/AboutUS/ResearchCompendium';
import CodeOfConduct from '@/DORWEBSITE/pages/AboutUS/CodeOfConduct';
import AvailableSeats from '@/DORWEBSITE/pages/AboutUS/AvailableSeats';

// Research Areas Components
import Agriculture from '@/DORWEBSITE/pages/ResearchAreas/Agriculture';
import Arts from '@/DORWEBSITE/pages/ResearchAreas/Arts';
import Ayurved from '@/DORWEBSITE/pages/ResearchAreas/Ayurved';
import Commerce from '@/DORWEBSITE/pages/ResearchAreas/Commerce';
import Education from '@/DORWEBSITE/pages/ResearchAreas/Education';
import EngineeringTech from '@/DORWEBSITE/pages/ResearchAreas/EngineeringTech';
import Law from '@/DORWEBSITE/pages/ResearchAreas/Law';
import Management from '@/DORWEBSITE/pages/ResearchAreas/Management';
import Science from '@/DORWEBSITE/pages/ResearchAreas/Science';

// Scholars Components
import ListCampus from '@/DORWEBSITE/pages/Scholars/ListCampus';
import ListCollege from '@/DORWEBSITE/pages/Scholars/ListCollege';
import ListPartTime from '@/DORWEBSITE/pages/Scholars/ListPartTime';
import ListForeign from '@/DORWEBSITE/pages/Scholars/ListForeign';
import CourseWorkCoordinators from '@/DORWEBSITE/pages/Scholars/CourseWorkCoordinators';
import CourseWorkSyllabus from '@/DORWEBSITE/pages/Scholars/CourseWorkSyllabus';

// Supervisors Components
import SupervisorsCampus from '@/DORWEBSITE/pages/Supervisors/Campus';
import AffiliatedColleges from '@/DORWEBSITE/pages/Supervisors/AffiliatedColleges';
import ExternalSupervisors from '@/DORWEBSITE/pages/Supervisors/External';
import CoSupervisors from '@/DORWEBSITE/pages/Supervisors/CoSupervisors';

// Other DOR Website Components
import Scipapers from '@/DORWEBSITE/pages/SCI-PAPERS/Scipapers';
import Awards from '@/DORWEBSITE/pages/Awards/Awards';
import Contact from '@/DORWEBSITE/pages/ContactUs/Contact';
import Download from '@/DORWEBSITE/pages/Downloads/Download';
import Noticeboard from '@/DORWEBSITE/pages/Notice/Noticeboard';
import Patents from '@/DORWEBSITE/pages/Patents/Patents';
import ResearchProject from '@/DORWEBSITE/pages/Projects/ResearchProject';
import Query from '@/DORWEBSITE/pages/Query-Complaint/Query';
import RDCSchedules from '@/DORWEBSITE/pages/VivaSchedule/RDCSchedules';
import Viva from '@/DORWEBSITE/pages/VivaSchedule/Viva';
import VivaSchedules from '@/DORWEBSITE/pages/VivaSchedule/VivaSchedules';
import UGCCare from '@/DORWEBSITE/pages/UGC-CARE/UGCCare';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <main className="flex-grow">
          <Routes>
            {/* Home Route */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<DORHome />} />
            
            {/* About Us Routes */}
            <Route path="/about-dor" element={<AboutDoR />} />
            <Route path="/research-policy" element={<ResearchPolicy />} />
            <Route path="/vision-mission" element={<VisionMission />} />
            <Route path="/vc-message" element={<VCMessage />} />
            <Route path="/director-message" element={<DirectorMessage />} />
            <Route path="/associate-directors" element={<AssociateDirectors />} />
            <Route path="/assistant-directors" element={<AssistantDirectors />} />
            <Route path="/additional-directors" element={<AdditionalDirectors />} />
            <Route path="/office-staff" element={<OfficeStaff />} />
            <Route path="/supporting-staff" element={<SupportingStaff />} />
            <Route path="/mous" element={<MoUs />} />
            <Route path="/ordinance" element={<Ordinance />} />
            <Route path="/research-compendium" element={<ResearchCompendium />} />
            <Route path="/code-of-conduct" element={<CodeOfConduct />} />
            <Route path="/available-seats" element={<AvailableSeats />} />

            {/* Research Areas Routes */}
            <Route path="/research-areas/agriculture" element={<Agriculture />} />
            <Route path="/research-areas/arts" element={<Arts />} />
            <Route path="/research-areas/ayurved" element={<Ayurved />} />
            <Route path="/research-areas/commerce" element={<Commerce />} />
            <Route path="/research-areas/education" element={<Education />} />
            <Route path="/research-areas/engineering-tech" element={<EngineeringTech />} />
            <Route path="/research-areas/law" element={<Law />} />
            <Route path="/research-areas/management" element={<Management />} />
            <Route path="/research-areas/science" element={<Science />} />

            {/* Scholars Routes */}
            <Route path="/scholars/list-campus" element={<ListCampus />} />
            <Route path="/scholars/list-college" element={<ListCollege />} />
            <Route path="/scholars/list-part-time" element={<ListPartTime />} />
            <Route path="/scholars/list-foreign" element={<ListForeign />} />
            <Route path="/scholars/course-work-coordinators" element={<CourseWorkCoordinators />} />
            <Route path="/scholars/course-work-syllabus" element={<CourseWorkSyllabus />} />

            {/* Supervisors Routes */}
            <Route path="/supervisors/campus" element={<SupervisorsCampus />} />
            <Route path="/supervisors/affiliated-colleges" element={<AffiliatedColleges />} />
            <Route path="/supervisors/external" element={<ExternalSupervisors />} />
            <Route path="/supervisors/co-supervisors" element={<CoSupervisors />} />

            {/* Other Routes */}
            <Route path="/sci-papers" element={<Scipapers />} />
            <Route path="/ugc-care" element={<UGCCare />} />
            <Route path="/awards" element={<Awards />} />
            <Route path="/contact-us" element={<Contact />} />
            <Route path="/downloads" element={<Download />} />
            <Route path="/noticeboard" element={<Noticeboard />} />
            <Route path="/patents" element={<Patents />} />
            <Route path="/research-projects" element={<ResearchProject />} />
            <Route path="/query-complaint" element={<Query />} />
            <Route path="/viva-schedules" element={<VivaSchedules />} />
            <Route path="/rdc-schedules" element={<RDCSchedules />} />
            <Route path="/viva" element={<Viva />} />

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
        
        {/* Notification Container */}
        <NotificationContainer />
      </div>
    </Router>
  );
}

export default App;