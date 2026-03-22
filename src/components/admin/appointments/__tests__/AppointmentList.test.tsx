/**
 * AppointmentList Component Tests
 *
 * Tests the appointment list with credit-gated reminder functionality:
 * 1. Renders appointments with reminder buttons
 * 2. Hides reminder buttons for cancelled/completed appointments
 * 3. Calls onSendReminder when bell button is clicked
 * 4. Shows loading spinner for the appointment being reminded
 * 5. Hides reminder buttons when no onSendReminder is provided
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppointmentList } from '../AppointmentList';

// Mock formatSmartDate
vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

const mockAppointments = [
  {
    id: 'apt-1',
    customer_id: 'cust-1',
    scheduled_at: '2026-03-25T10:00:00Z',
    duration_minutes: 30,
    type: 'consultation',
    status: 'scheduled',
    notes: 'First visit',
  },
  {
    id: 'apt-2',
    customer_id: 'cust-2',
    scheduled_at: '2026-03-26T14:00:00Z',
    duration_minutes: 60,
    type: 'delivery',
    status: 'confirmed',
  },
  {
    id: 'apt-3',
    customer_id: 'cust-3',
    scheduled_at: '2026-03-20T09:00:00Z',
    duration_minutes: 45,
    type: 'follow-up',
    status: 'cancelled',
  },
  {
    id: 'apt-4',
    customer_id: 'cust-4',
    scheduled_at: '2026-03-19T11:00:00Z',
    duration_minutes: 30,
    type: 'pickup',
    status: 'completed',
  },
];

describe('AppointmentList', () => {
  it('renders loading state', () => {
    const { container } = render(
      <AppointmentList
        appointments={[]}
        isLoading={true}
        onEdit={vi.fn()}
      />
    );

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders empty state when no appointments', () => {
    render(
      <AppointmentList
        appointments={[]}
        isLoading={false}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText('No appointments scheduled.')).toBeInTheDocument();
  });

  it('renders appointments with reminder buttons when onSendReminder is provided', () => {
    const onSendReminder = vi.fn();

    render(
      <AppointmentList
        appointments={mockAppointments}
        isLoading={false}
        onEdit={vi.fn()}
        onSendReminder={onSendReminder}
      />
    );

    // Should show reminder buttons for scheduled and confirmed appointments
    const reminderButtons = screen.getAllByTitle('Send reminder (25 credits)');
    expect(reminderButtons).toHaveLength(2); // apt-1 (scheduled) and apt-2 (confirmed)
  });

  it('hides reminder buttons for cancelled and completed appointments', () => {
    render(
      <AppointmentList
        appointments={mockAppointments}
        isLoading={false}
        onEdit={vi.fn()}
        onSendReminder={vi.fn()}
      />
    );

    // Only 2 reminder buttons (not for cancelled/completed)
    const reminderButtons = screen.getAllByTitle('Send reminder (25 credits)');
    expect(reminderButtons).toHaveLength(2);
  });

  it('calls onSendReminder with the appointment when clicked', () => {
    const onSendReminder = vi.fn();

    render(
      <AppointmentList
        appointments={mockAppointments}
        isLoading={false}
        onEdit={vi.fn()}
        onSendReminder={onSendReminder}
      />
    );

    const reminderButtons = screen.getAllByTitle('Send reminder (25 credits)');
    fireEvent.click(reminderButtons[0]);

    expect(onSendReminder).toHaveBeenCalledWith(mockAppointments[0]);
  });

  it('shows loading spinner on the appointment being reminded', () => {
    render(
      <AppointmentList
        appointments={mockAppointments}
        isLoading={false}
        onEdit={vi.fn()}
        onSendReminder={vi.fn()}
        isSendingReminder={true}
        sendingReminderId="apt-1"
      />
    );

    // The first reminder button should be disabled
    const reminderButtons = screen.getAllByTitle('Send reminder (25 credits)');
    expect(reminderButtons[0]).toBeDisabled();
    // Second button should not be disabled
    expect(reminderButtons[1]).not.toBeDisabled();
  });

  it('does not render reminder buttons when onSendReminder is not provided', () => {
    render(
      <AppointmentList
        appointments={mockAppointments}
        isLoading={false}
        onEdit={vi.fn()}
      />
    );

    const reminderButtons = screen.queryAllByTitle('Send reminder (25 credits)');
    expect(reminderButtons).toHaveLength(0);
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();

    render(
      <AppointmentList
        appointments={[mockAppointments[0]]}
        isLoading={false}
        onEdit={onEdit}
      />
    );

    // The edit button (there's only one appointment, one edit button)
    const editButtons = document.querySelectorAll('button');
    // Last button should be the edit button
    const editButton = editButtons[editButtons.length - 1];
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith(mockAppointments[0]);
  });
});
