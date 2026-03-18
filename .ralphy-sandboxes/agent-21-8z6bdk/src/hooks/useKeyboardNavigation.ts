import { useCallback, useEffect, useRef } from 'react';

/**
 * Keyboard Navigation Hook
 *
 * Provides comprehensive keyboard navigation support for forms and interactive components:
 * - Enter key to submit forms
 * - Escape key to cancel/close
 * - Tab order management
 * - Focus trap for modals
 * - Arrow key navigation for lists
 */

export interface KeyboardNavigationOptions {
  /** Called when Enter key is pressed (outside of textareas) */
  onEnter?: () => void;
  /** Called when Escape key is pressed */
  onEscape?: () => void;
  /** Called when Tab key navigates out of container (for focus trap) */
  onTabOut?: () => void;
  /** Enable focus trap (prevents tabbing out of container) */
  trapFocus?: boolean;
  /** Enable arrow key navigation for list items */
  enableArrowNavigation?: boolean;
  /** Called when arrow down is pressed */
  onArrowDown?: () => void;
  /** Called when arrow up is pressed */
  onArrowUp?: () => void;
  /** Whether the navigation is currently enabled */
  enabled?: boolean;
}

/**
 * Hook for handling common keyboard navigation patterns
 *
 * @example
 * ```tsx
 * // Basic form with Enter to submit
 * useKeyboardNavigation({
 *   onEnter: () => form.handleSubmit(onSubmit)(),
 *   onEscape: () => setIsOpen(false),
 * });
 *
 * // Modal with focus trap
 * const containerRef = useKeyboardNavigation({
 *   trapFocus: true,
 *   onEscape: () => setIsOpen(false),
 * });
 * ```
 */
export function useKeyboardNavigation<T extends HTMLElement = HTMLDivElement>(
  options: KeyboardNavigationOptions = {}
) {
  const {
    onEnter,
    onEscape,
    onTabOut,
    trapFocus = false,
    enableArrowNavigation = false,
    onArrowDown,
    onArrowUp,
    enabled = true,
  } = options;

  const containerRef = useRef<T>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isTextarea = target.tagName === 'TEXTAREA';
      const isContentEditable = target.isContentEditable;

      switch (e.key) {
        case 'Enter':
          // Don't trigger submit for textareas (allow normal Enter behavior)
          // Also allow Shift+Enter for multi-line in regular inputs
          if (!isTextarea && !isContentEditable && !e.shiftKey && onEnter) {
            // Only if we're in a form context or the container
            const container = containerRef.current;
            if (container && container.contains(target)) {
              // Prevent default form submission to handle it ourselves
              e.preventDefault();
              onEnter();
            }
          }
          break;

        case 'Escape':
          if (onEscape) {
            e.preventDefault();
            onEscape();
          }
          break;

        case 'Tab':
          if (trapFocus && containerRef.current) {
            handleFocusTrap(e, containerRef.current);
          }
          if (onTabOut && !containerRef.current?.contains(e.target as Node)) {
            onTabOut();
          }
          break;

        case 'ArrowDown':
          if (enableArrowNavigation && onArrowDown && !isInInput) {
            e.preventDefault();
            onArrowDown();
          }
          break;

        case 'ArrowUp':
          if (enableArrowNavigation && onArrowUp && !isInInput) {
            e.preventDefault();
            onArrowUp();
          }
          break;
      }
    },
    [enabled, onEnter, onEscape, onTabOut, trapFocus, enableArrowNavigation, onArrowDown, onArrowUp]
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown as EventListener);
      return () => container.removeEventListener('keydown', handleKeyDown as EventListener);
    } else {
      // If no container ref, listen on document
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);

  return containerRef;
}

/**
 * Handle focus trap within a container
 * Keeps focus cycling within the container when Tab/Shift+Tab is pressed
 */
function handleFocusTrap(e: KeyboardEvent, container: HTMLElement) {
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (e.shiftKey) {
    // Shift + Tab: if on first element, go to last
    if (activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab: if on last element, go to first
    if (activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
    (el) => {
      // Filter out hidden elements
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
  );
}

/**
 * Focus the first focusable element in a container
 */
export function focusFirstElement(container: HTMLElement | null): boolean {
  if (!container) return false;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
    return true;
  }
  return false;
}

/**
 * Focus a specific element by selector within a container
 */
export function focusElement(
  container: HTMLElement | null,
  selector: string
): boolean {
  if (!container) return false;

  const element = container.querySelector<HTMLElement>(selector);
  if (element && !element.hasAttribute('disabled')) {
    element.focus();
    return true;
  }
  return false;
}

/**
 * Hook for managing initial focus when a component mounts
 *
 * @example
 * ```tsx
 * // Focus first input when dialog opens
 * useInitialFocus(dialogRef, isOpen);
 * ```
 */
export function useInitialFocus(
  containerRef: React.RefObject<HTMLElement | null>,
  shouldFocus: boolean = true,
  selector?: string
) {
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (shouldFocus && containerRef.current) {
      // Store the previously focused element for restoration
      previousActiveElement.current = document.activeElement;

      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        if (selector) {
          focusElement(containerRef.current, selector);
        } else {
          focusFirstElement(containerRef.current);
        }
      });
    }

    return () => {
      // Restore focus when unmounting
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [shouldFocus, containerRef, selector]);
}

/**
 * Hook for Enter key submission on specific input
 *
 * @example
 * ```tsx
 * const handleKeyDown = useEnterSubmit(handleSubmit);
 * <Input onKeyDown={handleKeyDown} />
 * ```
 */
export function useEnterSubmit(onSubmit: () => void, enabled: boolean = true) {
  return useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        // Don't submit from textareas (allow multi-line)
        if (target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onSubmit();
        }
      }
    },
    [onSubmit, enabled]
  );
}

/**
 * Hook for tab order management
 * Returns props to spread on elements for proper tab order
 *
 * @example
 * ```tsx
 * const { getTabProps } = useTabOrder(['email', 'password', 'submit']);
 * <Input {...getTabProps('email')} />
 * <Input {...getTabProps('password')} />
 * <Button {...getTabProps('submit')} />
 * ```
 */
export function useTabOrder(order: string[]) {
  const getTabProps = useCallback(
    (id: string) => {
      const index = order.indexOf(id);
      if (index === -1) return {};

      return {
        tabIndex: 0, // All items are tabbable
        'data-tab-order': index + 1,
      };
    },
    [order]
  );

  return { getTabProps };
}
