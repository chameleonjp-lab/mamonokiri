import { describe, expect, it } from "vitest";
import {
  CAMERA_BASE_FOV,
  COMBAT_MAX_X,
  COMBAT_MIN_X,
  cameraFrameForViewport,
  clampCombatX,
  dodgeTargetX,
  laneFromX,
  laneX,
} from "./arena";

describe("combat arena coordinates", () => {
  it("uses the same three lane anchors for every viewport", () => {
    expect([laneX(-1), laneX(0), laneX(1)]).toEqual([-0.9, 0, 0.9]);
    expect(dodgeTargetX(-1)).toBe(COMBAT_MIN_X);
    expect(dodgeTargetX(1)).toBe(COMBAT_MAX_X);
    expect(clampCombatX(-2)).toBe(COMBAT_MIN_X);
    expect(clampCombatX(2)).toBe(COMBAT_MAX_X);
  });

  it("classifies the center as a transit lane", () => {
    expect(laneFromX(-0.9)).toBe(-1);
    expect(laneFromX(0)).toBe(0);
    expect(laneFromX(0.9)).toBe(1);
  });

  it.each([
    [320, 568],
    [390, 844],
    [402, 874],
    [430, 932],
    [874, 402],
  ])(
    "keeps a stable target and widens portrait framing at %ix%i",
    (width, height) => {
      const frame = cameraFrameForViewport(width, height);
      expect(frame.target).toEqual([0, 1.05, 2.2]);
      expect(frame.fov).toBeGreaterThanOrEqual(CAMERA_BASE_FOV);
      expect(frame.position.every(Number.isFinite)).toBe(true);
    }
  );

  it("gives portrait view more distance than landscape view", () => {
    const portrait = cameraFrameForViewport(402, 874);
    const landscape = cameraFrameForViewport(874, 402);
    const distance = (position: readonly number[]) =>
      Math.hypot(position[0], position[1] - 1.05, position[2] - 2.2);
    expect(distance(portrait.position)).toBeGreaterThan(
      distance(landscape.position)
    );
  });
});
