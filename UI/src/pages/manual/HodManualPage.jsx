import ManualDeck from './ManualDeck';
import { hodManual } from './hodManualData';

export default function HodManualPage() {
  return (
    <ManualDeck
      manual={hodManual}
      otherManualLink="/manual/faculty"
      otherManualLabel="Faculty Manual"
    />
  );
}
