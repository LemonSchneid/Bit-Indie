import assert from "node:assert/strict";
import test from "node:test";

import { fetchLnurlPayParams, requestLnurlInvoice, resolveLightningPayEndpoint } from "./lightning";

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_GENERATOR = [
  0x3b6a57b2,
  0x26508e6d,
  0x1ea119fa,
  0x3d4233dd,
  0x2a1462b3,
];

function bech32Polymod(values: number[]): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let index = 0; index < BECH32_GENERATOR.length; index += 1) {
      if (((top >>> index) & 1) !== 0) {
        checksum ^= BECH32_GENERATOR[index];
      }
    }
  }
  return checksum;
}

function bech32HumanReadablePartExpand(hrp: string): number[] {
  const result: number[] = [];
  for (let index = 0; index < hrp.length; index += 1) {
    const code = hrp.charCodeAt(index);
    result.push(code >>> 5);
  }
  result.push(0);
  for (let index = 0; index < hrp.length; index += 1) {
    result.push(hrp.charCodeAt(index) & 31);
  }
  return result;
}

function bech32CreateChecksum(hrp: string, words: number[]): number[] {
  const values = [...bech32HumanReadablePartExpand(hrp), ...words, 0, 0, 0, 0, 0, 0];
  const mod = bech32Polymod(values) ^ 1;
  const checksum: number[] = [];
  for (let index = 0; index < 6; index += 1) {
    checksum.push((mod >> (5 * (5 - index))) & 31);
  }
  return checksum;
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let accumulator = 0;
  let bits = 0;
  const maxValue = (1 << to) - 1;
  const result: number[] = [];

  for (const value of data) {
    accumulator = (accumulator << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      result.push((accumulator >> bits) & maxValue);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((accumulator << (to - bits)) & maxValue);
    }
  } else if (bits >= from || ((accumulator << (to - bits)) & maxValue) !== 0) {
    throw new Error("Invalid padding in bech32 data.");
  }

  return result;
}

function encodeLnurl(url: string): string {
  const encoder = new TextEncoder();
  const data = Array.from(encoder.encode(url));
  const words = convertBits(data, 8, 5, true);
  const checksum = bech32CreateChecksum("lnurl", words);
  const combined = [...words, ...checksum];
  return `lnurl1${combined.map((value) => BECH32_CHARSET[value]).join("")}`;
}

test("resolveLightningPayEndpoint", async (t) => {
  await t.test("translates lightning addresses to well-known LNURL endpoints", () => {
    assert.equal(
      resolveLightningPayEndpoint({
        lightningAddress: "alice@example.com",
      }),
      "https://example.com/.well-known/lnurlp/alice",
    );
  });

  await t.test("returns explicit LNURL https endpoints unchanged", () => {
    assert.equal(
      resolveLightningPayEndpoint({
        lnurl: "https://pay.example.com/lnurl",
      }),
      "https://pay.example.com/lnurl",
    );
  });

  await t.test("decodes bech32 LNURL values", () => {
    const encoded = encodeLnurl("https://pay.example.com/lnurl?tag=payRequest");
    assert.equal(
      resolveLightningPayEndpoint({
        lnurl: encoded,
      }),
      "https://pay.example.com/lnurl?tag=payRequest",
    );
  });

  await t.test("throws when neither destination is provided", () => {
    assert.throws(() => resolveLightningPayEndpoint({ lnurl: null, lightningAddress: null }));
  });

  await t.test("rejects unsupported LNURL formats", () => {
    assert.throws(() =>
      resolveLightningPayEndpoint({
        lnurl: "not-valid",
      }),
    );
  });
});

async function withMockedFetch<T>(implementation: typeof fetch, action: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation as typeof fetch;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("LNURL requests", async (t) => {
  await t.test("fetches and normalizes LNURL pay parameters", async () => {
    const response = new Response(
      JSON.stringify({
        tag: "payRequest",
        callback: "https://example.com/callback",
        minSendable: 1_000,
        maxSendable: 200_000,
        metadata: "[]",
        allowsNostr: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    const params = await withMockedFetch(async () => response, () =>
      fetchLnurlPayParams("https://example.com/lnurl"),
    );

    assert.deepEqual(params, {
      callback: "https://example.com/callback",
      minSendable: 1_000,
      maxSendable: 200_000,
      metadata: "[]",
      allowsNostr: true,
    });
  });

  await t.test("throws when the LNURL pay endpoint is unreachable", async () => {
    const failure = new Response(null, { status: 500 });
    await assert.rejects(
      withMockedFetch(async () => failure, () => fetchLnurlPayParams("https://example.com/lnurl")),
    );
  });

  await t.test("throws when the LNURL pay response reports an error", async () => {
    const response = new Response(
      JSON.stringify({
        tag: "payRequest",
        status: "ERROR",
        reason: "Payments disabled",
        callback: "https://example.com/callback",
        minSendable: 1_000,
        maxSendable: 200_000,
        metadata: "[]",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    await assert.rejects(
      withMockedFetch(async () => response, () => fetchLnurlPayParams("https://example.com/lnurl")),
      /Payments disabled/,
    );
  });

  await t.test("throws when required LNURL pay fields are missing", async () => {
    const response = new Response(
      JSON.stringify({
        tag: "payRequest",
        minSendable: 1_000,
        maxSendable: 200_000,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    await assert.rejects(
      withMockedFetch(async () => response, () => fetchLnurlPayParams("https://example.com/lnurl")),
      /missing a callback URL/,
    );
  });

  await t.test("requests LNURL invoices with the desired amount and comment", async () => {
    const response = new Response(
      JSON.stringify({
        pr: "lnbc1...",
        routes: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    const params = {
      callback: "https://example.com/callback",
      minSendable: 1_000,
      maxSendable: 200_000,
      metadata: "[]",
    };

    let capturedUrl: string | null = null;
    const invoice = await withMockedFetch(async (url) => {
      if (typeof url === "string") {
        capturedUrl = url;
      } else if (url instanceof URL) {
        capturedUrl = url.toString();
      } else {
        capturedUrl = (url as Request).url;
      }
      return response;
    }, () => requestLnurlInvoice(params, 25, "Thank you!"));

    assert.deepEqual(invoice, {
      pr: "lnbc1...",
      routes: [],
      successAction: undefined,
      disposable: undefined,
    });

    assert.ok(capturedUrl);
    const parsedUrl = new URL(capturedUrl ?? "");
    assert.equal(parsedUrl.searchParams.get("amount"), "25000");
    assert.equal(parsedUrl.searchParams.get("comment"), "Thank you!");
  });

  await t.test("rejects invalid payment amounts before calling the callback", async () => {
    const params = {
      callback: "https://example.com/callback",
      minSendable: 1_000,
      maxSendable: 200_000,
      metadata: "[]",
    };

    await assert.rejects(requestLnurlInvoice(params, 0), /positive number of sats/);
  });

  await t.test("propagates LNURL callback errors", async () => {
    const response = new Response(
      JSON.stringify({
        status: "ERROR",
        reason: "Wallet unavailable",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    const params = {
      callback: "https://example.com/callback",
      minSendable: 1_000,
      maxSendable: 200_000,
      metadata: "[]",
    };

    await assert.rejects(
      withMockedFetch(async () => response, () => requestLnurlInvoice(params, 25)),
      /Wallet unavailable/,
    );
  });
});
