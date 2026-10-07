import ManualDeck from './ManualDeck';
import { facultyManual } from './facultyManualData';

export default function FacultyManualPage() {
  return (
    <ManualDeck
      manual={facultyManual}
      otherManualLink="/manual/hod"
      otherManualLabel="HOD Manual"
    />
  );
}
