/**
 * AdminMultiTabDetector
 *
 * Detects when the same admin session is open in multiple browser tabs
 * using the BroadcastChannel API. Shows a warning banner when a duplicate
 * tab is detected, with a "Continue Here" button to claim the active session.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import { AlertTriangle, Monitor } from 'lucide-react';

import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

const CHANNEL_NAME = 'floraiq-admin-tab';
const HEARTBEAT_INTERVAL = 3000;

interface TabMessage {
  type: 'heartbeat' | 'claim';
  tabId: string;
}

function generateTabId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

interface Props {
  children: React.ReactNode;
}

export function AdminMultiTabDetector({ children }: Props) {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const tabIdRef = useRef(generateTabId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // BroadcastChannel may not be available in all environments
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const msg = event.data;
      if (msg.tabId === tabIdRef.current) return;

      if (msg.type === 'heartbeat') {
        setIsDuplicate(true);
      }

      if (msg.type === 'claim') {
        // Another tab claimed the session — mark this one as duplicate
        setIsDuplicate(true);
      }
    };

    // Send heartbeats so other tabs know we exist
    const sendHeartbeat = () => {
      try {
        channel.postMessage({ type: 'heartbeat', tabId: tabIdRef.current } satisfies TabMessage);
      } catch {
        // Channel may be closed
      }
    };

    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(heartbeatRef.current);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const handleClaim = useCallback(() => {
    logger.info('Admin tab claimed active session', { tabId: tabIdRef.current });

    try {
      channelRef.current?.postMessage({
        type: 'claim',
        tabId: tabIdRef.current,
      } satisfies TabMessage);
    } catch {
      // Channel may be closed
    }

    setIsDuplicate(false);
  }, []);

  return (
    <>
      {isDuplicate && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>This admin session is open in another tab. Edits in multiple tabs may cause conflicts.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClaim}
            className="shrink-0 gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900"
          >
            <Monitor className="h-3.5 w-3.5" />
            Continue Here
          </Button>
        </div>
      )}
      {children}
    </>
  );
}
