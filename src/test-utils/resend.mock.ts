import { mock } from "bun:test";

type SendResponse =
  | { data: { id: string }; error: null }
  | { data: null; error: { message: string } };

export const send = mock(
  (): Promise<SendResponse> =>
    Promise.resolve({ data: { id: "email_mock" }, error: null }),
);

mock.module("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
