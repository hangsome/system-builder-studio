import { describe, expect, it } from "vitest";
import { validateConnection } from "@/lib/connectionValidator";
import type { Connection, PlacedComponent } from "@/types/simulator";

const microbit: PlacedComponent = {
  instanceId: "microbit-1",
  definitionId: "microbit",
  position: { x: 0, y: 0 },
};

const expansionBoard: PlacedComponent = {
  instanceId: "expansion-1",
  definitionId: "expansion-board",
  position: { x: 0, y: 0 },
};

const obloq: PlacedComponent = {
  instanceId: "obloq-1",
  definitionId: "obloq",
  position: { x: 0, y: 0 },
};

describe("validateConnection", () => {
  it("accepts valid power connections", () => {
    const result = validateConnection(
      microbit.instanceId,
      "3v",
      expansionBoard.instanceId,
      "slot-3v",
      [microbit, expansionBoard],
      [],
    );

    expect(result.valid).toBe(true);
    expect(result.type).toBe("power");
  });

  it("rejects connections on the same component", () => {
    const result = validateConnection(
      microbit.instanceId,
      "p0",
      microbit.instanceId,
      "p1",
      [microbit],
      [],
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid serial connections", () => {
    const result = validateConnection(
      obloq.instanceId,
      "tx",
      expansionBoard.instanceId,
      "tx",
      [obloq, expansionBoard],
      [],
    );

    expect(result.valid).toBe(false);
    expect(result.type).toBe("serial");
  });

  it("warns when pins are already connected", () => {
    const existing: Connection[] = [
      {
        id: "conn-1",
        fromComponent: microbit.instanceId,
        fromPin: "p0",
        toComponent: expansionBoard.instanceId,
        toPin: "slot-p0",
        type: "data",
        valid: true,
      },
    ];

    const result = validateConnection(
      microbit.instanceId,
      "p0",
      expansionBoard.instanceId,
      "slot-p1",
      [microbit, expansionBoard],
      existing,
    );

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
