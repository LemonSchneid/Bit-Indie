export type LightningDestinationConfig = {
  lightningAddress?: string | null;
  lnurl?: string | null;
};

export type LnurlPayParams = {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  allowsNostr?: boolean;
};

export type LnurlInvoiceResponse = {
  pr: string;
  routes: unknown[];
  successAction?: unknown;
  disposable?: boolean;
};

type LnurlPayResponse = LnurlPayParams & {
  tag: string;
  status?: string;
  reason?: string;
};

type LnurlCallbackResponse = LnurlInvoiceResponse & {
  status?: string;
  reason?: string;
};

const LNURL_PREFIX = "lnurl1";
const LN_ADDRESS_PATH = "/.well-known/lnurlp/";
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_GENERATOR = [
  0x3b6a57b2,
  0x26508e6d,
  0x1ea119fa,
  0x3d4233dd,
  0x2a1462b3,
];

const BECH32_CHARSET_REVERSE = (() => {
  const table: Record<string, number> = {};
  for (let index = 0; index < BECH32_CHARSET.length; index += 1) {
    table[BECH32_CHARSET[index]] = index;
  }
  return table;
})();

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
    if (code < 33 || code > 126) {
      throw new Error("Invalid bech32 human-readable part.");
    }
    result.push(code >>> 5);
  }
  result.push(0);
  for (let index = 0; index < hrp.length; index += 1) {
    result.push(hrp.charCodeAt(index) & 31);
  }
  return result;
}

function bech32VerifyChecksum(hrp: string, values: number[]): boolean {
  return bech32Polymod([...bech32HumanReadablePartExpand(hrp), ...values]) === 1;
}

function bech32Decode(value: string): { prefix: string; words: number[] } {
  const normalized = value.trim().toLowerCase();
  const separatorIndex = normalized.lastIndexOf("1");
  if (separatorIndex < 1 || separatorIndex + 7 > normalized.length) {
    throw new Error("Invalid bech32 encoding.");
  }

  const prefix = normalized.substring(0, separatorIndex);
  const data = normalized.substring(separatorIndex + 1);
  const values: number[] = [];
  for (const char of data) {
    const index = BECH32_CHARSET_REVERSE[char];
    if (index === undefined) {
      throw new Error("Invalid bech32 character encountered.");
    }
    values.push(index);
  }

  if (!bech32VerifyChecksum(prefix, values)) {
    throw new Error("Invalid bech32 checksum.");
  }

  return { prefix, words: values.slice(0, -6) };
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let accumulator = 0;
  let bits = 0;
  const maxValue = (1 << to) - 1;
  const result: number[] = [];

  for (const value of data) {
    if (value < 0 || value >= 1 << from) {
      throw new Error("Value out of range for bit conversion.");
    }
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

function decodeLnurlBech32(encoded: string): string {
  const trimmed = encoded.trim();
  if (!trimmed.toLowerCase().startsWith(LNURL_PREFIX)) {
    throw new Error("LNURL bech32 values must begin with lnurl1.");
  }

  const decoded = bech32Decode(trimmed);
  const bytes = convertBits(decoded.words, 5, 8, false);
  const buffer = Uint8Array.from(bytes);
  const textDecoder = new TextDecoder("utf-8");
  return textDecoder.decode(buffer);
}

function buildLightningAddressUrl(address: string): string {
  const normalized = address.trim();
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    throw new Error("Lightning addresses must be in name@domain format.");
  }

  const [name, domain] = parts;
  if (!name || !domain) {
    throw new Error("Lightning addresses must include a valid name and domain.");
  }

  const protocol = domain.startsWith("http://") || domain.startsWith("https://") ? "" : "https://";
  const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `${protocol}${cleanDomain}${LN_ADDRESS_PATH}${encodeURIComponent(name)}`;
}

export function resolveLightningPayEndpoint(config: LightningDestinationConfig): string {
  if (config.lnurl) {
    const candidate = config.lnurl.trim();
    if (candidate.toLowerCase().startsWith(LNURL_PREFIX)) {
      return decodeLnurlBech32(candidate);
    }
    if (candidate.startsWith("https://") || candidate.startsWith("http://")) {
      return candidate;
    }
    throw new Error("Unsupported LNURL format. Provide a bech32 or https URL.");
  }

  if (config.lightningAddress) {
    return buildLightningAddressUrl(config.lightningAddress);
  }

  throw new Error("A lightning address or LNURL is required to send a zap.");
}

export async function fetchLnurlPayParams(payEndpoint: string): Promise<LnurlPayParams> {
  const response = await fetch(payEndpoint, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load LNURL pay parameters (status ${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("LNURL pay response must be an object.");
  }

  const data = payload as LnurlPayResponse;
  if (data.status === "ERROR") {
    throw new Error(data.reason || "LNURL pay endpoint returned an error.");
  }
  if (data.tag !== "payRequest") {
    throw new Error("LNURL response did not describe a pay request.");
  }

  if (!data.callback || typeof data.callback !== "string") {
    throw new Error("LNURL pay response is missing a callback URL.");
  }

  if (typeof data.minSendable !== "number" || typeof data.maxSendable !== "number") {
    throw new Error("LNURL pay response is missing sendable amount bounds.");
  }

  return {
    callback: data.callback,
    minSendable: data.minSendable,
    maxSendable: data.maxSendable,
    metadata: typeof data.metadata === "string" ? data.metadata : "",
    allowsNostr: data.allowsNostr,
  };
}

export function clampZapAmount(sats: number, params: LnurlPayParams): number {
  const minSats = Math.ceil(params.minSendable / 1000);
  const maxSats = Math.floor(params.maxSendable / 1000);
  const bounded = Math.min(Math.max(sats, minSats), maxSats);
  return Number.isFinite(bounded) ? bounded : sats;
}

export async function requestLnurlInvoice(
  params: LnurlPayParams,
  amountSats: number,
  comment?: string,
): Promise<LnurlInvoiceResponse> {
  const msats = Math.floor(amountSats * 1000);
  if (!Number.isFinite(msats) || msats <= 0) {
    throw new Error("Zap amount must be a positive number of sats.");
  }

  const url = new URL(params.callback);
  url.searchParams.set("amount", msats.toString());
  if (comment) {
    url.searchParams.set("comment", comment);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`LNURL callback failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("LNURL callback response must be an object.");
  }

  const data = payload as LnurlCallbackResponse;
  if (data.status === "ERROR") {
    throw new Error(data.reason || "LNURL callback returned an error.");
  }

  if (!data.pr || typeof data.pr !== "string") {
    throw new Error("LNURL callback did not return a Bolt11 invoice.");
  }

  return {
    pr: data.pr,
    routes: Array.isArray(data.routes) ? data.routes : [],
    successAction: data.successAction,
    disposable: data.disposable,
  };
}

export function isWeblnAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return typeof (window as Window & { webln?: unknown }).webln !== "undefined";
}

interface WeblnProvider {
  enable?: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<unknown>;
}

export async function payWithWebln(invoice: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("WebLN is not available in this environment.");
  }

  const provider = (window as Window & { webln?: WeblnProvider }).webln;
  if (!provider) {
    throw new Error("WebLN provider is not available.");
  }

  if (typeof provider.enable === "function") {
    await provider.enable();
  }

  await provider.sendPayment(invoice);
}

export function openLightningInvoice(invoice: string): void {
  if (typeof window === "undefined") {
    throw new Error("Cannot open invoice outside the browser environment.");
  }

  const anchor = document.createElement("a");
  anchor.href = `lightning:${invoice}`;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
