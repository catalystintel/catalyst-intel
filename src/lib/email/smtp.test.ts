import { afterEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (...args: unknown[]) => createTransport(...args),
  },
}));

describe("smtp email", () => {
  const previous = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_SECURE: process.env.SMTP_SECURE,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    sendMail.mockReset();
    createTransport.mockClear();
    vi.resetModules();
  });

  function setSmtpEnv() {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "alerts@example.com";
    process.env.SMTP_PASS = "app-password";
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_SECURE;
  }

  it("isSmtpConfigured requires host, user, and pass", async () => {
    setSmtpEnv();
    const { isSmtpConfigured } = await import("./smtp");
    expect(isSmtpConfigured()).toBe(true);
    delete process.env.SMTP_PASS;
    expect(isSmtpConfigured()).toBe(false);
  });

  it("defaults From to SMTP_USER", async () => {
    setSmtpEnv();
    const { smtpFromAddress } = await import("./smtp");
    expect(smtpFromAddress()).toBe("Catalyst Intel <alerts@example.com>");
  });

  it("sends via nodemailer and reports success", async () => {
    setSmtpEnv();
    sendMail.mockResolvedValue({ messageId: "1" });
    const { sendSmtpEmail } = await import("./smtp");
    const result = await sendSmtpEmail({
      to: "user@example.com",
      subject: "Alert",
      text: "Body",
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/SMTP/i);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: "alerts@example.com", pass: "app-password" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Catalyst Intel <alerts@example.com>",
        to: ["user@example.com"],
        subject: "Alert",
        text: "Body",
      }),
    );
  });

  it("fails clearly when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const { sendSmtpEmail } = await import("./smtp");
    const result = await sendSmtpEmail({
      to: "user@example.com",
      subject: "Alert",
      text: "Body",
    });
    expect(result.ok).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("surfaces transport errors without throwing", async () => {
    setSmtpEnv();
    sendMail.mockRejectedValue(new Error("Invalid login"));
    const { sendSmtpEmail } = await import("./smtp");
    const result = await sendSmtpEmail({
      to: "user@example.com",
      subject: "Alert",
      text: "Body",
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Invalid login");
  });
});
