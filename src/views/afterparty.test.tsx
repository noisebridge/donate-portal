import { describe, expect, test } from "bun:test";
import { AfterpartyPage } from "./afterparty";

const price = { cents: 6400 };

describe("AfterpartyPage", () => {
  test("shows the public sales count and limits quantity to remaining capacity", async () => {
    const result = await (
      <AfterpartyPage
        availability={{ capacity: 150, sold: 145, claimed: 145, remaining: 5 }}
        price={price}
      />
    );

    expect(result).toContain("145 of 150 sold");
    expect(result).toContain('data-max="5"');
    expect(result).toContain("Minimum $13.37 per");
    expect(result).toContain('href="https://noisebridge.net/"');
    expect(result).toContain('class="poster-calendar"');
    expect(result).not.toContain("Add to calendar");
  });

  test("shows sold out and removes the purchase form at capacity", async () => {
    const result = await (
      <AfterpartyPage
        availability={{ capacity: 150, sold: 150, claimed: 150, remaining: 0 }}
        price={price}
      />
    );

    expect(result).toContain("150 of 150 sold");
    expect(result).toContain("Sold out.");
    expect(result).not.toContain('id="afterparty-form"');
  });

  test("distinguishes active checkout holds from sold tickets", async () => {
    const result = await (
      <AfterpartyPage
        availability={{ capacity: 150, sold: 149, claimed: 150, remaining: 0 }}
        price={price}
      />
    );

    expect(result).toContain("149 of 150 sold");
    expect(result).toContain("currently held in checkout");
    expect(result).not.toContain('id="afterparty-form"');
  });

  test("fails closed when availability cannot be loaded", async () => {
    const result = await (<AfterpartyPage availability={null} price={price} />);

    expect(result).toContain("availability is temporarily unavailable");
    expect(result).not.toContain('id="afterparty-form"');
  });
});
