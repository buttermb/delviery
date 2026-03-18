/**
 * Tests for WholesaleClients component logic
 *
 * These tests verify:
 * - Client type label helper
 * - Territory extraction from address
 * - Total spent calculation from payments
 * - Client sorting logic
 * - Client search filtering
 */

import { describe, it, expect } from "vitest";

// Replicate the client type label helper
const getClientTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    sub_dealer: "Sub-Dealer",
    small_shop: "Small Shop",
    network: "Network/Crew",
    supplier: "Supplier",
  };
  return types[type] || type;
};

// Replicate territory extraction logic from address
const extractTerritory = (address: string | null): string => {
  return (address ?? "").split(",")[1]?.trim() || "Unknown";
};

// Replicate total_spent calculation from payments
const calculateTotalSpent = (
  payments: { amount: number | null }[] | null
): number => {
  return (
    payments?.reduce(
      (sum: number, p: { amount: number | null }) =>
        sum + (Number(p.amount) || 0),
      0
    ) ?? 0
  );
};

describe("getClientTypeLabel", () => {
  it("should return correct label for sub_dealer", () => {
    expect(getClientTypeLabel("sub_dealer")).toBe("Sub-Dealer");
  });

  it("should return correct label for small_shop", () => {
    expect(getClientTypeLabel("small_shop")).toBe("Small Shop");
  });

  it("should return correct label for network", () => {
    expect(getClientTypeLabel("network")).toBe("Network/Crew");
  });

  it("should return correct label for supplier", () => {
    expect(getClientTypeLabel("supplier")).toBe("Supplier");
  });

  it("should return raw value for unknown types", () => {
    expect(getClientTypeLabel("custom_type")).toBe("custom_type");
  });

  it("should return empty string for empty input", () => {
    expect(getClientTypeLabel("")).toBe("");
  });
});

describe("extractTerritory", () => {
  it("should extract city from comma-separated address", () => {
    expect(extractTerritory("123 Main St, Oakland, CA 94607")).toBe("Oakland");
  });

  it("should return Unknown for address without comma", () => {
    expect(extractTerritory("123 Main St")).toBe("Unknown");
  });

  it("should return Unknown for null address", () => {
    expect(extractTerritory(null)).toBe("Unknown");
  });

  it("should return Unknown for empty address", () => {
    expect(extractTerritory("")).toBe("Unknown");
  });

  it("should trim whitespace from territory", () => {
    expect(extractTerritory("123 Main St,  Oakland  , CA")).toBe("Oakland");
  });
});

describe("calculateTotalSpent", () => {
  it("should sum payment amounts", () => {
    const payments = [{ amount: 100 }, { amount: 250 }, { amount: 50 }];
    expect(calculateTotalSpent(payments)).toBe(400);
  });

  it("should handle null amounts", () => {
    const payments = [{ amount: 100 }, { amount: null }, { amount: 50 }];
    expect(calculateTotalSpent(payments)).toBe(150);
  });

  it("should return 0 for empty payments array", () => {
    expect(calculateTotalSpent([])).toBe(0);
  });

  it("should return 0 for null payments", () => {
    expect(calculateTotalSpent(null)).toBe(0);
  });

  it("should handle single payment", () => {
    expect(calculateTotalSpent([{ amount: 999.99 }])).toBe(999.99);
  });
});

// Replicate client sorting logic
type ClientSortField =
  | "business_name"
  | "outstanding_balance"
  | "created_at"
  | "status";
type SortOrder = "asc" | "desc";

interface MockClient {
  business_name: string | null;
  outstanding_balance: number;
  created_at: string;
  status: string | null;
}

const sortClients = (
  clients: MockClient[],
  sortField: ClientSortField,
  sortOrder: SortOrder
): MockClient[] => {
  const sorted = [...clients];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "business_name":
        cmp = (a.business_name ?? "").localeCompare(b.business_name ?? "");
        break;
      case "outstanding_balance":
        cmp =
          (Number(a.outstanding_balance) || 0) -
          (Number(b.outstanding_balance) || 0);
        break;
      case "created_at":
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case "status":
        cmp = (a.status ?? "").localeCompare(b.status ?? "");
        break;
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });
  return sorted;
};

