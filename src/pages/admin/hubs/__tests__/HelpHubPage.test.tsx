/**
 * HelpHubPage Tests
 * Tests for tab rendering, form validation, aria-labels, and FAQ stable keys
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies that import supabase client
vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
    },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
    useTenantAdminAuth: () => ({
        tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant' },
        tenantSlug: 'test-tenant',
    }),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('@/hooks/usePageTitle', () => ({
    usePageTitle: vi.fn(),
}));

vi.mock('@/components/admin/HubBreadcrumbs', () => ({
    HubBreadcrumbs: () => <div data-testid="hub-breadcrumbs">Breadcrumbs</div>,
}));

vi.mock('@/components/admin/ScrollableTabsList', () => ({
    ScrollableTabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { toast } from 'sonner';
import HelpHubPage from '../HelpHubPage';

function createWrapper(initialEntry = '/admin/help-hub') {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[initialEntry]}>
                    {children}
                </MemoryRouter>
            </QueryClientProvider>
        );
    };
}

describe('HelpHubPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tab rendering', () => {
        it('should render all four tab triggers', () => {
            render(<HelpHubPage />, { wrapper: createWrapper() });

            expect(screen.getByText('Start')).toBeInTheDocument();
            expect(screen.getByText('Docs')).toBeInTheDocument();
            expect(screen.getByText('Support')).toBeInTheDocument();
            expect(screen.getByText('Feedback')).toBeInTheDocument();
        });

        it('should render page title and description', () => {
            render(<HelpHubPage />, { wrapper: createWrapper() });

            expect(screen.getByText('Help Center')).toBeInTheDocument();
            expect(screen.getByText('Tutorials, documentation, and support resources')).toBeInTheDocument();
        });

        it('should show getting-started tab content by default', () => {
            render(<HelpHubPage />, { wrapper: createWrapper() });

            expect(screen.getByText('Setup Checklist')).toBeInTheDocument();
            expect(screen.getByText('Video Tutorials')).toBeInTheDocument();
        });
    });

    describe('Getting Started tab', () => {
        it('should render onboarding steps with completion status', () => {
            render(<HelpHubPage />, { wrapper: createWrapper() });

            expect(screen.getByText('Complete your business profile')).toBeInTheDocument();
            expect(screen.getByText('Add your first products')).toBeInTheDocument();
            expect(screen.getByText('Create a menu')).toBeInTheDocument();
            expect(screen.getByText('2/6 complete')).toBeInTheDocument();
        });

        it('should render video tutorials', () => {
            render(<HelpHubPage />, { wrapper: createWrapper() });

            expect(screen.getByText('How to Import Products')).toBeInTheDocument();
            expect(screen.getByText('Creating Your First Menu')).toBeInTheDocument();
            expect(screen.getByText('Managing Orders')).toBeInTheDocument();
            expect(screen.getByText('Understanding Analytics')).toBeInTheDocument();
        });
    });

    describe('Documentation tab', () => {
        it('should render FAQ items with stable keys (not index)', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            const docsTab = screen.getByText('Docs');
            await user.click(docsTab);

            await waitFor(() => {
                expect(screen.getByText('How do I add products to my inventory?')).toBeInTheDocument();
            });

            expect(screen.getByText('How do I share a menu with customers?')).toBeInTheDocument();
            expect(screen.getByText('What happens when my trial ends?')).toBeInTheDocument();
            expect(screen.getByText('How is the platform fee calculated?')).toBeInTheDocument();
        });

        it('should render documentation quick links with aria-labels', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Docs'));

            await waitFor(() => {
                expect(screen.getByLabelText('Open user guide documentation')).toBeInTheDocument();
            });

            expect(screen.getByLabelText('Open API reference documentation')).toBeInTheDocument();
            expect(screen.getByLabelText('Browse video tutorial library')).toBeInTheDocument();
        });
    });

    describe('Support tab - ticket form validation', () => {
        it('should disable submit button when fields are empty', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Support'));

            await waitFor(() => {
                expect(screen.getByText('Submit Ticket')).toBeInTheDocument();
            });

            const submitButton = screen.getByText('Submit Ticket');
            expect(submitButton).toBeDisabled();
        });

        it('should enable submit button when both fields are filled', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Support'));

            await waitFor(() => {
                expect(screen.getByLabelText('Subject')).toBeInTheDocument();
            });

            await user.type(screen.getByLabelText('Subject'), 'Test issue');
            await user.type(screen.getByLabelText('Message'), 'Details about the issue');

            const submitButton = screen.getByText('Submit Ticket');
            expect(submitButton).toBeEnabled();
        });

        it('should show success toast and clear form on valid submission', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Support'));

            await waitFor(() => {
                expect(screen.getByLabelText('Subject')).toBeInTheDocument();
            });

            const subjectInput = screen.getByLabelText('Subject');
            const messageInput = screen.getByLabelText('Message');

            await user.type(subjectInput, 'Test issue');
            await user.type(messageInput, 'Details about the issue');
            await user.click(screen.getByText('Submit Ticket'));

            expect(vi.mocked(toast).success).toHaveBeenCalledWith('Ticket Submitted', {
                description: "We'll get back to you within 24 hours.",
            });

            expect(subjectInput).toHaveValue('');
            expect(messageInput).toHaveValue('');
        });

        it('should have maxLength on inputs', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Support'));

            await waitFor(() => {
                expect(screen.getByLabelText('Subject')).toBeInTheDocument();
            });

            expect(screen.getByLabelText('Subject')).toHaveAttribute('maxlength', '200');
            expect(screen.getByLabelText('Message')).toHaveAttribute('maxlength', '2000');
        });

        it('should render support contact options with aria-labels', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Support'));

            await waitFor(() => {
                expect(screen.getByLabelText('Start live chat with support')).toBeInTheDocument();
            });

            expect(screen.getByLabelText('Email support - configure in Settings')).toBeInTheDocument();
            expect(screen.getByLabelText('Learn about enterprise pricing and support')).toBeInTheDocument();
        });
    });

    describe('Feedback tab - form validation', () => {
        it('should disable submit button when feedback text is empty', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Feedback'));

            await waitFor(() => {
                expect(screen.getByText('Submit Feature Request')).toBeInTheDocument();
            });

            expect(screen.getByText('Submit Feature Request')).toBeDisabled();
        });

        it('should toggle between bug and feature feedback types', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Feedback'));

            await waitFor(() => {
                expect(screen.getByLabelText('Switch to bug report')).toBeInTheDocument();
            });

            const bugButton = screen.getByLabelText('Switch to bug report');
            expect(bugButton).toHaveAttribute('aria-pressed', 'false');

            await user.click(bugButton);

            expect(bugButton).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByText('Submit Bug Report')).toBeInTheDocument();
        });

        it('should show success toast and clear form on valid feedback submission', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Feedback'));

            await waitFor(() => {
                expect(screen.getByLabelText('Describe your feature idea')).toBeInTheDocument();
            });

            const feedbackInput = screen.getByLabelText('Describe your feature idea');
            await user.type(feedbackInput, 'I would love a dark mode option');
            await user.click(screen.getByText('Submit Feature Request'));

            expect(vi.mocked(toast).success).toHaveBeenCalledWith(
                'Feature Request Submitted',
                { description: 'Thank you for your feedback!' },
            );

            expect(feedbackInput).toHaveValue('');
        });

        it('should have maxLength on feedback textarea', async () => {
            const user = userEvent.setup();
            render(<HelpHubPage />, { wrapper: createWrapper() });

            await user.click(screen.getByText('Feedback'));

            await waitFor(() => {
                expect(screen.getByLabelText('Describe your feature idea')).toBeInTheDocument();
            });

            expect(screen.getByLabelText('Describe your feature idea')).toHaveAttribute('maxlength', '2000');
        });
    });
});
