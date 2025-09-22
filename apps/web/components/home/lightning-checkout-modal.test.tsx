import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ModalProps } from "../ui/modal";

const modalModulePath = require.resolve("../ui/modal");

const mockGame = {
  id: "game-test",
  title: "Test Game",
  status: "FEATURED",
  category: "EARLY ACCESS",
  version: "1.0.0",
  lastUpdated: "2024-01-01",
  description: [] as string[],
  coverArt: "",
  developer: "Orbit Foundry",
  lightningAddress: "piteousfrench82@walletofsatoshi.com",
  priceSats: 150,
  tipRecommended: 300,
} as const;

test("lightning checkout modal wires modal props and content", async () => {
  let capturedProps: ModalProps | null = null;

  const originalExports = { ...require(modalModulePath) } as Record<string, unknown>;
  const cachedModule = require.cache?.[modalModulePath];
  assert.ok(cachedModule, "modal module should be cached");

  cachedModule.exports = {
    ...originalExports,
    Modal: (props: ModalProps) => {
      capturedProps = props;
      return <div data-testid="lightning-modal">{props.children}</div>;
    },
  };

  try {
    const { LightningCheckoutModal } = await import("./lightning-checkout-modal");

    const onClose = () => undefined;
    const html = renderToStaticMarkup(
      <LightningCheckoutModal onClose={onClose} game={{ ...mockGame }} />,
    );

    assert.ok(capturedProps, "modal props should be captured from stub");
    const props = capturedProps as ModalProps;
    assert.equal(props.isOpen, true);
    assert.equal(props.onClose, onClose);
    assert.ok(
      props.containerClassName?.includes("items-center"),
      "container classes should include centering utilities",
    );
    assert.ok(html.includes("Lightning checkout"));
    assert.ok(html.includes("BOLT11 invoice"));
    assert.ok(html.includes("Purchase summary"));
  } finally {
    cachedModule.exports = originalExports;
  }
});
