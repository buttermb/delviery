import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Volume2, VolumeX, Bell, Play } from 'lucide-react';
import { useSoundAlerts, initAudio, preloadSounds } from '@/lib/soundAlerts';
import { useState, useEffect } from 'react';

interface SoundSettingsProps {
    className?: string;
}

/**
 * Sound Settings Component
 * Allows users to configure sound alert preferences
 */
export function SoundSettings({ className }: SoundSettingsProps) {
    const {
        isEnabled,
        volume,
        toggleEnabled,
        setVolume,
        playNewOrder,
        playSuccess,
    } = useSoundAlerts();

    const [isPreloading, setIsPreloading] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    // Initialize audio on first interaction
    const handleInteraction = () => {
        if (!hasInteracted) {
            initAudio();
            setHasInteracted(true);
        }
    };

    // Preload sounds when enabled
    useEffect(() => {
        if (isEnabled && hasInteracted && !isPreloading) {
            setIsPreloading(true);
            preloadSounds().finally(() => setIsPreloading(false));
        }
    }, [isEnabled, hasInteracted, isPreloading]);

    const handleVolumeChange = (value: number[]) => {
        handleInteraction();
        setVolume(value[0] / 100);
    };

    const handleToggle = () => {
        handleInteraction();
        toggleEnabled();
    };

    const handleTestSound = async () => {
        handleInteraction();
        if (isEnabled) {
            await playSuccess();
        } else {
            // Temporarily enable for test
            await playNewOrder();
        }
    };

    return (
        <Card className={className} onClick={handleInteraction}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Sound Alerts
                </CardTitle>
                <CardDescription>
                    Configure audio notifications for new orders and messages
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="sound-enabled" className="text-base">
                            Enable Sound Alerts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Play sounds for new orders and notifications
                        </p>
                    </div>
                    <Switch
                        id="sound-enabled"
                        checked={isEnabled}
                        onCheckedChange={handleToggle}
                    />
                </div>

                {/* Volume Control */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-base flex items-center gap-2">
                            {volume === 0 ? (
                                <VolumeX className="h-4 w-4" />
                            ) : (
                                <Volume2 className="h-4 w-4" />
                            )}
                            Volume
                        </Label>
                        <span className="text-sm text-muted-foreground">
                            {Math.round(volume * 100)}%
                        </span>
                    </div>
                    <Slider
                        value={[volume * 100]}
                        onValueChange={handleVolumeChange}
                        max={100}
                        step={5}
                        disabled={!isEnabled}
                        className="w-full"
                    />
                </div>

                {/* Test Sound */}
                <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium">Test Sound</p>
                        <p className="text-xs text-muted-foreground">
                            Click to preview the notification sound
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestSound}
                        disabled={!hasInteracted}
                        className="gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Play
                    </Button>
                </div>

                {/* Sound Types */}
                {isEnabled && (
                    <div className="space-y-3 pt-4 border-t">
                        <p className="text-sm font-medium">Notification Types</p>
                        <div className="grid gap-3">
                            <NotificationToggle
                                label="New Orders"
                                description="Alert when a new order comes in"
                                defaultEnabled={true}
                                storageKey="sound-new-order"
                            />
                            <NotificationToggle
                                label="Chat Messages"
                                description="Alert for new customer messages"
                                defaultEnabled={true}
                                storageKey="sound-chat"
                            />
                            <NotificationToggle
                                label="Low Stock Alerts"
                                description="Alert when products are running low"
                                defaultEnabled={false}
                                storageKey="sound-low-stock"
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface NotificationToggleProps {
    label: string;
    description: string;
    defaultEnabled: boolean;
    storageKey: string;
}

function NotificationToggle({
    label,
    description,
    defaultEnabled,
    storageKey,
}: NotificationToggleProps) {
    const [enabled, setEnabled] = useState(() => {
        if (typeof window === 'undefined') return defaultEnabled;
        const stored = localStorage.getItem(storageKey);
        return stored !== null ? stored === 'true' : defaultEnabled;
    });

    const handleChange = (checked: boolean) => {
        setEnabled(checked);
        localStorage.setItem(storageKey, String(checked));
    };

    return (
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
                checked={enabled}
                onCheckedChange={handleChange}
                aria-label={label}
            />
        </div>
    );
}

export default SoundSettings;
