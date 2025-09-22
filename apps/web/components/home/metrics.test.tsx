import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";

import { MetricRow } from "./metrics";

test("MetricRow renders default variant styles", () => {
  const html = renderToString(<MetricRow label="Rating" value="4.8 / 5" />);

  assert.ok(html.includes("flex items-center justify-between"));
  assert.ok(html.includes("uppercase tracking-[0.35em] text-emerald-200/70"));
  assert.ok(html.includes("font-semibold text-emerald-200"));
});

test("MetricRow renders compact variant styles", () => {
  const html = renderToString(
    <MetricRow variant="compact" label="API LATENCY" value="230ms" />,
  );

  assert.ok(html.includes("flex justify-between"));
  assert.ok(html.includes("uppercase tracking-[0.4em] text-emerald-200/70"));
});
