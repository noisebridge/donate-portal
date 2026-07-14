import { describe, expect, test } from "bun:test";
import { AfterpartyPage } from "./afterparty";

const price = { cents: 6400 };

describe("AfterpartyPage", () => {
  test("renders a fail-closed shell while availability loads", async () => {
    const result = await (<AfterpartyPage price={price} />);

    expect(result).toContain("Checking availability…");
    expect(result).toContain(
      'data-availability-url="/afterparty/availability"',
    );
    expect(result).toContain('data-max-quantity="20"');
    expect(result).toContain("Minimum $13.37 per");
    expect(result).toContain('href="https://noisebridge.net/"');
    expect(result).toContain('class="poster-calendar"');
    expect(result).toContain('datetime="2026-07-19T21:00:00-07:00"');
    expect(result).toContain("9pm-1am");
    expect(result).not.toContain("Add to calendar");
    expect(result).toContain(
      '<button type="submit" class="ticket-submit" disabled>',
    );
    expect(result).toContain('id="email"');
    expect(result).toContain('id="price-input"');
  });
});
