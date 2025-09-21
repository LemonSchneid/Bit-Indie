"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip04,
  type Event,
  type EventTemplate,
} from "nostr-tools";
import { Relay } from "nostr-tools/relay";

import type { SignedEvent } from "../api";
import type { NostrUnsignedEvent } from "./use-nostr-login";

const CONNECT_SECRET_STORAGE_KEY = "proof-of-play:nostr-connect:secret";
const CONNECT_REMOTE_STORAGE_KEY = "proof-of-play:nostr-connect:remote";
const RELAY_URL = "wss://relay.getalby.com/v1";
const CLIENT_TAG_VALUE = "proof-of-play-web";

type ConnectMessage =
  | { type: "connect"; id: string; params?: unknown[] }
  | { type: "result"; id: string; result: unknown }
  | { type: "error"; id: string; error: string }
  | { type: "request"; id: string; method: string; params?: unknown[] };

type PendingRequest = {
  resolve: (value: SignedEvent) => void;
  reject: (reason?: unknown) => void;
  timeout: number;
};

export type NostrConnectStatus = "idle" | "awaiting_approval" | "connected" | "error";

function loadSecretKey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(CONNECT_SECRET_STORAGE_KEY);
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) {
    return existing.toLowerCase();
  }

  const secretHex = bytesToHex(generateSecretKey());
  window.localStorage.setItem(CONNECT_SECRET_STORAGE_KEY, secretHex);
  return secretHex;
}

function loadRemoteSigner(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(CONNECT_REMOTE_STORAGE_KEY);
}

