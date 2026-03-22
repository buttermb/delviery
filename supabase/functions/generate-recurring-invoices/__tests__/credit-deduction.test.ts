/**
 * Generate Recurring Invoices — Credit Deduction Tests
 *
 * Verifies that the generate-recurring-invoices edge function properly
 * integrates credit checking and deduction for each recurring invoice
 * generated, using the invoice_create action key (50 credits per invoice).
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, "..", "index.ts");
  return fs.readFileSync(edgeFunctionPath, "utf-8");
}

describe("generate-recurring-invoices credit deduction", () => {
  const source = readEdgeFunctionSource();

  it("should import checkCreditsAvailable from creditGate", () => {
    expect(source).toContain(
      'import { checkCreditsAvailable } from "../_shared/creditGate.ts"',
    );
  });

  it("should import from shared deps instead of direct URLs", () => {
    expect(source).toContain('from "../_shared/deps.ts"');
    expect(source).not.toContain("https://deno.land/std");
    expect(source).not.toContain("https://esm.sh/@supabase");
  });

  it("should use the invoice_create action key", () => {
    expect(source).toContain('"invoice_create"');
  });

  it("should call checkCreditsAvailable before creating each invoice", () => {
    const checkCreditsIndex = source.indexOf("checkCreditsAvailable");
    const insertInvoiceIndex = source.indexOf('.from("crm_invoices")');
    // Skip the import line — find usage in function body
    const checkCreditsUsage = source.indexOf(
      "checkCreditsAvailable",
      checkCreditsIndex + 1,
    );

    expect(checkCreditsUsage).toBeGreaterThan(-1);
    expect(checkCreditsUsage).toBeLessThan(insertInvoiceIndex);
  });

  it("should check credits using the schedule tenant_id", () => {
    expect(source).toContain("schedule.tenant_id");
  });

  it("should skip invoice creation when free tier tenant has insufficient credits", () => {
    expect(source).toContain("creditCheck.isFreeTier && !creditCheck.hasCredits");
    expect(source).toContain("skipped_insufficient_credits");
  });

  it("should call consume_credits RPC for free tier tenants", () => {
    expect(source).toContain('supabase.rpc("consume_credits"');
    expect(source).toContain("p_tenant_id: tenantId");
    expect(source).toContain("p_action_key: INVOICE_CREATE_ACTION_KEY");
  });

  it("should include reference_type as recurring_invoice in credit consumption", () => {
    expect(source).toContain('p_reference_type: "recurring_invoice"');
  });

  it("should track skipped_insufficient_credits in results", () => {
    expect(source).toContain("skipped_insufficient_credits: 0");
    expect(source).toContain("results.skipped_insufficient_credits++");
  });

  it("should continue processing other schedules when one fails credit check", () => {
    // After credit check fails, should use continue (not throw/return)
    const creditCheckBlock = source.slice(
      source.indexOf("creditCheck.isFreeTier && !creditCheck.hasCredits"),
      source.indexOf("Consume credits for free tier"),
    );
    expect(creditCheckBlock).toContain("continue");
  });

  it("should continue processing other schedules when credit deduction fails", () => {
    const creditErrorBlock = source.slice(
      source.indexOf("creditError"),
      source.indexOf("Generate invoice number"),
    );
    expect(creditErrorBlock).toContain("continue");
  });

  it("should not consume credits for paid tier tenants", () => {
    // The checkCreditsAvailable function handles this by returning isFreeTier: false,
    // and the code only calls consume_credits when isFreeTier is true
    expect(source).toContain("if (creditCheck.isFreeTier)");
  });

  it("should include description with schedule name in credit consumption", () => {
    expect(source).toMatch(/p_description:.*schedule\.name/);
  });
});
