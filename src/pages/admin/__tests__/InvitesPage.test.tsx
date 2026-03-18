import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

const mockMutateAsync = vi.fn();
const mockArchiveMutateAsync = vi.fn();
const mockRefetch = vi.fn();

const mockInvites = [
    {
        id: 'inv-1',
        account_id: 'account-123',
        name: 'Alice Smith',
        email: 'alice@example.com',
        phone: null,
        invite_token: 'token-1',
        status: 'pending' as const,
        client_id: null,
        accepted_at: null,
        created_at: '2026-01-15T10:00:00Z',
    },
    {
        id: 'inv-2',
        account_id: 'account-123',
        name: 'Bob Jones',
        email: 'bob@example.com',
        phone: null,
        invite_token: 'token-2',
        status: 'accepted' as const,
        client_id: 'client-1',
        accepted_at: '2026-01-16T10:00:00Z',
        created_at: '2026-01-10T10:00:00Z',
    },
    {
        id: 'inv-3',
        account_id: 'account-123',
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        phone: null,
        invite_token: 'token-3',
        status: 'expired' as const,
        client_id: null,
        accepted_at: null,
        created_at: '2025-12-01T10:00:00Z',
    },
];

vi.mock('@/hooks/crm/useInvites', () => ({
    useInvites: vi.fn(),
    useCreateInvite: vi.fn(),
    useArchiveInvite: vi.fn(),
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
    useConfirmDialog: vi.fn().mockReturnValue({
        dialogState: { open: false, title: '', description: '', itemType: '', isLoading: false, onConfirm: vi.fn() },
        confirm: vi.fn(),
        closeDialog: vi.fn(),
        setLoading: vi.fn(),
    }),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

import { useInvites, useCreateInvite, useArchiveInvite } from '@/hooks/crm/useInvites';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import InvitesPage from '../InvitesPage';

const mockedUseInvites = vi.mocked(useInvites);
const mockedUseCreateInvite = vi.mocked(useCreateInvite);
const mockedUseArchiveInvite = vi.mocked(useArchiveInvite);
const mockedUseConfirmDialog = vi.mocked(useConfirmDialog);

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
}

function renderWithProviders(ui: ReactNode) {
    const queryClient = createQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                {ui}
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('InvitesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockedUseInvites.mockReturnValue({
            data: mockInvites,
            isLoading: false,
            isError: false,
            error: null,
            refetch: mockRefetch,
            isFetching: false,
        } as ReturnType<typeof useInvites>);

        mockedUseCreateInvite.mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
        } as unknown as ReturnType<typeof useCreateInvite>);

        mockedUseArchiveInvite.mockReturnValue({
            mutateAsync: mockArchiveMutateAsync,
            isPending: false,
        } as unknown as ReturnType<typeof useArchiveInvite>);
    });

    // --- Rendering ---

    it('renders page header and description', () => {
        renderWithProviders(<InvitesPage />);
        expect(screen.getByText('Client Portal Invites')).toBeInTheDocument();
        expect(screen.getByText('Manage invitations for clients to access the portal.')).toBeInTheDocument();
    });

    it('renders all invite rows in the table', () => {
        renderWithProviders(<InvitesPage />);
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Jones')).toBeInTheDocument();
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });

    it('renders status badges correctly', () => {
        renderWithProviders(<InvitesPage />);
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Accepted')).toBeInTheDocument();
        expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('renders revoke button only for pending invites', () => {
        renderWithProviders(<InvitesPage />);
        const revokeButtons = screen.getAllByRole('button', { name: /revoke invite/i });
        expect(revokeButtons).toHaveLength(1);
        expect(revokeButtons[0]).toHaveAttribute('aria-label', 'Revoke invite for Alice Smith');
    });

    it('renders formatted dates', () => {
        renderWithProviders(<InvitesPage />);
        expect(screen.getByText('Jan 15, 2026')).toBeInTheDocument();
        expect(screen.getByText('Jan 10, 2026')).toBeInTheDocument();
        expect(screen.getByText('Dec 1, 2025')).toBeInTheDocument();
    });

    // --- Loading State ---

    it('shows skeleton table when loading', () => {
        mockedUseInvites.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            error: null,
            refetch: mockRefetch,
            isFetching: true,
        } as ReturnType<typeof useInvites>);

        renderWithProviders(<InvitesPage />);
        // SkeletonTable renders table rows with skeleton animations
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    });

    it('shows background refetch indicator', () => {
        mockedUseInvites.mockReturnValue({
            data: mockInvites,
            isLoading: false,
            isError: false,
            error: null,
            refetch: mockRefetch,
            isFetching: true,
        } as ReturnType<typeof useInvites>);

        renderWithProviders(<InvitesPage />);
        // The spinner next to the title during background fetch
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // --- Error State ---

    it('shows error state with retry button', () => {
        mockedUseInvites.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Network error'),
            refetch: mockRefetch,
            isFetching: false,
        } as ReturnType<typeof useInvites>);

        renderWithProviders(<InvitesPage />);
        expect(screen.getByText(/failed to load invites/i)).toBeInTheDocument();
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('calls refetch when retry button is clicked', async () => {
        const user = userEvent.setup();
        mockedUseInvites.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Network error'),
            refetch: mockRefetch,
            isFetching: false,
        } as ReturnType<typeof useInvites>);

        renderWithProviders(<InvitesPage />);
        await user.click(screen.getByRole('button', { name: /retry/i }));
        expect(mockRefetch).toHaveBeenCalled();
    });

    // --- Empty States ---

    it('shows empty state when no invites exist', () => {
        mockedUseInvites.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            refetch: mockRefetch,
            isFetching: false,
        } as ReturnType<typeof useInvites>);

        renderWithProviders(<InvitesPage />);
        expect(screen.getByText(/no invites yet/i)).toBeInTheDocument();
    });

    it('shows no-results empty state when search has no matches', async () => {
        const user = userEvent.setup();
        renderWithProviders(<InvitesPage />);

        const searchInput = screen.getByPlaceholderText(/search by name or email/i);
        await user.type(searchInput, 'zzzznonexistent');

        expect(screen.getByText(/no invites matching/i)).toBeInTheDocument();
    });

    // --- Search ---

    it('filters invites by name', async () => {
        const user = userEvent.setup();
        renderWithProviders(<InvitesPage />);

        const searchInput = screen.getByPlaceholderText(/search by name or email/i);
        await user.type(searchInput, 'Alice');

        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
        expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    });

    it('filters invites by email', async () => {
        const user = userEvent.setup();
        renderWithProviders(<InvitesPage />);

        const searchInput = screen.getByPlaceholderText(/search by name or email/i);
        await user.type(searchInput, 'bob@');

        expect(screen.getByText('Bob Jones')).toBeInTheDocument();
        expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    });

    it('search is case-insensitive', async () => {
        const user = userEvent.setup();
        renderWithProviders(<InvitesPage />);

        const searchInput = screen.getByPlaceholderText(/search by name or email/i);
        await user.type(searchInput, 'alice');

        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('has proper aria-label on search input', () => {
        renderWithProviders(<InvitesPage />);
        expect(screen.getByLabelText(/search invites by name or email/i)).toBeInTheDocument();
    });

    // --- Create Invite Dialog ---

    it('opens create dialog when Send Invite button is clicked', async () => {
        const user = userEvent.setup();
        renderWithProviders(<InvitesPage />);

        await user.click(screen.getByRole('button', { name: /send invite/i }));

        expect(screen.getByText('Send Portal Invite')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('client@example.com')).toBeInTheDocument();
    });

    it('submits create invite form with valid data', async () => {
        const user = userEvent.setup();
        mockMutateAsync.mockResolvedValueOnce({ id: 'new-inv' });

        renderWithProviders(<InvitesPage />);
        await user.click(screen.getByRole('button', { name: /send invite/i }));

        await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
        await user.type(screen.getByPlaceholderText('client@example.com'), 'test@example.com');

        // Click the submit button inside the dialog
        const dialog = screen.getByRole('dialog');
        const submitButton = within(dialog).getByRole('button', { name: /send invite/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalledWith({
                name: 'Test User',
                email: 'test@example.com',
                phone: undefined,
            });
        });
    });

    it('shows validation errors for empty form submission', async () => {
        const user = userEvent.setup();
        renderWithProviders(<InvitesPage />);

        await user.click(screen.getByRole('button', { name: /send invite/i }));

        const dialog = screen.getByRole('dialog');
        const submitButton = within(dialog).getByRole('button', { name: /send invite/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        });
    });

    it('does not submit with invalid email', async () => {
        const user = userEvent.setup();
        renderWithProviders(<InvitesPage />);

        await user.click(screen.getByRole('button', { name: /send invite/i }));

        await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
        await user.type(screen.getByPlaceholderText('client@example.com'), 'not-an-email');

        const dialog = screen.getByRole('dialog');
        const submitButton = within(dialog).getByRole('button', { name: /send invite/i });
        await user.click(submitButton);

        // Invalid email should prevent submission
        await waitFor(() => {
            expect(mockMutateAsync).not.toHaveBeenCalled();
        });
    });

    // --- Archive ---

    it('calls confirm dialog when revoke button is clicked', async () => {
        const user = userEvent.setup();
        const mockConfirm = vi.fn();
        mockedUseConfirmDialog.mockReturnValue({
            dialogState: { open: false, title: '', description: '', itemType: '', isLoading: false, onConfirm: vi.fn() },
            confirm: mockConfirm,
            closeDialog: vi.fn(),
            setLoading: vi.fn(),
        });

        renderWithProviders(<InvitesPage />);

        const revokeButton = screen.getByRole('button', { name: /revoke invite for alice smith/i });
        await user.click(revokeButton);

        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Archive Invite',
                itemType: 'invite',
            })
        );
    });

    // --- Email null display ---

    it('shows em dash when email is null', () => {
        mockedUseInvites.mockReturnValue({
            data: [{
                ...mockInvites[0],
                id: 'inv-null-email',
                email: null,
                name: 'No Email Client',
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: mockRefetch,
            isFetching: false,
        } as ReturnType<typeof useInvites>);

        renderWithProviders(<InvitesPage />);
        expect(screen.getByText('—')).toBeInTheDocument();
    });
});
