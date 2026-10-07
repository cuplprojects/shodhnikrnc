import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search, 
  Users, 
  FileText, 
  Briefcase, 
  AlertCircle 
} from 'lucide-react';

export const iconMapper = {
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Users,
  FileText,
  Briefcase,
  AlertCircle
};

export const getIconComponent = (iconName) => {
  return iconMapper[iconName] || null;
};
