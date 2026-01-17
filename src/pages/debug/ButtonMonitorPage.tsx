/**
 * Button Monitor Debug Page
 * Accessible at /debug/button-monitor
 */

import { ButtonHealthPanel } from '@/components/debug/ButtonHealthPanel';

export default function ButtonMonitorPage() {
  return (
    <div className="min-h-dvh bg-background">
      <ButtonHealthPanel />
    </div>
  );
}

