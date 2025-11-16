// Enhanced notification sound system with vibration support
type SoundType = 'notification' | 'success' | 'urgent';

// Vibration patterns for different events
const VIBRATION_PATTERNS = {
  notification: [100, 50, 100], // Double tap
  success: [200, 100, 200], // Long double tap
  urgent: [200, 100, 200, 100, 200], // Triple tap
};

// Play sound with vibration
const playWithVibration = (soundType: SoundType, enableVibration = true) => {
  // Vibrate on mobile devices
  if (enableVibration && 'vibrate' in navigator) {
    try {
      navigator.vibrate(VIBRATION_PATTERNS[soundType]);
    } catch (error) {
      console.error('Vibration error:', error);
    }
  }
};

// Generate notification sound using HTML5 audio (doesn't trigger microphone icon on iOS)
export const playNotificationSound = (vibrate = true) => {
  try {
    // Use HTML5 audio instead of Web Audio API
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGmi78N+oVRQLUKbh8LJeHAU7k9bxy3crc');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play failed:', e));
    
    // Vibrate
    playWithVibration('notification', vibrate);
    
    console.log('🔔 Notification sound played');
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

// Play success sound using HTML5 audio (doesn't trigger microphone icon on iOS)
export const playSuccessSound = (vibrate = true) => {
  try {
    // Play first beep
    const audio1 = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGmi78N+oVRQLUKbh8LJeHAU7k9bxy3crc');
    audio1.volume = 0.3;
    audio1.play().catch(e => console.log('Audio play failed:', e));
    
    // Play second beep after delay
    setTimeout(() => {
      const audio2 = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGmi78N+oVRQLUKbh8LJeHAU7k9bxy3crc');
      audio2.volume = 0.3;
      audio2.play().catch(e => console.log('Audio play failed:', e));
    }, 200);
    
    // Vibrate
    playWithVibration('success', vibrate);
    
    console.log('✅ Success sound played');
  } catch (error) {
    console.error('Error playing success sound:', error);
  }
};

// Play urgent alert sound using HTML5 audio (doesn't trigger microphone icon on iOS)
export const playUrgentSound = (vibrate = true) => {
  try {
    // Play first urgent beep
    const audio1 = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGmi78N+oVRQLUKbh8LJeHAU7k9bxy3crc');
    audio1.volume = 0.4;
    audio1.play().catch(e => console.log('Audio play failed:', e));
    
    // Play second urgent beep after short pause
    setTimeout(() => {
      const audio2 = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGmi78N+oVRQLUKbh8LJeHAU7k9bxy3crc');
      audio2.volume = 0.4;
      audio2.play().catch(e => console.log('Audio play failed:', e));
    }, 300);
    
    // Vibrate with urgent pattern
    playWithVibration('urgent', vibrate);
    
    console.log('🚨 Urgent sound played');
  } catch (error) {
    console.error('Error playing urgent sound:', error);
  }
};
