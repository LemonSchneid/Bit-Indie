import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { __modalTesting } from "./modal";

test("modal content renders overlay structure", () => {
  const html = renderToStaticMarkup(
    <__modalTesting.ModalContent
      onClose={() => undefined}
      shouldCloseOnBackdrop
      containerClassName="items-center"
      contentClassName="w-48"
      backdropClassName="bg-slate-950/80"
      backdropAriaLabel="Close test modal"
      ariaLabel="Example modal"
    >
      <div>Modal body</div>
    </__modalTesting.ModalContent>,
  );

  assert.ok(html.includes("fixed inset-0"), "overlay should cover the viewport");
  assert.ok(html.includes("aria-modal=\"true\""));
  assert.ok(html.includes("bg-slate-950/80"));
  assert.ok(html.includes("w-48"));
});

test("body scroll lock preserves original overflow", () => {
  const element = { style: { overflow: "auto" } } as unknown as HTMLElement;

  __modalTesting.lockBodyScrollForTesting(element);
  assert.equal(element.style.overflow, "hidden");

  __modalTesting.lockBodyScrollForTesting(element);
  assert.equal(element.style.overflow, "hidden", "nested locks keep body hidden");

  __modalTesting.unlockBodyScrollForTesting(element);
  assert.equal(element.style.overflow, "hidden", "one unlock still keeps lock active");

  __modalTesting.unlockBodyScrollForTesting(element);
  assert.equal(element.style.overflow, "auto", "final unlock restores original value");

  __modalTesting.resetScrollLocks();
});
