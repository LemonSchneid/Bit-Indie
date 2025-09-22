import assert from "node:assert/strict";
import test from "node:test";

import { gameDetails } from "./data";
import {
  HomeScreen,
  homeStateReducer,
  initialHomeState,
  type HomeState,
} from "./home-state-machine";

test("selecting a screen transitions to the requested view", () => {
  const nextState = homeStateReducer(initialHomeState, {
    type: "SELECT_SCREEN",
    screen: HomeScreen.SellGame,
  });

  assert.equal(nextState.mode, "screen");
  assert.equal(nextState.screen, HomeScreen.SellGame);
});

test("viewing a game detail locks the machine to the storefront flow", () => {
  const [firstGame] = Object.values(gameDetails);
  assert.ok(firstGame, "test data should provide at least one game detail");

  const detailState = homeStateReducer(initialHomeState, {
    type: "VIEW_GAME_DETAIL",
    game: firstGame,
  });

  assert.equal(detailState.mode, "gameDetail");
  assert.equal(detailState.screen, HomeScreen.Storefront);
  assert.equal(detailState.game.title, firstGame.title);

  const checkoutState = homeStateReducer(detailState, { type: "VIEW_CHECKOUT" });
  assert.equal(checkoutState.mode, "checkout");
  assert.equal(checkoutState.game.title, firstGame.title);

  const closedCheckoutState = homeStateReducer(checkoutState, { type: "CLOSE_CHECKOUT" });
  assert.equal(closedCheckoutState.mode, "gameDetail");
  assert.equal(closedCheckoutState.game.title, firstGame.title);
});

test("exiting the game detail returns to the storefront screen", () => {
  const sampleGame = Object.values(gameDetails)[0];
  assert.ok(sampleGame, "test data should provide at least one game detail");

  const detailState: HomeState = {
    mode: "checkout",
    screen: HomeScreen.Storefront,
    game: sampleGame,
  };

  const exitState = homeStateReducer(detailState, { type: "EXIT_GAME_DETAIL" });

  assert.equal(exitState.mode, "screen");
  assert.equal(exitState.screen, HomeScreen.Storefront);
});

