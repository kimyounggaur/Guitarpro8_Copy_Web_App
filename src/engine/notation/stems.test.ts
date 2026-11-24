import { expect, it } from "vitest";
import { createDefaultStylesheet } from "../../model/stylesheet";
import { chooseStemDirection, chordHeadOffsets, restStaffPosition, stemEndPosition } from "./stems";

const style = createDefaultStylesheet().notation;

it("prefers an explicit stem and then uses per-voice preferences", () => {
  expect(chooseStemDirection([10], "up", 0, 1, style)).toBe("up");
  expect(chooseStemDirection([10], "auto", 0, 2, style)).toBe("up");
  expect(chooseStemDirection([-8], "auto", 1, 2, style)).toBe("down");
  expect(chooseStemDirection([10], "auto", 0, 2, { ...style, stemDirectionVoice1: "down" })).toBe("down");
});

it("uses the furthest note relative to the middle line and projects ledger note stems towards it", () => {
  expect(chooseStemDirection([-7, 8], "auto", 0, 1, style)).toBe("up");
  expect(chooseStemDirection([3, 10], "auto", 0, 1, style)).toBe("down");
  expect(stemEndPosition([-7], "up")).toBe(4);
  expect(stemEndPosition([8], "up")).toBe(15);
  expect(stemEndPosition([16], "down")).toBe(4);
});

it("alternates displaced noteheads on adjacent diatonic seconds", () => {
  expect(chordHeadOffsets([1, 2, 3, 7], "up", 9)).toEqual([0, 9, 0, 0]);
  expect(chordHeadOffsets([1, 2, 3, 7], "down", 9)).toEqual([0, -9, 0, 0]);
});

it("positions multiple-voice rests using the configured voice side", () => {
  expect(restStaffPosition(0, 1, style)).toBe(4);
  expect(restStaffPosition(0, 2, style)).toBe(6);
  expect(restStaffPosition(1, 2, style)).toBe(2);
  expect(restStaffPosition(0, 2, { ...style, restPositionVoice1: "below" })).toBe(2);
});
