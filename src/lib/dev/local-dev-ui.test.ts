import { afterEach, describe, expect, it, vi } from "vitest";

import { isLocalDevUi } from "./local-dev-ui";

describe("isLocalDevUi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isLocalDevUi()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalDevUi()).toBe(false);

    vi.stubEnv("NODE_ENV", "test");
    expect(isLocalDevUi()).toBe(false);
  });
});
