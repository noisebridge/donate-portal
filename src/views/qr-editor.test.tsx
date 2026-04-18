import { describe, expect, test } from "bun:test";
import { DonationManager } from "~/managers/donation";
import { QrEditorPage } from "./qr-editor";

describe("QrEditorPage", () => {
  test("should render when not authenticated", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should render when authenticated", async () => {
    const result = await (<QrEditorPage isAuthenticated={true} />);

    expect(result).toBeTypeOf("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should display page title", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain("qr_code_creator");
  });

  test("should contain amount input", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain('id="amount"');
    expect(result).toContain('name="amount"');
  });

  test("should contain name and description inputs", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain('id="name"');
    expect(result).toContain('id="description"');
  });

  test("should contain logo checkbox", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain('id="use-logo"');
    expect(result).toContain("Include Logo");
  });

  test("should contain download buttons", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain('id="download-png"');
    expect(result).toContain("Download PNG");
    expect(result).toContain('id="download-svg"');
    expect(result).toContain("Download SVG");
  });

  test("should contain QR preview area", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain('id="qr-image"');
    expect(result).toContain('id="qr-placeholder"');
  });

  test("should contain QR URL display", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain('id="qr-url"');
  });

  test("should set name maxlength from DonationManager.maxNameLength", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain(`maxlength="${DonationManager.maxNameLength}"`);
  });

  test("should set description maxlength from DonationManager.maxDescriptionLength", async () => {
    const result = await (<QrEditorPage isAuthenticated={false} />);

    expect(result).toContain(
      `maxlength="${DonationManager.maxDescriptionLength}"`,
    );
  });
});
