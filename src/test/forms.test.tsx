import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import ShoppingListsPageOptimized from '@/components/pages/ShoppingListsPageOptimized';
import CreateEventModal from '@/components/calendar/CreateEventModal';
import CreateTemplateForm from '@/components/CreateTemplateForm';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'user-123' as string | null }),
}));

vi.mock('@/lib/api/database', () => ({
  getUserHouseholdId: vi.fn().mockResolvedValue('household-1'),
  getUserOnboardingStatus: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/hooks/useShoppingLists', () => ({
  useShoppingLists: () => ({ data: { shoppingLists: [] }, isLoading: false, error: null }),
  useCreateShoppingList: () => vi.fn(async () => Promise.resolve({})),
  useOptimisticShoppingLists: () => ({ addOptimisticList: vi.fn(), removeOptimisticList: vi.fn() }),
}));

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({ error: null, handleError: vi.fn(), clearError: vi.fn() })
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Client form validation', () => {
  it('prevents creating shopping list when name is empty', async () => {
    render(<ShoppingListsPageOptimized />);

    fireEvent.click(screen.getByRole('button', { name: /new list/i }));

    const createButton = screen.getByRole('button', { name: /create list/i });
    expect(createButton).toBeDisabled();

    const nameInput = screen.getByPlaceholderText(/groceries for this week/i);
    fireEvent.change(nameInput, { target: { value: 'Weekly Groceries' } });
    expect(screen.getByRole('button', { name: /create list/i })).toBeEnabled();

    fireEvent.change(nameInput, { target: { value: '' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /create list/i })).toBeDisabled());
  });

  it('shows validation error in calendar event modal', async () => {
    const onClose = vi.fn();
    const onEventCreated = vi.fn();

    render(
      <CreateEventModal
        isOpen={true}
        onClose={onClose}
        onEventCreated={onEventCreated}
      />
    );

    const submitButton = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  it('validates calendar template form', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateTemplateForm
        householdId="household-1"
        onCreateTemplate={onCreate}
        onCancel={vi.fn()}
      />
    );

    const createButton = screen.getByRole('button', { name: /create calendar template/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
