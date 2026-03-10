import { describe, expect, it } from "vitest";
import { formatTicket } from "./formatTicket";

describe("formatTicket", () => {
  it("formats ticket numbers with prefix and left pad", () => {
    expect(formatTicket("CG", 1)).toBe("CG-001");
  });

  it("rounds down decimal numbers before formatting", () => {
    expect(formatTicket("PD", 12.8)).toBe("PD-012");
  });

  it("clamps negative numbers to zero", () => {
    expect(formatTicket("EX", -4)).toBe("EX-000");
  });
});