describe("Client sorting", () => {
  const mockClients: MockClient[] = [
    {
      business_name: "Charlie Corp",
      outstanding_balance: 500,
      created_at: "2024-03-01T00:00:00Z",
      status: "active",
    },
    {
      business_name: "Alpha Inc",
      outstanding_balance: 1000,
      created_at: "2024-01-01T00:00:00Z",
      status: "inactive",
    },
    {
      business_name: "Beta LLC",
      outstanding_balance: 0,
      created_at: "2024-02-01T00:00:00Z",
      status: "active",
    },
  ];

  it("should sort by business_name ascending", () => {
    const result = sortClients(mockClients, "business_name", "asc");
    expect(result.map((c) => c.business_name)).toEqual([
      "Alpha Inc",
      "Beta LLC",
      "Charlie Corp",
    ]);
  });

  it("should sort by business_name descending", () => {
    const result = sortClients(mockClients, "business_name", "desc");
    expect(result.map((c) => c.business_name)).toEqual([
      "Charlie Corp",
      "Beta LLC",
      "Alpha Inc",
    ]);
  });

  it("should sort by outstanding_balance ascending", () => {
    const result = sortClients(mockClients, "outstanding_balance", "asc");
    expect(result.map((c) => c.outstanding_balance)).toEqual([0, 500, 1000]);
  });

  it("should sort by outstanding_balance descending", () => {
    const result = sortClients(mockClients, "outstanding_balance", "desc");
    expect(result.map((c) => c.outstanding_balance)).toEqual([1000, 500, 0]);
  });

  it("should sort by created_at ascending", () => {
    const result = sortClients(mockClients, "created_at", "asc");
    expect(result.map((c) => c.business_name)).toEqual([
      "Alpha Inc",
      "Beta LLC",
      "Charlie Corp",
    ]);
  });

  it("should sort by status ascending", () => {
    const result = sortClients(mockClients, "status", "asc");
    // "active" < "inactive" lexicographically
    expect(result[0].status).toBe("active");
    expect(result[result.length - 1].status).toBe("inactive");
  });

  it("should not mutate the original array", () => {
    const original = [...mockClients];
    sortClients(mockClients, "business_name", "asc");
    expect(mockClients).toEqual(original);
  });

  it("should handle null business_name values", () => {
    const clientsWithNull: MockClient[] = [
      ...mockClients,
      {
        business_name: null,
        outstanding_balance: 200,
        created_at: "2024-04-01T00:00:00Z",
        status: "active",
      },
    ];
    const result = sortClients(clientsWithNull, "business_name", "asc");
    // null coerces to "", which sorts before "Alpha"
    expect(result[0].business_name).toBe(null);
  });
});

// Replicate search filtering logic
const filterClients = (
  clients: MockClient[],
  searchTerm: string
): MockClient[] => {
  const sanitized = searchTerm.trim().toLowerCase();
  return clients.filter(
    (client) =>
      (client.business_name ?? "").toLowerCase().includes(sanitized) ||
      (client.status ?? "").toLowerCase().includes(sanitized)
  );
};

describe("Client search filtering", () => {
  const mockClients: MockClient[] = [
    {
      business_name: "Green Dispensary",
      outstanding_balance: 0,
      created_at: "2024-01-01T00:00:00Z",
      status: "active",
    },
    {
      business_name: "Blue Pharmacy",
      outstanding_balance: 100,
      created_at: "2024-02-01T00:00:00Z",
      status: "inactive",
    },
    {
      business_name: "Green Gardens",
      outstanding_balance: 500,
      created_at: "2024-03-01T00:00:00Z",
      status: "active",
    },
  ];

  it("should filter by business name", () => {
    const result = filterClients(mockClients, "Green");
    expect(result).toHaveLength(2);
  });

  it("should be case-insensitive", () => {
    const result = filterClients(mockClients, "green");
    expect(result).toHaveLength(2);
  });

  it("should return all clients for empty search", () => {
    const result = filterClients(mockClients, "");
    expect(result).toHaveLength(3);
  });

  it("should return empty array when nothing matches", () => {
    const result = filterClients(mockClients, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("should handle whitespace in search term", () => {
    const result = filterClients(mockClients, "  Green  ");
    expect(result).toHaveLength(2);
  });
});
