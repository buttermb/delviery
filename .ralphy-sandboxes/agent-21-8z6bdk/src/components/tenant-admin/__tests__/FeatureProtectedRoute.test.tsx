import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

const mockCanAccess = vi.fn<(featureId: string) => boolean>();
const mockIsEnabled = vi.fn<(feature: string) => boolean>();
let mockIsLoading = false;

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canAccess: mockCanAccess,
  }),
}));

vi.mock('@/hooks/useTenantFeatureToggles', () => ({
  useTenantFeatureToggles: () => ({
    isEnabled: mockIsEnabled,
    isLoading: mockIsLoading,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenantSlug: 'acme',
  }),
}));

import { FeatureGate } from '@/components/tenant-admin/FeatureGate';
import { FeatureProtectedRoute } from '@/components/tenant-admin/FeatureProtectedRoute';

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe('FeatureProtectedRoute / FeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccess.mockReturnValue(true);
    mockIsEnabled.mockReturnValue(true);
    mockIsLoading = false;
  });

  it('renders children when featureId access is allowed', () => {
    renderWithRouter(
      <FeatureGate featureId="dashboard">
        <div>Allowed Content</div>
      </FeatureGate>
    );

    expect(screen.getByText('Allowed Content')).toBeInTheDocument();
  });

  it('renders upgrade fallback when featureId access is denied', () => {
    mockCanAccess.mockReturnValue(false);

    renderWithRouter(
      <FeatureGate featureId="dashboard">
        <div>Blocked Content</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Blocked Content')).not.toBeInTheDocument();
    expect(screen.getByText('Upgrade Required')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view upgrade options/i })).toHaveAttribute('href', '/acme/admin/billing');
  });

  it('preserves feature toggle path: disabled toggle blocks content', () => {
    mockIsEnabled.mockReturnValue(false);

    renderWithRouter(
      <FeatureProtectedRoute feature="analytics_advanced">
        <div>Toggle Gated Content</div>
      </FeatureProtectedRoute>
    );

    expect(screen.queryByText('Toggle Gated Content')).not.toBeInTheDocument();
    expect(screen.getByText('Feature Disabled')).toBeInTheDocument();
  });

  it('requires both gates: featureId denied blocks even when toggle enabled', () => {
    mockCanAccess.mockReturnValue(false);
    mockIsEnabled.mockReturnValue(true);

    renderWithRouter(
      <FeatureProtectedRoute featureId="analytics" feature="analytics_advanced">
        <div>Dual Gated Content</div>
      </FeatureProtectedRoute>
    );

    expect(screen.queryByText('Dual Gated Content')).not.toBeInTheDocument();
    expect(screen.getByText('Upgrade Required')).toBeInTheDocument();
  });

  it('requires both gates: toggle denied blocks when featureId allowed', () => {
    mockCanAccess.mockReturnValue(true);
    mockIsEnabled.mockReturnValue(false);

    renderWithRouter(
      <FeatureProtectedRoute featureId="analytics" feature="analytics_advanced">
        <div>Dual Gated Content</div>
      </FeatureProtectedRoute>
    );

    expect(screen.queryByText('Dual Gated Content')).not.toBeInTheDocument();
    expect(screen.getByText('Feature Disabled')).toBeInTheDocument();
  });
});
