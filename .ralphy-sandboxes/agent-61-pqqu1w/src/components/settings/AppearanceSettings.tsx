import { Sun, Moon, Monitor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    value: "light" as const,
    label: "Light",
    description: "A clean, bright interface",
    icon: Sun,
  },
  {
    value: "dark" as const,
    label: "Dark",
    description: "Easier on the eyes in low light",
    icon: Moon,
  },
  {
    value: "system" as const,
    label: "System",
    description: "Matches your OS preference",
    icon: Monitor,
  },
];

export function AppearanceSettings() {
  const { mode, theme, setMode } = useTheme();

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1">Appearance</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Choose how the admin panel looks to you.{" "}
        {mode === "system" && (
          <span className="text-xs">
            Currently using <strong>{theme}</strong> based on your system settings.
          </span>
        )}
      </p>

      <div>
        <Label className="text-sm font-medium mb-3 block">Theme</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = mode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                  "hover:bg-accent/10",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                )}
              >
                <Icon className={cn(
                  "h-6 w-6",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  isActive ? "text-primary" : "text-foreground"
                )}>
                  {option.label}
                </span>
                <span className="text-xs text-muted-foreground text-center">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
