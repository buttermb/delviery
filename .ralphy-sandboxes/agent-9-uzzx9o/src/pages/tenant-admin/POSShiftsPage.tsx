import { ShiftManager } from '@/components/pos/ShiftManager';

export default function POSShiftsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">POS Shift Management</h1>
        <p className="text-muted-foreground">Manage cash register shifts and end-of-day reports</p>
      </div>
      <ShiftManager />
    </div>
  );
}
