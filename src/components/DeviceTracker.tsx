import { useDeviceTracking } from "@/hooks/useDeviceTracking";
import { useSuspiciousLoginDetection } from "@/hooks/useSuspiciousLoginDetection";

export function DeviceTracker() {
  useDeviceTracking();
  useSuspiciousLoginDetection();
  return null;
}