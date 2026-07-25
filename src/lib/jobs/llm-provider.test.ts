import { afterEach, describe, expect, it } from "vitest";

import {
  getOpenRouterApiKeys,
  getOpenRouterModel,
  isOpenRouterConfigured,
  resetOpenRouterRoundRobin,
} from "./llm-provider";

const ORIGINAL = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_API_KEYS: process.env.OPENROUTER_API_KEYS,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
};

afterEach(() => {
  for (const key of [
    "OPENROUTER_API_KEY",
    "OPENROUTER_API_KEYS",
    "OPENROUTER_MODEL",
  ] as const) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetOpenRouterRoundRobin();
});

describe("getOpenRouterApiKeys", () => {
  it("returns empty when unset", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEYS;
    expect(getOpenRouterApiKeys()).toEqual([]);
    expect(isOpenRouterConfigured()).toBe(false);
  });

  it("parses a singular key", () => {
    delete process.env.OPENROUTER_API_KEYS;
    process.env.OPENROUTER_API_KEY = " sk-or-one ";
    expect(getOpenRouterApiKeys()).toEqual(["sk-or-one"]);
    expect(isOpenRouterConfigured()).toBe(true);
  });

  it("prefers comma-separated pool over singular", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-ignored";
    process.env.OPENROUTER_API_KEYS = " sk-a , ,sk-b, sk-c ";
    expect(getOpenRouterApiKeys()).toEqual(["sk-a", "sk-b", "sk-c"]);
  });
});

describe("getOpenRouterModel", () => {
  it("defaults to a current OpenRouter free model", () => {
    delete process.env.OPENROUTER_MODEL;
    expect(getOpenRouterModel()).toBe("openai/gpt-oss-20b:free");
  });

  it("allows override", () => {
    process.env.OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it:free";
    expect(getOpenRouterModel()).toBe("google/gemma-4-26b-a4b-it:free");
  });
});
