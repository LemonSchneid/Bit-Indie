"use client";

import { useMemo, useReducer } from "react";

import type { GameDetail } from "./types";

/**
 * Enumerates the available high-level screens for the home page.
 */
export enum HomeScreen {
  Storefront = "STOREFRONT",
  SellGame = "SELL_GAME",
  InfoForPlayers = "INFO_FOR_PLAYERS",
  PlatformRoadmap = "PLATFORM_ROADMAP",
}

type ScreenState = {
  mode: "screen";
  screen: HomeScreen;
};

type GameDetailState = {
  mode: "gameDetail";
  screen: HomeScreen.Storefront;
  game: GameDetail;
};

type CheckoutState = {
  mode: "checkout";
  screen: HomeScreen.Storefront;
  game: GameDetail;
};

export type HomeState = ScreenState | GameDetailState | CheckoutState;

export type HomeEvent =
  | { type: "SELECT_SCREEN"; screen: HomeScreen }
  | { type: "VIEW_GAME_DETAIL"; game: GameDetail }
  | { type: "VIEW_CHECKOUT" }
  | { type: "CLOSE_CHECKOUT" }
  | { type: "EXIT_GAME_DETAIL" };

export const initialHomeState: HomeState = {
  mode: "screen",
  screen: HomeScreen.Storefront,
};

/**
 * Pure reducer driving the home page finite-state machine.
 *
 * Each transition resets derived state to avoid dangling selection or checkout
 * toggles when moving between views. The machine intentionally restricts game
 * detail and checkout states to the storefront flow while keeping navigation to
 * other screens explicit.
 */
export function homeStateReducer(state: HomeState, event: HomeEvent): HomeState {
  switch (event.type) {
    case "SELECT_SCREEN": {
      return { mode: "screen", screen: event.screen };
    }
    case "VIEW_GAME_DETAIL": {
      return { mode: "gameDetail", screen: HomeScreen.Storefront, game: event.game };
    }
    case "VIEW_CHECKOUT": {
      if (state.mode === "gameDetail" || state.mode === "checkout") {
        return { mode: "checkout", screen: HomeScreen.Storefront, game: state.game };
      }
      return state;
    }
    case "CLOSE_CHECKOUT": {
      if (state.mode === "checkout") {
        return { mode: "gameDetail", screen: HomeScreen.Storefront, game: state.game };
      }
      return state;
    }
    case "EXIT_GAME_DETAIL": {
      if (state.mode === "gameDetail" || state.mode === "checkout") {
        return { mode: "screen", screen: HomeScreen.Storefront };
      }
      return state;
    }
    default: {
      return state;
    }
  }
}

/**
 * React hook wrapper around the home page state machine.
 */
export function useHomeStateMachine() {
  const [state, dispatch] = useReducer(homeStateReducer, initialHomeState);

  const controls = useMemo(
    () => ({
      selectScreen: (screen: HomeScreen) => dispatch({ type: "SELECT_SCREEN", screen }),
      viewGameDetail: (game: GameDetail) => dispatch({ type: "VIEW_GAME_DETAIL", game }),
      openCheckout: () => dispatch({ type: "VIEW_CHECKOUT" }),
      closeCheckout: () => dispatch({ type: "CLOSE_CHECKOUT" }),
      exitGameDetail: () => dispatch({ type: "EXIT_GAME_DETAIL" }),
    }),
    [],
  );

  return { state, controls };
}

