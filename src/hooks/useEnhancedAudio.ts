import { useEffect, useRef, useState } from 'react';

export const useEnhancedAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Initialize audio context
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!isEnabled || !audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContextRef.current.currentTime + duration / 1000
    );

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  };

  const playNewOrderSound = () => {
    // Upbeat notification tone
    playTone(523.25, 150); // C5
    setTimeout(() => playTone(659.25, 150), 150); // E5
    setTimeout(() => playTone(783.99, 300), 300); // G5
  };

  const playSuccessSound = () => {
    // Success chime
    playTone(523.25, 100);
    setTimeout(() => playTone(659.25, 100), 100);
    setTimeout(() => playTone(783.99, 200), 200);
  };

  const playWarningSound = () => {
    // Attention tone
    playTone(440, 200, 'square');
    setTimeout(() => playTone(440, 200, 'square'), 250);
  };

  const playEarningsSound = () => {
    // Cash register sound simulation
    playTone(1046.50, 50); // C6
    setTimeout(() => playTone(1318.51, 50), 50); // E6
    setTimeout(() => playTone(1567.98, 150), 100); // G6
  };

  const playNavigationTick = () => {
    // Short tick for turn-by-turn
    playTone(800, 50, 'square');
  };

  const toggleAudio = () => {
    setIsEnabled(!isEnabled);
  };

  return {
    playNewOrderSound,
    playSuccessSound,
    playWarningSound,
    playEarningsSound,
    playNavigationTick,
    toggleAudio,
    isEnabled
  };
};