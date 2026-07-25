import { describe, expect, it } from "vitest";

import { parseOfficerDirectorChange } from "./officer-change";

const ITEM_502_HEADER =
  "Item 5.02: Departure of Directors or Certain Officers; Election of Directors; " +
  "Appointment of Certain Officers; Compensatory Arrangements of Certain Officers";

describe("parseOfficerDirectorChange", () => {
  it("detects CEO resignation from filing body text", () => {
    expect(
      parseOfficerDirectorChange(
        `${ITEM_502_HEADER} On July 20, 2026, Jane Smith resigned as Chief Executive Officer of the Company.`,
      ),
    ).toEqual({ position: "CEO", action: "Departure" });
  });

  it("detects CFO appointment", () => {
    expect(
      parseOfficerDirectorChange(
        "The Board appointed Robert Lee as Chief Financial Officer, effective immediately.",
      ),
    ).toEqual({ position: "CFO", action: "Appointment" });
  });

  it("detects CTO / COO / CMO / President and other C-suite roles", () => {
    expect(
      parseOfficerDirectorChange("The company named Ava Chen as CTO."),
    ).toEqual({ position: "CTO", action: "Appointment" });
    expect(
      parseOfficerDirectorChange(
        "Mark Jones stepped down as Chief Operating Officer.",
      ),
    ).toEqual({ position: "COO", action: "Departure" });
    expect(
      parseOfficerDirectorChange(
        "Elena Ruiz was appointed Chief Marketing Officer.",
      ),
    ).toEqual({ position: "CMO", action: "Appointment" });
    expect(
      parseOfficerDirectorChange("The Board elected Dana Wu as President."),
    ).toEqual({ position: "President", action: "Appointment" });
    expect(
      parseOfficerDirectorChange(
        "Priya Shah resigned as Chief Information Security Officer.",
      ),
    ).toEqual({ position: "CISO", action: "Departure" });
  });

  it("prefers highest-impact role when multiple officers appear", () => {
    expect(
      parseOfficerDirectorChange(
        "The company appointed a new CMO and also announced that the CEO resigned.",
      ),
    ).toEqual({ position: "CEO", action: "Departure" });

    expect(
      parseOfficerDirectorChange(
        "CFO John Doe resigned. Separately, the CTO was appointed last week.",
      ),
    ).toEqual({ position: "CFO", action: "Departure" });
  });

  it("ignores Item 5.02 boilerplate so it does not invent Appointment+Departure", () => {
    expect(parseOfficerDirectorChange(ITEM_502_HEADER)).toEqual({
      position: null,
      action: null,
    });
  });

  it("infers action without a specific C-suite role", () => {
    expect(
      parseOfficerDirectorChange(
        "A senior officer of the Company resigned effective today.",
      ),
    ).toEqual({ position: null, action: "Departure" });

    expect(
      parseOfficerDirectorChange(
        "The Board appointed a new principal operating officer.",
      ),
    ).toEqual({ position: null, action: "Appointment" });
  });

  it("joins multiple text fragments (summary + title)", () => {
    expect(
      parseOfficerDirectorChange(
        ITEM_502_HEADER,
        "Acme Corp — Executive Change — CEO/CFO Departure or Appointment",
        "On June 1, 2026, the Board named Lisa Park Chief Technology Officer.",
      ),
    ).toEqual({ position: "CTO", action: "Appointment" });
  });
});
