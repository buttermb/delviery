import { logSuspiciousActivity, burnMenu } from '@/lib/security/auto-burn';

export interface ScreenshotProtectionConfig {
    menuId?: string;
    autoBurnEnabled?: boolean;
    burnType?: 'soft' | 'hard';
    screenshotThreshold?: number;
}

export class ScreenshotProtection {
    private static instance: ScreenshotProtection;
    private isMonitoring = false;
    private onSuspiciousActivity: ((type: string) => void) | null = null;
    private config: ScreenshotProtectionConfig = {};
    private screenshotCount = 0;

    private constructor() { }

    static getInstance(): ScreenshotProtection {
        if (!ScreenshotProtection.instance) {
            ScreenshotProtection.instance = new ScreenshotProtection();
        }
        return ScreenshotProtection.instance;
    }

    /**
     * Configure auto-burn settings for screenshot detection
     */
    configure(config: ScreenshotProtectionConfig) {
        this.config = { ...this.config, ...config };
    }

    init(onSuspiciousActivity: (type: string) => void) {
        this.onSuspiciousActivity = onSuspiciousActivity;
        if (!this.isMonitoring) {
            this.startMonitoring();
            this.isMonitoring = true;
        }
    }

    // Invisible watermark with customer ID
    embedWatermark(customerId: string, canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const binaryId = this.stringToBinary(customerId);

        // Embed in LSB of pixels
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Simple LSB steganography - embed bits in the alpha channel or blue channel
        // For robustness, we'll just modify the blue channel's LSB for the first N pixels
        for (let i = 0; i < binaryId.length; i++) {
            if (i * 4 + 2 < imageData.data.length) {
                const bit = parseInt(binaryId[i]);
                // Clear LSB and set it to our bit
                imageData.data[i * 4 + 2] = (imageData.data[i * 4 + 2] & 0xFE) | bit;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    private stringToBinary(input: string): string {
        return input.split('').map(char => {
            return char.charCodeAt(0).toString(2).padStart(8, '0');
        }).join('');
    }

    // Detect screenshot attempts
    private startMonitoring() {
        // Method 1: Visibility API
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Often triggered when switching apps to take a screenshot or screen recording
                // We can log this as a potential risk, but maybe not a definitive breach
                // this.logSuspiciousActivity('visibility_changed');
            }
        });

        // Method 2: Clipboard API monitoring
        // Note: This requires permissions and might not work in all contexts
        document.addEventListener('copy', (e) => {
            // Prevent copying text/images if possible
            e.preventDefault();
            this.logSuspiciousActivity('clipboard_copy_attempt');
        });

        // Method 3: Print detection
        window.addEventListener('beforeprint', () => {
            this.logSuspiciousActivity('print_attempt');
            // Try to hide content
            document.body.style.display = 'none';
        });

        window.addEventListener('afterprint', () => {
            document.body.style.display = '';
        });

        // Method 4: DevTools detection
        // This is a heuristic and can be flaky
        const checkDevTools = () => {
            const threshold = 160;
            if (
                window.outerWidth - window.innerWidth > threshold ||
                window.outerHeight - window.innerHeight > threshold
            ) {
                this.logSuspiciousActivity('devtools_open');
            }
        };

        setInterval(checkDevTools, 1000);

        // Method 5: Key press detection (PrintScreen)
        window.addEventListener('keyup', (e) => {
            if (e.key === 'PrintScreen') {
                this.logSuspiciousActivity('print_screen_key');
                // Clear clipboard if possible
                navigator.clipboard.writeText('');
            }
        });
    }

    private logSuspiciousActivity(type: string) {
        if (this.onSuspiciousActivity) {
            this.onSuspiciousActivity(type);
        }

        // Integrate with auto-burn system
        const { menuId, autoBurnEnabled, burnType, screenshotThreshold } = this.config;

        if (menuId) {
            // Log to database via auto-burn module
            logSuspiciousActivity(menuId, type);

            // Check if this is a screenshot-related event that should trigger burn
            const screenshotEvents = ['print_screen_key', 'clipboard_copy_attempt', 'print_attempt'];
            if (autoBurnEnabled && screenshotEvents.includes(type)) {
                this.screenshotCount++;
                const threshold = screenshotThreshold ?? 1;

                if (this.screenshotCount >= threshold) {
                    burnMenu(menuId, `screenshot_detected:${type}`, burnType || 'soft');
                }
            }
        }
    }
}
