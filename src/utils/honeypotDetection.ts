// Honeypot detection for identifying automated attacks

export interface HoneypotResult {
  triggered: boolean;
  type: 'form_field' | 'timing' | 'behavior' | 'mouse_movement';
  details: Record<string, any>;
}

/**
 * Create invisible honeypot form fields
 */
export const createHoneypotField = (): HTMLInputElement => {
  const field = document.createElement('input');
  field.type = 'text';
  field.name = 'website'; // Common bot target
  field.tabIndex = -1;
  field.autocomplete = 'off';
  field.style.cssText = `
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  `;
  return field;
};

/**
 * Check if honeypot field was filled
 */
export const checkHoneypotField = (fieldValue: string): HoneypotResult => {
  if (fieldValue && fieldValue.length > 0) {
    return {
      triggered: true,
      type: 'form_field',
      details: {
        message: 'Honeypot field was filled',
        value_length: fieldValue.length
      }
    };
  }
  return {
    triggered: false,
    type: 'form_field',
    details: {}
  };
};

/**
 * Monitor form submission timing (too fast = bot)
 */
export const createTimingMonitor = () => {
  const startTime = Date.now();
  
  return (): HoneypotResult => {
    const elapsed = Date.now() - startTime;
    const MIN_HUMAN_TIME = 2000; // 2 seconds
    
    if (elapsed < MIN_HUMAN_TIME) {
      return {
        triggered: true,
        type: 'timing',
        details: {
          message: 'Form submitted too quickly',
          elapsed_ms: elapsed,
          threshold_ms: MIN_HUMAN_TIME
        }
      };
    }
    
    return {
      triggered: false,
      type: 'timing',
      details: { elapsed_ms: elapsed }
    };
  };
};

/**
 * Monitor mouse movement (no movement = bot)
 */
export const createMouseMonitor = () => {
  let movements = 0;
  let lastX = 0;
  let lastY = 0;
  
  const handleMouseMove = (e: MouseEvent) => {
    const dx = Math.abs(e.clientX - lastX);
    const dy = Math.abs(e.clientY - lastY);
    
    if (dx > 5 || dy > 5) {
      movements++;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  
  const check = (): HoneypotResult => {
    document.removeEventListener('mousemove', handleMouseMove);
    
    if (movements < 3) {
      return {
        triggered: true,
        type: 'mouse_movement',
        details: {
          message: 'Insufficient mouse movement detected',
          movements
        }
      };
    }
    
    return {
      triggered: false,
      type: 'mouse_movement',
      details: { movements }
    };
  };
  
  return { check, cleanup: () => document.removeEventListener('mousemove', handleMouseMove) };
};

/**
 * Behavioral analysis
 */
export const analyzeBehavior = (interactions: {
  keystrokes?: number;
  clicks?: number;
  scrolls?: number;
  focus_events?: number;
}): HoneypotResult => {
  const totalInteractions = 
    (interactions.keystrokes || 0) +
    (interactions.clicks || 0) +
    (interactions.scrolls || 0) +
    (interactions.focus_events || 0);
  
  if (totalInteractions === 0) {
    return {
      triggered: true,
      type: 'behavior',
      details: {
        message: 'No user interactions detected',
        ...interactions
      }
    };
  }
  
  // Check for bot-like patterns (e.g., only clicks, no typing)
  if (interactions.clicks && interactions.clicks > 5 && !interactions.keystrokes) {
    return {
      triggered: true,
      type: 'behavior',
      details: {
        message: 'Suspicious interaction pattern',
        ...interactions
      }
    };
  }
  
  return {
    triggered: false,
    type: 'behavior',
    details: interactions
  };
};

/**
 * Initialize comprehensive honeypot system
 */
export const initHoneypotSystem = (formElement: HTMLFormElement) => {
  const results: HoneypotResult[] = [];
  
  // Add honeypot field
  const honeypotField = createHoneypotField();
  formElement.appendChild(honeypotField);
  
  // Start timing monitor
  const timingCheck = createTimingMonitor();
  
  // Start mouse monitor
  const mouseMonitor = createMouseMonitor();
  
  // Track interactions
  const interactions = {
    keystrokes: 0,
    clicks: 0,
    scrolls: 0,
    focus_events: 0
  };
  
  const handleKeydown = () => interactions.keystrokes++;
  const handleClick = () => interactions.clicks++;
  const handleScroll = () => interactions.scrolls++;
  const handleFocus = () => interactions.focus_events++;
  
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleClick);
  document.addEventListener('scroll', handleScroll);
  formElement.addEventListener('focusin', handleFocus);
  
  return {
    validate: (): HoneypotResult[] => {
      // Check honeypot field
      results.push(checkHoneypotField(honeypotField.value));
      
      // Check timing
      results.push(timingCheck());
      
      // Check mouse movement
      results.push(mouseMonitor.check());
      
      // Check behavior
      results.push(analyzeBehavior(interactions));
      
      return results;
    },
    cleanup: () => {
      honeypotField.remove();
      mouseMonitor.cleanup();
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll);
      formElement.removeEventListener('focusin', handleFocus);
    },
    isBot: (): boolean => {
      const validationResults = results.length > 0 ? results : [];
      return validationResults.some(r => r.triggered);
    }
  };
};
