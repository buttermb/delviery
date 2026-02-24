/**
 * Sound Alerts Service
 * Provides audio notifications for various events like new orders, messages, etc.
 */

import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Sound file paths (relative to public directory)
const SOUND_FILES = {
    newOrder: '/sounds/new-order.mp3',
    orderReady: '/sounds/order-ready.mp3',
    newMessage: '/sounds/new-message.mp3',
    alert: '/sounds/alert.mp3',
    success: '/sounds/success.mp3',
    error: '/sounds/error.mp3',
} as const;

type SoundType = keyof typeof SOUND_FILES;

interface SoundAlertOptions {
    volume?: number; // 0-1
    loop?: boolean;
    vibrate?: boolean; // Only on mobile
}

// State
let audioContext: AudioContext | null = null;
let audioEnabled = true;
let defaultVolume = 0.7;
const audioCache: Map<string, AudioBuffer> = new Map();

/**
 * Initialize the audio context (should be called after user interaction)
 */
export function initAudio(): void {
    if (audioContext) return;

    try {
        audioContext = new (window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext!)();
    } catch (error) {
        logger.warn('Web Audio API not supported', error);
    }
}

/**
 * Preload sounds for faster playback
 */
export async function preloadSounds(sounds: SoundType[] = Object.keys(SOUND_FILES) as SoundType[]): Promise<void> {
    if (!audioContext) initAudio();
    if (!audioContext) return;

    const loadPromises = sounds.map(async (soundType) => {
        const url = SOUND_FILES[soundType];
        if (audioCache.has(url)) return;

        try {
            const response = await fetch(url);
            if (!response.ok) return;

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext!.decodeAudioData(arrayBuffer);
            audioCache.set(url, audioBuffer);
        } catch (error) {
            logger.warn(`Failed to preload sound ${soundType}`, error);
        }
    });

    await Promise.all(loadPromises);
}

/**
 * Play a sound alert
 */
export async function playSound(
    type: SoundType,
    options: SoundAlertOptions = {}
): Promise<void> {
    if (!audioEnabled) return;

    const {
        volume = defaultVolume,
        loop = false,
        vibrate = true,
    } = options;

    // Vibrate on mobile if supported
    if (vibrate && Capacitor.isNativePlatform()) {
        try {
            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
            await Haptics.impact({ style: ImpactStyle.Medium });
        } catch {
            // Haptics not available
        }
    } else if (vibrate && 'vibrate' in navigator) {
        navigator.vibrate(100);
    }

    // Try Web Audio API first
    if (audioContext) {
        const url = SOUND_FILES[type];

        // Check cache
        let buffer = audioCache.get(url);

        if (!buffer) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Sound not found');

                const arrayBuffer = await response.arrayBuffer();
                buffer = await audioContext.decodeAudioData(arrayBuffer);
                audioCache.set(url, buffer);
            } catch (error) {
                logger.warn(`Failed to load sound ${type}`, error);
                fallbackPlay(type, volume);
                return;
            }
        }

        try {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.loop = loop;

            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume;

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            source.start(0);
            return;
        } catch (error) {
            logger.warn('Web Audio playback failed', error);
        }
    }

    // Fallback to HTML5 Audio
    fallbackPlay(type, volume);
}

/**
 * Fallback to HTML5 Audio element
 */
function fallbackPlay(type: SoundType, volume: number): void {
    try {
        const audio = new Audio(SOUND_FILES[type]);
        audio.volume = volume;
        audio.play().catch((error) => {
            logger.warn('Audio playback failed', error);
        });
    } catch (error) {
        logger.warn('Failed to create audio element', error);
    }
}

/**
 * Play new order notification
 */
export function playNewOrderSound(options?: SoundAlertOptions): Promise<void> {
    return playSound('newOrder', { vibrate: true, ...options });
}

/**
 * Play order ready notification
 */
export function playOrderReadySound(options?: SoundAlertOptions): Promise<void> {
    return playSound('orderReady', options);
}

/**
 * Play new message notification
 */
export function playNewMessageSound(options?: SoundAlertOptions): Promise<void> {
    return playSound('newMessage', { volume: 0.5, ...options });
}

/**
 * Play success sound
 */
export function playSuccessSound(options?: SoundAlertOptions): Promise<void> {
    return playSound('success', { volume: 0.5, vibrate: false, ...options });
}

/**
 * Play error sound
 */
export function playErrorSound(options?: SoundAlertOptions): Promise<void> {
    return playSound('error', { volume: 0.5, vibrate: true, ...options });
}

/**
 * Enable/disable all sounds
 */
export function setSoundEnabled(enabled: boolean): void {
    audioEnabled = enabled;
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SOUND_ALERTS_ENABLED, String(enabled));
    }
}

/**
 * Check if sounds are enabled
 */
export function isSoundEnabled(): boolean {
    return audioEnabled;
}

/**
 * Set default volume (0-1)
 */
export function setDefaultVolume(volume: number): void {
    defaultVolume = Math.max(0, Math.min(1, volume));
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SOUND_ALERTS_VOLUME, String(defaultVolume));
    }
}

/**
 * Get current default volume
 */
export function getDefaultVolume(): number {
    return defaultVolume;
}

/**
 * Load saved preferences
 */
export function loadSoundPreferences(): void {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ALERTS_ENABLED);
    if (saved !== null) {
        audioEnabled = saved === 'true';
    }

    const savedVolume = localStorage.getItem(STORAGE_KEYS.SOUND_ALERTS_VOLUME);
    if (savedVolume !== null) {
        defaultVolume = parseFloat(savedVolume);
    }
}

// Initialize on load
if (typeof window !== 'undefined') {
    loadSoundPreferences();
}

/**
 * React hook for sound alerts
 */
import { useState, useCallback, useEffect } from 'react';

export interface UseSoundAlertsReturn {
    isEnabled: boolean;
    volume: number;
    toggleEnabled: () => void;
    setEnabled: (enabled: boolean) => void;
    setVolume: (volume: number) => void;
    playNewOrder: () => Promise<void>;
    playOrderReady: () => Promise<void>;
    playMessage: () => Promise<void>;
    playSuccess: () => Promise<void>;
    playError: () => Promise<void>;
}

export function useSoundAlerts(): UseSoundAlertsReturn {
    const [isEnabled, setIsEnabled] = useState(audioEnabled);
    const [volume, setVolumeState] = useState(defaultVolume);

    // Sync with global state
    useEffect(() => {
        const interval = setInterval(() => {
            setIsEnabled(audioEnabled);
            setVolumeState(defaultVolume);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const toggleEnabled = useCallback(() => {
        const newValue = !isEnabled;
        setIsEnabled(newValue);
        setSoundEnabled(newValue);
    }, [isEnabled]);

    const setEnabled = useCallback((enabled: boolean) => {
        setIsEnabled(enabled);
        setSoundEnabled(enabled);
    }, []);

    const setVolume = useCallback((vol: number) => {
        setVolumeState(vol);
        setDefaultVolume(vol);
    }, []);

    const playNewOrder = useCallback(() => playNewOrderSound(), []);
    const playOrderReady = useCallback(() => playOrderReadySound(), []);
    const playMessage = useCallback(() => playNewMessageSound(), []);
    const playSuccess = useCallback(() => playSuccessSound(), []);
    const playError = useCallback(() => playErrorSound(), []);

    return {
        isEnabled,
        volume,
        toggleEnabled,
        setEnabled,
        setVolume,
        playNewOrder,
        playOrderReady,
        playMessage,
        playSuccess,
        playError,
    };
}
