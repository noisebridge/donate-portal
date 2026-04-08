import { describe, expect, test } from "bun:test";
import type { ChargeAlertMessage } from "~/managers/charge-alert";
import { AlertsPage } from "./alerts";

const makeCharge = (
  cents: number,
  productName = "General Donation",
): ChargeAlertMessage => ({
  type: "charge_alert",
  id: "ch_test",
  date: "2026-01-15T12:00:00Z",
  amount: { cents },
  productName,
});

describe("AlertsPage", () => {
  test("should render with charges", async () => {
    const charges = [makeCharge(5000, "Laser Cutter"), makeCharge(2000)];
    const result = await (<AlertsPage alerts={charges} />);

    expect(result).toBeTypeOf("string");
    expect(result).toContain("Laser Cutter");
    expect(result).toContain("Latest Donation");
  });

  test("should show NICE badge for amounts ending in 69 cents", async () => {
    const charges = [makeCharge(4269)];
    const result = await (<AlertsPage alerts={charges} />);

    expect(result).toContain("nice-badge");
  });
});
