import { describe, expect, it } from "vitest";

import { GOOGLE_OAUTH_QUERY_PARAMS, googleOAuthOptions } from "./google-oauth";

describe("googleOAuthOptions", () => {
  it("forces Google account chooser on every sign-in start", () => {
    expect(GOOGLE_OAUTH_QUERY_PARAMS.prompt).toBe("select_account");
    expect(
      googleOAuthOptions(
        "https://example.com/auth/callback?next=%2Fcatalyst-feed",
      ),
    ).toEqual({
      redirectTo: "https://example.com/auth/callback?next=%2Fcatalyst-feed",
      queryParams: { prompt: "select_account" },
    });
  });
});
