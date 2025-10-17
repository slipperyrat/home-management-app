import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { BillQuickAdd } from "@/app/finance/_components/BillQuickAdd";
import { EnvelopeQuickAdd } from "@/app/finance/_components/EnvelopeQuickAdd";
import { SpendingQuickAdd } from "@/app/finance/_components/SpendingQuickAdd";
import { FinanceOverview } from "@/app/finance/_components/FinanceOverview";
import type { BillDto, FinanceFeatureFlags, FinanceSummary, SpendEntryDto } from "@/app/finance/_lib/types";
import { BillsSection } from "@/app/finance/_components/BillsSection";
import { SpendingSection } from "@/app/finance/_components/SpendingSection";
import { FinanceInsightsHeader } from "@/app/finance/_components/FinanceInsightsHeader";
import { FinanceQuickActionsDrawer } from "@/app/finance/_components/FinanceQuickActionsDrawer";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: refreshMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderWithQuery(children: React.ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("Finance quick-add components", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    refreshMock.mockClear();
  });

  it("creates a bill via the finance quick-add form", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { bill: { id: "bill-1" } } }),
    } as Response);

    renderWithQuery(<BillQuickAdd householdId="house-1" />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Electricity" } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "120.5" } });
    fireEvent.click(screen.getByRole("button", { name: /add bill/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/finance/bills",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Electricity"),
        }),
      );
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("creates a budget envelope with default metadata", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { envelope: { id: "env-1" } } }),
    } as Response);

    renderWithQuery(<EnvelopeQuickAdd householdId="house-1" />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Groceries" } });
    fireEvent.change(screen.getByLabelText(/allocated amount/i), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: /create envelope/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/finance/budget-envelopes",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Groceries"),
        }),
      );
    });
  });

  it("creates a spend entry from the quick form", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { spend_entry: { id: "spend-1" } } }),
    } as Response);

    renderWithQuery(<SpendingQuickAdd />);

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Market" } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: /add expense/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/finance/spend-entries",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Market"),
        }),
      );
    });
  });

  it("filters bills using search", async () => {
    const bills: BillDto[] = [
      {
        id: "bill-1",
        title: "Electric",
        description: "Monthly power",
        amount: 120,
        currency: "USD",
        dueAt: "2025-01-01",
        issuedAt: null,
        paidAt: null,
        status: "pending",
        category: "utilities",
        priority: "medium",
        source: "manual",
        createdAt: "2024-12-01",
      },
      {
        id: "bill-2",
        title: "Water",
        description: "Quarterly water",
        amount: 60,
        currency: "USD",
        dueAt: "2025-01-05",
        issuedAt: null,
        paidAt: null,
        status: "overdue",
        category: "utilities",
        priority: "high",
        source: "manual",
        createdAt: "2024-12-01",
      },
    ];

    const summary: FinanceSummary["bills"] = {
      total: 2,
      pending: 1,
      overdue: 1,
      amountDue: 120,
      upcoming: bills,
    };

    renderWithQuery(
      <BillsSection bills={bills} summary={summary} householdId="house-1" />,
    );

    fireEvent.change(screen.getByPlaceholderText(/search bills/i), { target: { value: "water" } });

    await waitFor(() => {
      expect(screen.getAllByText(/water/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/electric/i)).not.toBeInTheDocument();
    });
  });

  it("filters spending using search", () => {
    const entries: SpendEntryDto[] = [
      {
        id: "sp-1",
        amount: 20,
        description: "Coffee",
        category: "food",
        transactionDate: "2025-01-01",
        merchant: "Cafe",
        paymentMethod: "card",
        envelope: null,
        bill: null,
        createdAt: "2025-01-01",
      },
      {
        id: "sp-2",
        amount: 200,
        description: "Groceries",
        category: "groceries",
        transactionDate: "2025-01-02",
        merchant: "Market",
        paymentMethod: "card",
        envelope: null,
        bill: null,
        createdAt: "2025-01-02",
      },
    ];

    renderWithQuery(<SpendingSection entries={entries} />);

    fireEvent.change(screen.getByPlaceholderText(/search transactions/i), { target: { value: "coffee" } });
    expect(screen.getByText(/coffee/i)).toBeInTheDocument();
    expect(screen.queryByText(/groceries/i)).not.toBeInTheDocument();
  });
});

describe("FinanceOverview", () => {
  const summary: FinanceSummary = {
    bills: {
      total: 3,
      pending: 2,
      overdue: 1,
      amountDue: 250,
      upcoming: [],
    },
    envelopes: {
      total: 2,
      totalAllocated: 600,
      totalSpent: 200,
      totalRemaining: 400,
    },
    spending: {
      recent: [],
    },
  };

  it("renders bill and budget cards when features are enabled", () => {
    const flags: FinanceFeatureFlags = { bills: true, envelopes: true, spending: true };
    render(<FinanceOverview summary={summary} featureFlags={flags} />);

    expect(screen.getByText(/total bills/i)).toBeInTheDocument();
    expect(screen.getByText(/budget envelopes/i)).toBeInTheDocument();
    expect(screen.getByText(/spent this period/i)).toBeInTheDocument();
  });

  it("hides bill cards when access is disabled", () => {
    const flags: FinanceFeatureFlags = { bills: false, envelopes: true, spending: false };
    render(<FinanceOverview summary={summary} featureFlags={flags} />);

    expect(screen.queryByText(/total bills/i)).not.toBeInTheDocument();
    expect(screen.getByText(/budget envelopes/i)).toBeInTheDocument();
  });
});

describe("Finance insights", () => {
  const summary: FinanceSummary = {
    bills: {
      total: 4,
      pending: 2,
      overdue: 1,
      amountDue: 300,
      upcoming: [
        {
          id: "bill-1",
          title: "Rent",
          description: null,
          amount: 1500,
          currency: "USD",
          dueAt: "2025-02-01",
          issuedAt: null,
          paidAt: null,
          status: "pending",
          category: "housing",
          priority: "high",
          source: "manual",
          createdAt: "2025-01-01",
        },
      ],
    },
    envelopes: {
      total: 3,
      totalAllocated: 800,
      totalSpent: 300,
      totalRemaining: 500,
    },
    spending: {
      recent: [
        {
          id: "sp-1",
          description: "Dining",
          amount: 60,
          category: "food",
          transactionDate: "2025-01-10",
          merchant: "Restaurant",
          paymentMethod: "card",
          envelope: null,
          bill: null,
          createdAt: "2025-01-10",
        },
      ],
    },
  };

  it("renders headline insights", () => {
    render(<FinanceInsightsHeader summary={summary} />);
    expect(screen.getByText(/rent/i)).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
  });

  it("opens quick actions drawer", () => {
    render(<FinanceQuickActionsDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /quick actions/i }));
    expect(screen.getByText(/add bill/i)).toBeInTheDocument();
  });
});
