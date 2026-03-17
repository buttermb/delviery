import { Database } from "lucide-react";
import { ComingSoonPlaceholder } from "@/components/shared/ComingSoonPlaceholder";

export function DataBackupSettings() {
  return (
    <ComingSoonPlaceholder
      title="Data Backup & Export"
      description="Schedule automatic backups and export all your data on demand."
      icon={Database}
    />
  );
}
