/**
 * UpdateBanner Component
 * Shows when a new version of the PWA is available
 * Allows user to reload and activate the new service worker
 */

import React, { useState, useEffect } from 'react';
import X from "lucide-react/dist/esm/icons/x";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { triggerHaptic } from '@/lib/utils/mobile';

interface UpdateBannerProps {
    /** Force show the banner (for testing) */
    forceShow?: boolean;
    /** Callback when user clicks update */
    onUpdate?: () => void;
    /** Callback when user dismisses */
    onDismiss?: () => void;
    /** Additional className */
    className?: string;
}

export function UpdateBanner({
    forceShow = false,
    onUpdate,
    onDismiss,
    className,
}: UpdateBannerProps) {
    const [updateAvailable, setUpdateAvailable] = useState(forceShow);
    const [isUpdating, setIsUpdating] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const checkForUpdate = async () => {
            try {
                const registration = await navigator.serviceWorker.ready;

                // Check if there's a waiting service worker
                if (registration.waiting) {
                    setUpdateAvailable(true);
                    return;
                }

                // Listen for new service workers
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            setUpdateAvailable(true);
                            triggerHaptic('light');
                        }
                    });
                });

                // Also listen for controller change (another tab updated)
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    // Reload automatically when the new SW takes control
                    window.location.reload();
                });
            } catch (error) {
                logger.error('Error checking for updates', error);
            }
        };

        checkForUpdate();
    }, []);

    const handleUpdate = async () => {
        setIsUpdating(true);
        triggerHaptic('medium');

        try {
            const registration = await navigator.serviceWorker.ready;

            if (registration.waiting) {
                // Tell the waiting service worker to skip waiting
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            onUpdate?.();

            // The controllerchange event will trigger reload
            // But fallback reload after 2 seconds if it doesn't
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            logger.error('Error updating', error);
            setIsUpdating(false);
            // Fallback: just reload
            window.location.reload();
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        triggerHaptic('light');
        onDismiss?.();
    };

    if (!updateAvailable || dismissed) {
        return null;
    }

    return (
        <div
            className={cn(
                'fixed bottom-20 left-4 right-4 z-50',
                'bg-primary text-primary-foreground rounded-lg shadow-lg',
                'p-4 flex items-center gap-3',
                'animate-in slide-in-from-bottom-4 fade-in duration-300',
                'lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm',
                className
            )}
            role="alert"
            aria-live="polite"
        >
            <Sparkles className="h-5 w-5 flex-shrink-0" />

            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Update available</p>
                <p className="text-xs opacity-90">
                    Tap to get the latest features
                </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="h-8 px-3"
                >
                    {isUpdating ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                        'Update'
                    )}
                </Button>

                <button
                    onClick={handleDismiss}
                    className="p-1 hover:bg-primary-foreground/10 rounded"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

export default UpdateBanner;
