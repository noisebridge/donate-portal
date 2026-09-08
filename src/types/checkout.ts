/**
 * JSON answered by the checkout endpoints (`POST /donate`, `POST /subscribe`)
 * when the client posts the form with `Accept: application/json`. The client
 * pins its own type guards to these, so a rename here fails the build there.
 * See `src/assets/js/util/stripe.mjs`.
 */

/** The request can't proceed in-page; send the browser somewhere else. */
export interface RedirectResponse {
  redirect: string;
}

/** Payment is ready to be confirmed in the checkout modal. */
export interface CheckoutResponse {
  clientSecret: string;
  emailAddress: string | null;
}

export type CheckoutJsonResponse = RedirectResponse | CheckoutResponse;
