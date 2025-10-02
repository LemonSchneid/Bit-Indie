import { useReducer } from "react";

export const LANDING_SCREEN_SEQUENCE = [1, 2, 3, 4] as const;

export type LandingScreen = (typeof LANDING_SCREEN_SEQUENCE)[number];

type SelectScreenEvent = { type: "SELECT"; screen: LandingScreen };
type NextScreenEvent = { type: "NEXT" };
type PreviousScreenEvent = { type: "PREVIOUS" };

export type LandingScreenEvent = SelectScreenEvent | NextScreenEvent | PreviousScreenEvent;

function clampScreen(value: number): LandingScreen {
  if (value <= LANDING_SCREEN_SEQUENCE[0]) {
    return LANDING_SCREEN_SEQUENCE[0];
  }

  if (value >= LANDING_SCREEN_SEQUENCE[LANDING_SCREEN_SEQUENCE.length - 1]) {
    return LANDING_SCREEN_SEQUENCE[LANDING_SCREEN_SEQUENCE.length - 1];
  }

  return value as LandingScreen;
}

function getNextScreen(current: LandingScreen): LandingScreen {
  const index = LANDING_SCREEN_SEQUENCE.indexOf(current);
  const next = LANDING_SCREEN_SEQUENCE[index + 1];
  return next ?? current;
}

function getPreviousScreen(current: LandingScreen): LandingScreen {
  const index = LANDING_SCREEN_SEQUENCE.indexOf(current);
  const previous = LANDING_SCREEN_SEQUENCE[index - 1];
  return previous ?? current;
}

export function landingScreenReducer(
  state: LandingScreen,
  event: LandingScreenEvent,
): LandingScreen {
  switch (event.type) {
    case "SELECT": {
      if (event.screen === state) {
        return state;
      }
      return clampScreen(event.screen);
    }
    case "NEXT":
      return getNextScreen(state);
    case "PREVIOUS":
      return getPreviousScreen(state);
    default:
      return state;
  }
}

export function useLandingScreenMachine(initialScreen: LandingScreen = LANDING_SCREEN_SEQUENCE[0]): {
  activeScreen: LandingScreen;
  selectScreen: (screen: LandingScreen) => void;
  goToNextScreen: () => void;
  goToPreviousScreen: () => void;
} {
  const [activeScreen, dispatch] = useReducer(landingScreenReducer, initialScreen);

  return {
    activeScreen,
    selectScreen: (screen: LandingScreen) => dispatch({ type: "SELECT", screen }),
    goToNextScreen: () => dispatch({ type: "NEXT" }),
    goToPreviousScreen: () => dispatch({ type: "PREVIOUS" }),
  };
}
