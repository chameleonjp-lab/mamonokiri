import { COMBAT_LANE_SPACING } from "./rules";
import type { Lane } from "./rules";

/** The combat space is deliberately independent from the viewport aspect ratio. */
export const COMBAT_SIDE_X = COMBAT_LANE_SPACING;
export const COMBAT_MIN_X = -COMBAT_SIDE_X;
export const COMBAT_MAX_X = COMBAT_SIDE_X;

export const CAMERA_TARGET = Object.freeze([0, 1.05, 2.2] as const);
export const CAMERA_BASE_POSITION = Object.freeze([7.6, 5.2, -8.5] as const);
export const CAMERA_BASE_FOV = 0.8;

export function laneX(lane: Lane): number {
  return lane * COMBAT_LANE_SPACING;
}

export function dodgeTargetX(direction: number): number {
  return direction < 0 ? COMBAT_MIN_X : COMBAT_MAX_X;
}

export function clampCombatX(value: number): number {
  return Math.max(COMBAT_MIN_X, Math.min(COMBAT_MAX_X, value));
}

export function laneFromX(value: number): Lane {
  if (value < -COMBAT_LANE_SPACING / 2) return -1;
  if (value > COMBAT_LANE_SPACING / 2) return 1;
  return 0;
}

export type CameraFrame = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Keep the same combat rectangle visible on portrait and landscape screens.
 * A portrait viewport gets a little more camera distance; gameplay coordinates
 * never depend on this calculation.
 */
export function cameraFrameForViewport(
  width: number,
  height: number
): CameraFrame {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const aspect = safeWidth / safeHeight;
  const portraitAmount = clamp((0.78 / aspect - 1) / 1.2, 0, 1);
  const distanceScale = 1 + portraitAmount * 0.24;
  const target: readonly [number, number, number] = CAMERA_TARGET;
  const position: readonly [number, number, number] = [
    target[0] + (CAMERA_BASE_POSITION[0] - target[0]) * distanceScale,
    target[1] + (CAMERA_BASE_POSITION[1] - target[1]) * distanceScale,
    target[2] + (CAMERA_BASE_POSITION[2] - target[2]) * distanceScale,
  ];
  return {
    position,
    target,
    fov: CAMERA_BASE_FOV + portraitAmount * 0.035,
  };
}
