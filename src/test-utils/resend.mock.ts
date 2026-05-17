import { mock } from "bun:test";
import type { Resend } from "resend";

type SendResponse = Awaited<ReturnType<Resend["emails"]["send"]>>;

export const send = mock(
  (): Promise<SendResponse> =>
    Promise.resolve({ data: { id: "email_mock" }, error: null, headers: null }),
);

mock.module("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
