import { describe, expect, it } from "vitest";

import { DEFAULT_FEEDBACK_TO_EMAIL, feedbackInbox } from "@/lib/email/resend";

describe("feedbackInbox", () => {
  it("defaults to the Catalyst feedback Gmail", () => {
    expect(DEFAULT_FEEDBACK_TO_EMAIL).toBe("catalyst.intel.feedback@gmail.com");
    const previous = process.env.FEEDBACK_TO_EMAIL;
    delete process.env.FEEDBACK_TO_EMAIL;
    expect(feedbackInbox()).toBe(DEFAULT_FEEDBACK_TO_EMAIL);
    if (previous === undefined) {
      delete process.env.FEEDBACK_TO_EMAIL;
    } else {
      process.env.FEEDBACK_TO_EMAIL = previous;
    }
  });
});
