import { describe, expect, test } from "bun:test";
import * as donationManager from "~/managers/donation";
import { QrEditorPage } from "./qr-editor";

describe("QrEditorPage", () => {
  test("should set name maxlength from donationManager.MAX_NAME_LENGTH", async () => {
    const result = await (
      <QrEditorPage isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain(`maxlength="${donationManager.MAX_NAME_LENGTH}"`);
  });

  test("should set description maxlength from donationManager.MAX_DESCRIPTION_LENGTH", async () => {
    const result = await (
      <QrEditorPage isAuthenticated={false} csrfToken={undefined} />
    );

    expect(result).toContain(
      `maxlength="${donationManager.MAX_DESCRIPTION_LENGTH}"`,
    );
  });
});
