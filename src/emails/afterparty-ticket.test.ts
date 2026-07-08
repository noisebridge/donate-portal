import { describe, expect, test } from "bun:test";
import { AfterpartyTicketEmail } from "./afterparty-ticket";

describe("AfterpartyTicketEmail", () => {
  test("shows the attendee count and total for multiple tickets", async () => {
    const result = await AfterpartyTicketEmail({
      quantity: 3,
      amount: { cents: 7500 },
    });

    expect(result).toBeTypeOf("string");
    expect(result).toInclude("$75.00");
    expect(result).toInclude("3 tickets");
  });

  test("uses singular wording for a single ticket", async () => {
    const result = await AfterpartyTicketEmail({
      quantity: 1,
      amount: { cents: 2500 },
    });

    expect(result).toInclude("1 ticket");
    expect(result).not.toInclude("1 tickets");
  });
});