function persistRemoteSigner(pubkey: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!pubkey) {
    window.localStorage.removeItem(CONNECT_REMOTE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(CONNECT_REMOTE_STORAGE_KEY, pubkey);
}

function encodeMetadata(metadata: Record<string, string>): string {
  const json = JSON.stringify(metadata);
  if (typeof window === "undefined") {
    return Buffer.from(json).toString("base64");
  }
  return window.btoa(json);
}

function randomRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function useNostrConnect() {
  const secretKey = useMemo(loadSecretKey, []);
  const appPublicKey = useMemo(() => {
    if (!secretKey) {
      return "";
    }
    const pubkey = getPublicKey(hexToBytes(secretKey));
    return typeof pubkey === "string" ? pubkey : bytesToHex(pubkey);
  }, [secretKey]);
  const [status, setStatus] = useState<NostrConnectStatus>(() =>
    loadRemoteSigner() ? "connected" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [remotePubkey, setRemotePubkey] = useState<string | null>(() => loadRemoteSigner());
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const relayRef = useRef<Relay | null>(null);
  const subRef = useRef<ReturnType<Relay["subscribe"]> | null>(null);

  const metadataBase64 = useMemo(
    () =>
      encodeMetadata({
        name: "Proof of Play",
        url: "https://proof-of-play.example",
        description: "Proof of Play marketplace",
      }),
    [],
  );

  const connectionUri = useMemo(() => {
    const params = new URLSearchParams();
    params.set("relay", RELAY_URL);
    params.set("metadata", metadataBase64);
    return `nostrconnect://${appPublicKey}?${params.toString()}`;
  }, [appPublicKey, metadataBase64]);

  const ensureRelay = useCallback(async () => {
    if (relayRef.current) {
      return relayRef.current;
    }

    try {
      const relay = await Relay.connect(RELAY_URL);
      relay.onnotice = (msg: string) => {
        setError(msg);
      };
      relayRef.current = relay;
      return relay;
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : String(connectionError));
      setStatus("error");
      throw connectionError;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (subRef.current) {
      subRef.current.close();
      subRef.current = null;
    }
    if (relayRef.current) {
      relayRef.current.close();
      relayRef.current = null;
    }
    pendingRequests.current.forEach((request) => {
      window.clearTimeout(request.timeout);
      request.reject(new Error("Nostr Connect cancelled"));
    });
    pendingRequests.current.clear();
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const handleMessage = useCallback(
    async (event: Event) => {
      try {
        const plaintext = await nip04.decrypt(secretKey, event.pubkey, event.content);
        const message = JSON.parse(plaintext) as ConnectMessage;

        if (message.type === "connect") {
          setRemotePubkey(event.pubkey);
          persistRemoteSigner(event.pubkey);
          setStatus("connected");

          const relay = await ensureRelay();
          const acknowledgement: EventTemplate = {
            kind: 24133,
            created_at: Math.floor(Date.now() / 1000),
            content: await nip04.encrypt(
              secretKey,
              event.pubkey,
              JSON.stringify({ type: "result", id: message.id, result: "ack" }),
            ),
            tags: [
              ["p", event.pubkey],
              ["client", CLIENT_TAG_VALUE],
            ],
          };
          await relay.publish(finalizeEvent(acknowledgement, secretKey));
          return;
        }

        if (!message.id) {
          return;
        }

        const pending = pendingRequests.current.get(message.id);
        if (!pending) {
          return;
        }

        window.clearTimeout(pending.timeout);
        pendingRequests.current.delete(message.id);

        if (message.type === "result") {
          pending.resolve(message.result as SignedEvent);
        } else if (message.type === "error") {
          pending.reject(new Error(message.error));
        }
      } catch (decodeError) {
        setError(decodeError instanceof Error ? decodeError.message : String(decodeError));
        setStatus("error");
      }
    },
    [ensureRelay, secretKey],
  );

  const subscribeToMessages = useCallback(async () => {
    if (!appPublicKey) {
      return;
    }

    const relay = await ensureRelay();

    if (subRef.current) {
      subRef.current.close();
    }

    const subscription = relay.subscribe(
      [
        {
          kinds: [24133],
          "#p": [appPublicKey],
        },
      ],
      {},
    );

    subscription.onevent = (evt) => {
      void handleMessage(evt);
    };

    subRef.current = subscription;
  }, [appPublicKey, ensureRelay, handleMessage]);

  const beginPairing = useCallback(async () => {
    setError(null);
    setStatus(remotePubkey ? "connected" : "awaiting_approval");
    await subscribeToMessages();
  }, [remotePubkey, subscribeToMessages]);

  const disconnect = useCallback(() => {
    cleanup();
    setRemotePubkey(null);
    persistRemoteSigner(null);
    setStatus("idle");
    setError(null);
  }, [cleanup]);

  const sendRequest = useCallback(
    async (method: string, params: unknown[]): Promise<SignedEvent> => {
      if (!remotePubkey) {
        throw new Error("Connect a Nostr signer first.");
      }

      await subscribeToMessages();
      setError(null);

      const relay = await ensureRelay();

      const id = randomRequestId();
      const payload: ConnectMessage = {
        type: "request",
        id,
        method,
        params,
      } as ConnectMessage;

      const eventTemplate: EventTemplate = {
        kind: 24133,
        created_at: Math.floor(Date.now() / 1000),
        content: await nip04.encrypt(secretKey, remotePubkey, JSON.stringify(payload)),
        tags: [
          ["p", remotePubkey],
          ["client", CLIENT_TAG_VALUE],
        ],
      };

      const signedEvent = finalizeEvent(eventTemplate, secretKey);

      const resultPromise = new Promise<SignedEvent>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pendingRequests.current.delete(id);
          reject(new Error("Nostr Connect request timed out"));
        }, 30_000);

        pendingRequests.current.set(id, { resolve, reject, timeout });
      });

      await relay.publish(signedEvent);
      return resultPromise;
    },
    [ensureRelay, remotePubkey, secretKey, subscribeToMessages],
  );

  const signer = useMemo(
    () => ({
      signEvent: async (event: NostrUnsignedEvent) => {
        const result = await sendRequest("sign_event", [event]);
        return result;
      },
    }),
    [sendRequest],
  );

  return {
    status,
    error,
    connectionUri,
    remotePubkey,
    beginPairing,
    disconnect,
    signer: remotePubkey ? signer : null,
  };
}
