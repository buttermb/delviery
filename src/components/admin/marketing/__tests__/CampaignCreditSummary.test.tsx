/**
 * CampaignCreditSummary Tests
 *
 * Verifies:
 * - Shows nothing for paid tier users
 * - Shows nothing when recipient count is 0
 * - Displays correct cost for email campaigns (8cr per recipient)
 * - Displays correct cost for SMS campaigns (20cr per recipient)
 * - Shows insufficient credits warning when balance too low
 * - Shows balance impact (before → after)
 * - Shows loading state while fetching recipients
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignCreditSummary } from '../CampaignCreditSummary';

// --- Mutable mock state ---
let mockBalance = 1000;
let mockIsFreeTier = true;

// --- Mocks ---

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
  }),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: (actionKey: string) => {
    if (actionKey === 'send_bulk_email') return 8;
    if (actionKey === 'send_bulk_sms') return 20;
    return 0;
  },
}));

describe('CampaignCreditSummary', () => {
  beforeEach(() => {
    mockBalance = 1000;
    mockIsFreeTier = true;
  });

  describe('Visibility', () => {
    it('should render nothing for paid tier users', () => {
      mockIsFreeTier = false;
      const { container } = render(
        <CampaignCreditSummary campaignType="email" recipientCount={50} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when recipient count is 0 and not loading', () => {
      const { container } = render(
        <CampaignCreditSummary campaignType="email" recipientCount={0} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when recipient count is > 0', () => {
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={10} />
      );
      expect(screen.getByTestId('campaign-credit-summary')).toBeInTheDocument();
    });
  });

  describe('Email Campaign Costs', () => {
    it('should show correct total for email campaign', () => {
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={10} />
      );
      // 10 recipients × 8cr = 80 total
      expect(screen.getByText('80 credits')).toBeInTheDocument();
    });

    it('should show per-recipient cost breakdown for email', () => {
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={25} />
      );
      expect(
        screen.getByText(/25 recipients via email \(8cr each\) = 200 total credits/)
      ).toBeInTheDocument();
    });

    it('should handle large recipient counts', () => {
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={1000} />
      );
      // 1000 × 8 = 8,000
      expect(screen.getByText('8,000 credits')).toBeInTheDocument();
    });
  });

  describe('SMS Campaign Costs', () => {
    it('should show correct total for SMS campaign', () => {
      render(
        <CampaignCreditSummary campaignType="sms" recipientCount={5} />
      );
      // 5 recipients × 20cr = 100 total
      expect(screen.getByText('100 credits')).toBeInTheDocument();
    });

    it('should show per-recipient cost breakdown for SMS', () => {
      render(
        <CampaignCreditSummary campaignType="sms" recipientCount={5} />
      );
      expect(
        screen.getByText(/5 recipients via sms \(20cr each\) = 100 total credits/)
      ).toBeInTheDocument();
    });
  });

  describe('Balance Impact', () => {
    it('should show balance before and after when affordable', () => {
      mockBalance = 500;
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={10} />
      );
      // 500 → 420
      expect(screen.getByText(/500 → 420/)).toBeInTheDocument();
    });

    it('should show insufficient when balance too low', () => {
      mockBalance = 50;
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={10} />
      );
      // 10 × 8 = 80, but only have 50
      expect(screen.getByText(/Insufficient/)).toBeInTheDocument();
    });

    it('should show how many more credits needed', () => {
      mockBalance = 50;
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={10} />
      );
      // Need 80 - 50 = 30 more
      expect(screen.getByText(/30 more/)).toBeInTheDocument();
    });

    it('should use red styling when insufficient credits', () => {
      mockBalance = 10;
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={10} />
      );
      const summary = screen.getByTestId('campaign-credit-summary');
      expect(summary.className).toContain('border-red');
    });
  });

  describe('Loading State', () => {
    it('should show calculating text when loading recipients', () => {
      render(
        <CampaignCreditSummary
          campaignType="email"
          recipientCount={0}
          isLoadingRecipients={true}
        />
      );
      expect(screen.getByText('Calculating...')).toBeInTheDocument();
    });

    it('should still render the summary container when loading', () => {
      render(
        <CampaignCreditSummary
          campaignType="email"
          recipientCount={0}
          isLoadingRecipients={true}
        />
      );
      expect(screen.getByTestId('campaign-credit-summary')).toBeInTheDocument();
    });
  });

  describe('Single Recipient', () => {
    it('should use singular "recipient" for count of 1', () => {
      render(
        <CampaignCreditSummary campaignType="email" recipientCount={1} />
      );
      expect(screen.getByText(/1 recipient via email/)).toBeInTheDocument();
      expect(screen.queryByText(/recipients/)).not.toBeInTheDocument();
    });
  });
});
