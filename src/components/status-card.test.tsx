import { describe, expect, test } from "bun:test";
import { StatusCard } from "./status-card";

describe("StatusCard", () => {
  test("renders the icon, title and children", async () => {
    const result = await (
      <StatusCard icon={<svg class="icon" />} title="All good">
        <p>Everything worked.</p>
      </StatusCard>
    );

    expect(result).toBeTypeOf("string");
    expect(result).toContain('class="page-icon-wrapper"');
    expect(result).toContain('class="icon"');
    expect(result).toContain('<h1 class="page-title">All good</h1>');
    expect(result).toContain("<p>Everything worked.</p>");
  });

  test("escapes the title", async () => {
    const result = await (
      <StatusCard icon={<svg />} title={'<script>alert("x")</script>'} />
    );

    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  test("renders without children", async () => {
    const result = await (<StatusCard icon={<svg />} title="Bare" />);

    expect(result).toContain('class="card text-center offset-frame"');
  });
});
