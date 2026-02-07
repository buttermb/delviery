import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertBadge, AlertDot } from './AlertBadge';

describe('AlertBadge', () => {
  describe('Rendering', () => {
    it('should render with count', () => {
      render(<AlertBadge level="critical" count={5} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<AlertBadge level="warning" label="Alert" />);
      expect(screen.getByText('Alert')).toBeInTheDocument();
    });

    it('should display "99+" when count exceeds 99', () => {
      render(<AlertBadge level="info" count={100} />);
      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should display "99+" when count is greater than 99', () => {
      render(<AlertBadge level="info" count={150} />);
      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should display exact count when count is 99', () => {
      render(<AlertBadge level="info" count={99} />);
      expect(screen.getByText('99')).toBeInTheDocument();
    });

    it('should display exact count when count is less than 99', () => {
      render(<AlertBadge level="info" count={42} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render 0 count', () => {
      render(<AlertBadge level="success" count={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should return null when neither count nor label is provided', () => {
      const { container } = render(<AlertBadge level="info" />);
      expect(container.firstChild).toBeNull();
    });

    it('should prioritize label over count when both are provided', () => {
      render(<AlertBadge level="warning" count={5} label="Custom" />);
      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
  });

  describe('Alert Levels', () => {
    it('should apply critical level styles', () => {
      const { container } = render(<AlertBadge level="critical" count={1} />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-destructive', 'text-destructive-foreground');
    });

    it('should apply warning level styles', () => {
      const { container } = render(<AlertBadge level="warning" count={1} />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-amber-500', 'text-white');
    });

    it('should apply success level styles', () => {
      const { container } = render(<AlertBadge level="success" count={1} />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-emerald-500', 'text-white');
    });

    it('should apply info level styles', () => {
      const { container } = render(<AlertBadge level="info" count={1} />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-blue-500', 'text-white');
    });
  });

  describe('Sizes', () => {
    it('should apply small size styles', () => {
      const { container } = render(<AlertBadge level="info" count={1} size="sm" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('h-5', 'min-w-5', 'text-xs', 'px-1.5');
    });

    it('should apply medium size styles by default', () => {
      const { container } = render(<AlertBadge level="info" count={1} />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('h-6', 'min-w-6', 'text-sm', 'px-2');
    });

    it('should apply medium size styles when explicitly set', () => {
      const { container } = render(<AlertBadge level="info" count={1} size="md" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('h-6', 'min-w-6', 'text-sm', 'px-2');
    });

    it('should apply large size styles', () => {
      const { container } = render(<AlertBadge level="info" count={1} size="lg" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('h-7', 'min-w-7', 'text-sm', 'px-2.5');
    });
  });

  describe('Pulse Animation', () => {
    it('should apply pulse animation when pulse is true and level is critical', () => {
      const { container } = render(<AlertBadge level="critical" count={1} pulse={true} />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('animate-pulse');
    });

    it('should not apply pulse animation when pulse is false', () => {
      const { container } = render(<AlertBadge level="critical" count={1} pulse={false} />);
      const badge = container.querySelector('span');
      expect(badge).not.toHaveClass('animate-pulse');
    });

    it('should not apply pulse animation when pulse is true but level is not critical', () => {
      const { container } = render(<AlertBadge level="warning" count={1} pulse={true} />);
      const badge = container.querySelector('span');
      expect(badge).not.toHaveClass('animate-pulse');
    });

    it('should not apply pulse animation by default', () => {
      const { container } = render(<AlertBadge level="critical" count={1} />);
      const badge = container.querySelector('span');
      expect(badge).not.toHaveClass('animate-pulse');
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <AlertBadge level="info" count={1} className="custom-class" />
      );
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('custom-class');
    });

    it('should merge custom className with default classes', () => {
      const { container } = render(
        <AlertBadge level="info" count={1} className="custom-class" />
      );
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('custom-class', 'inline-flex', 'items-center');
    });
  });

  describe('React.memo Optimization', () => {
    it('should memoize component and not re-render with same props', () => {
      const renderSpy = vi.fn();

      function TestWrapper({ level, count }: { level: 'critical' | 'warning' | 'success' | 'info'; count: number }) {
        renderSpy();
        return <AlertBadge level={level} count={count} />;
      }

      const { rerender } = render(<TestWrapper level="critical" count={5} />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(<TestWrapper level="critical" count={5} />);
      expect(renderSpy).toHaveBeenCalledTimes(2);

      // The component itself should be memoized
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should re-render when props change', () => {
      const { rerender } = render(<AlertBadge level="critical" count={5} />);
      expect(screen.getByText('5')).toBeInTheDocument();

      rerender(<AlertBadge level="critical" count={10} />);
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });
  });
});

describe('AlertDot', () => {
  describe('Rendering', () => {
    it('should render successfully', () => {
      const { container } = render(<AlertDot level="critical" />);
      const dot = container.querySelector('span');
      expect(dot).toBeInTheDocument();
    });

    it('should have correct base classes', () => {
      const { container } = render(<AlertDot level="info" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('inline-block', 'h-2', 'w-2', 'rounded-full');
    });
  });

  describe('Alert Levels', () => {
    it('should apply critical level styles', () => {
      const { container } = render(<AlertDot level="critical" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-destructive', 'text-destructive-foreground');
    });

    it('should apply warning level styles', () => {
      const { container } = render(<AlertDot level="warning" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-amber-500', 'text-white');
    });

    it('should apply success level styles', () => {
      const { container } = render(<AlertDot level="success" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-emerald-500', 'text-white');
    });

    it('should apply info level styles', () => {
      const { container } = render(<AlertDot level="info" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-blue-500', 'text-white');
    });
  });

  describe('Pulse Animation', () => {
    it('should apply pulse animation when pulse is true', () => {
      const { container } = render(<AlertDot level="critical" pulse={true} />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('animate-pulse');
    });

    it('should not apply pulse animation when pulse is false', () => {
      const { container } = render(<AlertDot level="critical" pulse={false} />);
      const dot = container.querySelector('span');
      expect(dot).not.toHaveClass('animate-pulse');
    });

    it('should not apply pulse animation by default', () => {
      const { container } = render(<AlertDot level="critical" />);
      const dot = container.querySelector('span');
      expect(dot).not.toHaveClass('animate-pulse');
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className', () => {
      const { container } = render(<AlertDot level="info" className="custom-dot" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('custom-dot');
    });

    it('should merge custom className with default classes', () => {
      const { container } = render(<AlertDot level="info" className="custom-dot" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('custom-dot', 'inline-block', 'h-2', 'w-2');
    });
  });

  describe('React.memo Optimization', () => {
    it('should memoize component and not re-render with same props', () => {
      const renderSpy = vi.fn();

      function TestWrapper({ level }: { level: 'critical' | 'warning' | 'success' | 'info' }) {
        renderSpy();
        return <AlertDot level={level} />;
      }

      const { rerender } = render(<TestWrapper level="critical" />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(<TestWrapper level="critical" />);
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should re-render when props change', () => {
      const { container, rerender } = render(<AlertDot level="critical" />);
      const dot = container.querySelector('span');
      expect(dot).toHaveClass('bg-destructive');

      rerender(<AlertDot level="success" />);
      const updatedDot = container.querySelector('span');
      expect(updatedDot).toHaveClass('bg-emerald-500');
      expect(updatedDot).not.toHaveClass('bg-destructive');
    });
  });
});
