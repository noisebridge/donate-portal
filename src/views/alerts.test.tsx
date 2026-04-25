import { describe, expect, test } from "bun:test";
import type {
  AlertMessage,
  ChargeAlertMessage,
  MemberAlertMessage,
} from "~/types/alerts";
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

const makeMember = (): MemberAlertMessage => ({
  type: "member_alert",
  id: "mem_test",
  date: "2026-01-15T13:00:00Z",
  productName: "New Member",
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

  test("should render member alerts in history", async () => {
    const alerts: AlertMessage[] = [makeCharge(5000), makeMember()];
    const result = await (<AlertsPage alerts={alerts} />);

    expect(result).toContain("New Member");
    expect(result).toContain("Membership");
  });

  test("should show waiting message with empty alerts", async () => {
    const result = await (<AlertsPage alerts={[]} />);

    expect(result).toContain("Waiting for donations");
  });
});
