import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientStatusBadge } from '../ClientStatusBadge';

describe('ClientStatusBadge', () => {
  describe('Account Status', () => {
    it('renders active status', () => {
      render(<ClientStatusBadge status="active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders suspended status', () => {
      render(<ClientStatusBadge status="suspended" />);
      expect(screen.getByText('Suspended')).toBeInTheDocument();
    });

    it('renders pending status', () => {
      render(<ClientStatusBadge status="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders inactive status', () => {
      render(<ClientStatusBadge status="inactive" />);
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('renders flagged status with orange styling', () => {
      render(<ClientStatusBadge status="flagged" />);
      const badge = screen.getByText('Flagged');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[class]')?.className).toContain('orange');
    });

    it('falls back to inactive for unknown status', () => {
      render(<ClientStatusBadge status="unknown_status" />);
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  describe('Credit Status', () => {
    it('renders good standing when balance is low', () => {
      render(<ClientStatusBadge status="active" type="credit" balance={1000} creditLimit={50000} />);
      expect(screen.getByText('Good Standing')).toBeInTheDocument();
    });

    it('renders paid when balance is zero', () => {
      render(<ClientStatusBadge status="active" type="credit" balance={0} />);
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });

    it('renders over limit when near credit limit', () => {
      render(<ClientStatusBadge status="active" type="credit" balance={9500} creditLimit={10000} />);
      expect(screen.getByText('Over Limit')).toBeInTheDocument();
    });
  });

  describe('Icon visibility', () => {
    it('shows icon by default', () => {
      const { container } = render(<ClientStatusBadge status="active" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      const { container } = render(<ClientStatusBadge status="active" showIcon={false} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });
  });
});
