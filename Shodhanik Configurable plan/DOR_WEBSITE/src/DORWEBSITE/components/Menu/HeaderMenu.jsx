import {
  Home,
  Info,
  BookOpen,
  Users,
  GraduationCap,
  FileText,
  BookMarked,
  Award,
  FolderKanban,
  Lightbulb,
  Download,
  Phone,
  MessageSquare,
  Calendar,
  ClipboardCheck
} from 'lucide-react';
import aboutUsLinks from '../Links/About';
import researchAreasLinks from '../Links/ResearchAreas';
import supervisorsLinks from '../Links/Supervisors';
import scholarsLinks from '../Links/Scholars';

const menuItems = [
  { name: 'HOME', hasDropdown: false, path: '/home', icon: Home },
  { name: 'ABOUT US', hasDropdown: true, links: aboutUsLinks, path: '#', icon: Info },
  { name: 'RESEARCH AREAS', hasDropdown: true, links: researchAreasLinks, path: '#', icon: BookOpen },
  { name: 'SUPERVISORS', hasDropdown: true, links: supervisorsLinks, path: '#', icon: Users },
  { name: 'SCHOLARS', hasDropdown: true, links: scholarsLinks, path: '#', icon: GraduationCap },
  { name: 'SCI-PAPERS', hasDropdown: false, path: '/sci-papers', icon: FileText },
  { name: 'UGC-CARE', hasDropdown: false, path: '/ugc-care', icon: BookMarked },
  { name: 'AWARDS', hasDropdown: false, path: '/awards', icon: Award },
  { name: 'PROJECTS', hasDropdown: false, path: '/research-projects', icon: FolderKanban },
  { name: 'PATENTS', hasDropdown: false, path: '/patents', icon: Lightbulb },
  { name: 'DOWNLOADS', hasDropdown: false, path: '/downloads', icon: Download },
  { name: 'CONTACT US', hasDropdown: false, path: '/contact-us', icon: Phone },
  { name: 'QUERY /COMPLAINT', hasDropdown: false, path: '/query-complaint', icon: MessageSquare },
  { name: 'VIVA SCHEDULE', hasDropdown: false, path: '/viva-schedules', icon: Calendar },
  { name: 'RDC SCHEDULE', hasDropdown: false, path: '/rdc-schedules', icon: ClipboardCheck }
];

export default menuItems;

