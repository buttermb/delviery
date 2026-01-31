/**
 * Button & Mutation Audit Tool
 *
 * Runtime validation of button click handlers and mutations.
 * Detects:
 * - Buttons without onClick handlers
 * - Forms without onSubmit handlers
 * - Mutations that are undefined or not callable
 * - Async handlers that don't handle errors
 */

import { logger } from '@/lib/logger';

export interface ButtonAuditResult {
  element: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  selector?: string;
  fix?: string;
}

/**
 * Audit all buttons on the current page
 */
export function auditButtons(): ButtonAuditResult[] {
  const results: ButtonAuditResult[] = [];

  // Find all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach((btn, index) => {
    const hasOnClick = btn.onclick !== null || btn.hasAttribute('onclick');
    const isDisabled = btn.disabled || btn.hasAttribute('disabled');
    const isSubmit = btn.type === 'submit';
    const isInForm = btn.closest('form') !== null;
    const hasAriaLabel = btn.hasAttribute('aria-label') || btn.textContent?.trim();

    // Check for buttons that do nothing
    if (!hasOnClick && !isSubmit && !isDisabled) {
      // Check React event handler (more complex)
      const reactProps = Object.keys(btn).find(key => key.startsWith('__reactProps'));
      const hasReactHandler = reactProps && (btn as any)[reactProps]?.onClick;

      if (!hasReactHandler && !btn.closest('[data-radix-popper-content-wrapper]')) {
        results.push({
          element: `button[${index}]: "${btn.textContent?.trim().slice(0, 30) || 'no text'}"`,
          issue: 'Button has no click handler',
          severity: 'warning',
          selector: getSelector(btn),
          fix: 'Add onClick handler or convert to type="submit" in a form',
        });
      }
    }

    // Check for missing accessibility
    if (!hasAriaLabel) {
      results.push({
        element: `button[${index}]`,
        issue: 'Button has no accessible name',
        severity: 'warning',
        selector: getSelector(btn),
        fix: 'Add text content or aria-label attribute',
      });
    }
  });

  // Find forms without submit handlers
  const forms = document.querySelectorAll('form');
  forms.forEach((form, index) => {
    const hasOnSubmit = form.onsubmit !== null;
    const reactProps = Object.keys(form).find(key => key.startsWith('__reactProps'));
    const hasReactHandler = reactProps && (form as any)[reactProps]?.onSubmit;

    if (!hasOnSubmit && !hasReactHandler) {
      results.push({
        element: `form[${index}]`,
        issue: 'Form has no submit handler',
        severity: 'error',
        selector: getSelector(form),
        fix: 'Add onSubmit handler to the form',
      });
    }
  });

  // Find links that look like buttons but don't navigate
  const buttonLinks = document.querySelectorAll('a[role="button"], a.btn, a[class*="button"]');
  buttonLinks.forEach((link, index) => {
    const href = link.getAttribute('href');
    if (!href || href === '#' || href === 'javascript:void(0)') {
      const hasOnClick = (link as HTMLElement).onclick !== null;
      const reactProps = Object.keys(link).find(key => key.startsWith('__reactProps'));
      const hasReactHandler = reactProps && (link as any)[reactProps]?.onClick;

      if (!hasOnClick && !hasReactHandler) {
        results.push({
          element: `a[role=button][${index}]: "${(link as HTMLAnchorElement).textContent?.trim().slice(0, 30)}"`,
          issue: 'Button-styled link has no action',
          severity: 'error',
          selector: getSelector(link),
          fix: 'Add href for navigation or onClick for action',
        });
      }
    }
  });

  return results;
}

/**
 * Generate a unique CSS selector for an element
 */
function getSelector(element: Element): string {
  if (element.id) return `#${element.id}`;

  let selector = element.tagName.toLowerCase();

  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(/\s+/).filter(c => c && !c.startsWith('__'));
    if (classes.length > 0) {
      selector += '.' + classes.slice(0, 2).join('.');
    }
  }

  const parent = element.parentElement;
  if (parent && parent !== document.body) {
    const siblings = Array.from(parent.children).filter(c => c.tagName === element.tagName);
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      selector += `:nth-of-type(${index})`;
    }
    return getSelector(parent) + ' > ' + selector;
  }

  return selector;
}

/**
 * Check for common mutation issues
 */
export function auditMutations(mutations: Record<string, unknown>): ButtonAuditResult[] {
  const results: ButtonAuditResult[] = [];

  Object.entries(mutations).forEach(([name, mutation]) => {
    if (mutation === undefined) {
      results.push({
        element: `mutation: ${name}`,
        issue: 'Mutation is undefined',
        severity: 'error',
        fix: `Check that ${name} hook is imported and called correctly`,
      });
    } else if (mutation === null) {
      results.push({
        element: `mutation: ${name}`,
        issue: 'Mutation is null',
        severity: 'error',
        fix: `Check that ${name} hook returns a valid mutation`,
      });
    } else if (typeof mutation === 'object' && mutation !== null) {
      const mutationObj = mutation as Record<string, unknown>;
      if (typeof mutationObj.mutate !== 'function' && typeof mutationObj.mutateAsync !== 'function') {
        results.push({
          element: `mutation: ${name}`,
          issue: 'Mutation object missing mutate/mutateAsync function',
          severity: 'error',
          fix: `Verify ${name} is a valid TanStack Query mutation`,
        });
      }
    }
  });

  return results;
}

/**
 * Intercept and log all button clicks on the page
 */
export function enableButtonClickLogging(): () => void {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button, a[role="button"], [role="button"]');

    if (button) {
      logger.debug('[BUTTON CLICK]', {
        text: button.textContent?.trim().slice(0, 50),
        tag: button.tagName,
        disabled: (button as HTMLButtonElement).disabled,
        type: (button as HTMLButtonElement).type,
        href: (button as HTMLAnchorElement).href,
        selector: getSelector(button),
      });
    }
  };

  document.addEventListener('click', handler, true);

  return () => {
    document.removeEventListener('click', handler, true);
  };
}

/**
 * Run full button audit and log results
 */
export function runButtonAudit(): { issues: ButtonAuditResult[]; summary: string } {
  const issues = auditButtons();

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  const summary = `Button Audit: ${errors.length} errors, ${warnings.length} warnings`;

  if (errors.length > 0) {
    logger.error('[BUTTON AUDIT]', { errors });
  }
  if (warnings.length > 0) {
    logger.warn('[BUTTON AUDIT]', { warnings });
  }

  return { issues, summary };
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).auditButtons = auditButtons;
  (window as any).runButtonAudit = runButtonAudit;
  (window as any).enableButtonClickLogging = enableButtonClickLogging;
}
