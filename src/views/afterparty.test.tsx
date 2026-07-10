import { describe, expect, test } from "bun:test";
import { AfterpartyPage } from "./afterparty";

describe("AfterpartyPage", () => {
  test("caps the order quantity at the remaining capacity", async () => {
    const result = await (
      <AfterpartyPage
        price={{ cents: 2500 }}
        remainingTickets={3}
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain('data-max="3"');
    expect(result).toContain("3 left");
    expect(result).toContain('href="/afterparty.ics"');
  });

  test("shows sold out without a waitlist when capacity is exhausted", async () => {
    const result = await (
      <AfterpartyPage
        price={{ cents: 2500 }}
        remainingTickets={0}
        isAuthenticated={false}
        csrfToken={undefined}
      />
    );

    expect(result).toContain("Sold out");
    expect(result).not.toContain('id="afterparty-form"');
    expect(result.toLowerCase()).not.toContain("waitlist");
  });
});
