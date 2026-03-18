import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignAnalytics } from '../CampaignAnalytics';
import type { MarketingCampaign } from '../types';

const makeCampaign = (overrides: Partial<MarketingCampaign> = {}): MarketingCampaign => ({
  id: crypto.randomUUID(),
  name: 'Test Campaign',
  type: 'email',
  status: 'draft',
  subject: null,
  content: 'Hello',
  audience: 'all',
  scheduled_at: null,
  sent_count: null,
  opened_count: null,
  clicked_count: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('CampaignAnalytics', () => {
  it('should render zero state when no campaigns exist', () => {
    render(<CampaignAnalytics campaigns={[]} />);

    expect(screen.getByText('Total Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Total Sent')).toBeInTheDocument();
    expect(screen.getByText('Open Rate')).toBeInTheDocument();
    expect(screen.getByText('Click Rate')).toBeInTheDocument();
    expect(screen.getByText('Active Now')).toBeInTheDocument();
    // Zero values rendered across multiple cards
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('0%').length).toBe(2);
  });

  it('should count campaigns correctly', () => {
    const campaigns = [
      makeCampaign({ status: 'sent', sent_count: 100 }),
      makeCampaign({ type: 'sms', status: 'draft' }),
      makeCampaign({ status: 'sending' }),
    ];

    render(<CampaignAnalytics campaigns={campaigns} />);

    // 3 total campaigns, 2 active (sent + sending)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('should compute open and click rates from real metrics', () => {
    const campaigns = [
      makeCampaign({ sent_count: 200, opened_count: 100, clicked_count: 20 }),
      makeCampaign({ sent_count: 100, opened_count: 50, clicked_count: 10 }),
    ];

    render(<CampaignAnalytics campaigns={campaigns} />);

    // 300 total sent
    expect(screen.getByText('300')).toBeInTheDocument();
    // 150 opened / 300 sent = 50%
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    // 30 clicked / 150 opened = 20%
    expect(screen.getByText('20.0%')).toBeInTheDocument();
  });

  it('should count active campaigns (sent + sending)', () => {
    const campaigns = [
      makeCampaign({ status: 'sent' }),
      makeCampaign({ status: 'sending' }),
      makeCampaign({ status: 'draft' }),
      makeCampaign({ status: 'paused' }),
    ];

    render(<CampaignAnalytics campaigns={campaigns} />);

    // Active: sent + sending = 2
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('should handle null metric values gracefully', () => {
    const campaigns = [
      makeCampaign({ sent_count: null, opened_count: null, clicked_count: null }),
    ];

    render(<CampaignAnalytics campaigns={campaigns} />);

    expect(screen.getByText('Total Sent')).toBeInTheDocument();
    // Should show 0 for all metrics
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });
});
