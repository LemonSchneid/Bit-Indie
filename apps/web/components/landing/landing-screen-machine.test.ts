import assert from "node:assert/strict";
import test from "node:test";

import {
  LANDING_SCREEN_SEQUENCE,
  landingScreenReducer,
  type LandingScreen,
  type LandingScreenEvent,
} from "./landing-screen-machine";

function runEvents(initial: LandingScreen, events: LandingScreenEvent[]): LandingScreen {
  return events.reduce(landingScreenReducer, initial);
}

test("landingScreenReducer selects an explicit screen", () => {
  const initial = LANDING_SCREEN_SEQUENCE[0];
  const nextState = landingScreenReducer(initial, { type: "SELECT", screen: 3 });
  assert.equal(nextState, 3);
});

test("landingScreenReducer ignores duplicate selections", () => {
  const initial = LANDING_SCREEN_SEQUENCE[1];
  const nextState = landingScreenReducer(initial, { type: "SELECT", screen: initial });
  assert.equal(nextState, initial);
});

test("landingScreenReducer advances through the landing flow", () => {
  const finalState = runEvents(LANDING_SCREEN_SEQUENCE[0], [
    { type: "NEXT" },
    { type: "NEXT" },
    { type: "NEXT" },
  ]);
  assert.equal(finalState, LANDING_SCREEN_SEQUENCE[LANDING_SCREEN_SEQUENCE.length - 1]);
});

test("landingScreenReducer does not advance past the final screen", () => {
  const initial = LANDING_SCREEN_SEQUENCE[LANDING_SCREEN_SEQUENCE.length - 1];
  const nextState = landingScreenReducer(initial, { type: "NEXT" });
  assert.equal(nextState, initial);
});

test("landingScreenReducer walks backwards through the landing flow", () => {
  const startingState = LANDING_SCREEN_SEQUENCE[3];
  const finalState = runEvents(startingState, [
    { type: "PREVIOUS" },
    { type: "PREVIOUS" },
  ]);
  assert.equal(finalState, LANDING_SCREEN_SEQUENCE[1]);
});

test("landingScreenReducer clamps selections outside of the known sequence", () => {
  const initial = LANDING_SCREEN_SEQUENCE[1];
  const belowRange = landingScreenReducer(initial, { type: "SELECT", screen: 0 as LandingScreen });
  assert.equal(belowRange, LANDING_SCREEN_SEQUENCE[0]);

  const aboveRange = landingScreenReducer(initial, { type: "SELECT", screen: 42 as LandingScreen });
  assert.equal(aboveRange, LANDING_SCREEN_SEQUENCE[LANDING_SCREEN_SEQUENCE.length - 1]);
});
