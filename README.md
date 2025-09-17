# 🎮 Proof of Play — Nostr-Powered Indie Game Marketplace

---

## 1. Core Vision

Proof of Play is a **Bitcoin-native indie game store + social layer**, powered by Nostr.

* **You own the store** → catalog, downloads, payments, revenue cuts.
* **Nostr provides identity + distribution + reputation** → every dev and player is a pubkey.
* **Interaction is simple:**

  * **Comments = speech** (free, signed notes).
  * **Zaps = value** (Bitcoin payments).

---

## 2. Developers

* Every developer has a **Nostr identity**.

  * Auto-generated pubkey at signup.
  * All listings, updates, and replies tied to that pubkey.
  * Developers can export/claim their key anytime.

* **Publishing Flow**

  * Upload game → listing published to:

    * Proof of Play Relay (canonical DB).
    * Public Relays (distribution + advertising).

* **Revenue Flow**

  * Game sales (minus platform cut).
  * Zaps on their notes (listings, updates, replies).

* **Verified Developer**

  * Claimed pubkey = badge → builds trust with players.

---

## 3. Players

* Every player has a **Nostr identity**.

  * Auto-generated pubkey at signup.
  * Reviews and comments tied to their pubkey.

* **Wallet-Linked Players**

  * Can zap games, reviews, and comments.
  * Zaps are broadcast to relays under their pubkey.

* **Non-Wallet Players**

  * Can tip developers via LNURL invoice pop-up.
  * Can still comment (free, signed with auto pubkey).
  * Cannot zap (UI shows *“Link wallet to zap”*).

* **Revenue Flow**

  * Players can earn sats if their reviews/comments get zapped.

---

## 4. Proof of Play (the Platform)

* Runs its own **relay** (canonical DB).

* Publishes content under the **Proof of Play pubkey** for announcements, features, and updates.

* **Revenue Streams**

  * Sales cut (e.g. 10%).
  * Zaps on Proof of Play’s own posts.
  * Direct tips to the platform LNURL.

---

## 5. Content Flow

* **Game Listings** → mirrored as NIP-15 marketplace events (`kind 30018`).
* **Reviews/Comments** → mirrored as Nostr notes, bi-directional sync with relays.
* **Zaps** → flow to the **author’s pubkey** (dev, player, or Proof of Play).
* **Treasury/Escrow** → optional future feature for spam filtering (refundable deposits).

---

## 6. Storefront Design

* **Categories**

  * **Prototypes & Jams** → *“Throw it out there, get feedback.”*
  * **Early Access** → *“Playable now, evolving with you.”*
  * **Finished Games** → *“Polished and ready.”*

* **Game Page Actions**

  * **Comment** → free, identity-tied.
  * **Zap** → sats + signed event (wallet required).
  * **Tip** → LNURL fallback.

* **Reviews** → sorted by zap-weight + recency.

* **Dev Profiles** → show pubkey, games, zap totals, comment history, and “Verified” badge.

---

## 7. Revenue Model

* **Game Sales** → \~10% platform cut.
* **Zaps** →

  * Developer zaps → to developer pubkey.
  * Player zaps (reviews) → to player pubkey.
  * Platform zaps → to Proof of Play pubkey.
* **Tips** → platform LNURL for direct support.
* **Optional Future** → refundable deposits as a quality filter.

---

## 8. Why It’s Unique

* **Bitcoin-native economy** → sats for sales + zaps.
* **Nostr-native identity** → every dev and player has a portable pubkey reputation.
* **Free speech, paid value** → only two interactions matter: comments (speech) + zaps (value).
* **Open publishing** → prototypes, jams, early access, and finished games all welcome.
* **Social virality** → listings and reviews spread across Nostr clients.
* **Transparent history** → all events verifiable on relays.

---

## 9. Launch Plan (90-Day MVP)

1. Deploy Proof of Play Relay (SQLite/Postgres).
2. Implement game upload + sales system.
3. Auto-generate pubkeys for developers + players.
4. Add wallet linking (WebLN, LNURL) + fallback tips.
5. Build UI with **Comments + Zaps only**.
6. Mirror content to Nostr; pull back external comments/zaps.
7. Roll out category system (Prototypes, Early Access, Finished).

---

## 10. Future Upgrades

* Optional refundable deposit system for spam filtering.
* Advanced zap-weighted reputation mechanics.
* Native Proof of Play mobile client (a Nostr-first game hub).
* Partnerships with Lightning-native game studios (e.g. THNDR, ZBD).

---

## ✅ Summary

Proof of Play = **the Bitcoin/Nostr-native indie game marketplace**.

* Every **developer and player** has a Nostr identity.
* Games, reviews, and updates are mirrored across relays.
* **Comments = free speech.**
* **Zaps = paid value.**
* Proof of Play earns from **sales cuts + its own zaps/tips.**
