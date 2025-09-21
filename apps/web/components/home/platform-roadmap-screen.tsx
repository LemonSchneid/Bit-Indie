"use client";

import { ZapButton } from "../zap-button";
import {
  communityRoadmapNotes,
  developerUpdates,
  devDashboardComments,
  platformUpdateLightningAddress,
  roadmapStages,
} from "./data";
import type { RoadmapStatus } from "./types";
import { MicroLabel, NeonCard, Pill } from "./ui";
import { cn, formatZapAmount } from "./utils";

const roadmapStatusLabels: Record<RoadmapStatus, string> = {
  shipped: "Shipped",
  "in-progress": "In progress",
  exploring: "Exploring",
};

const roadmapStatusStyles: Record<RoadmapStatus, string> = {
  shipped: "border-emerald-400/60 bg-emerald-500/10 text-emerald-200",
  "in-progress": "border-sky-400/60 bg-sky-500/10 text-sky-100",
  exploring: "border-slate-600 bg-slate-900/70 text-slate-200",
};

export function PlatformRoadmapScreen() {
  return (
    <div className="space-y-10">
      <NeonCard className="p-8">
        <div className="space-y-4 text-center">
          <MicroLabel>Platform roadmap</MicroLabel>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Where Proof of Play is heading</h2>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-slate-300">
            Track what&apos;s shipped, what&apos;s in motion, and what we&apos;re validating with the community. Zap updates to boost the
            work you&apos;re most excited about.
          </p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {roadmapStages.map((stage) => (
            <div key={stage.title} className="flex h-full flex-col rounded-2xl border border-emerald-500/15 bg-slate-900/50 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">{stage.timeframe}</span>
                <RoadmapStatusBadge
                  status={stage.items.every((item) => item.status === "shipped") ? "shipped" : stage.items[0]?.status ?? "shipped"}
                />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{stage.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{stage.summary}</p>
              <ul className="mt-5 space-y-3 text-sm text-slate-200">
                {stage.items.map((item) => (
                  <li key={item.title} className="rounded-xl border border-slate-700/60 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-100">{item.title}</span>
                      <RoadmapStatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </NeonCard>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <DevDashboardCommentsPreview />
        <CommunityNotesPanel />
      </div>
    </div>
  );
}

function RoadmapStatusBadge({ status }: { status: RoadmapStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em]",
        roadmapStatusStyles[status],
      )}
    >
      {roadmapStatusLabels[status]}
    </span>
  );
}

function DevDashboardCommentsPreview() {
  return (
    <NeonCard className="p-6">
      <div className="space-y-2">
        <MicroLabel>Dev dashboard comments</MicroLabel>
        <h3 className="text-xl font-semibold tracking-tight text-white">Internal notes will surface here soon</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          Once the dev dashboard ships, the comments you post there will syndicate to this space for quick community updates.
        </p>
      </div>
      <div className="mt-6 space-y-4">
        {devDashboardComments.map((comment) => (
          <div key={comment.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-400">{comment.postedAt}</p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">{comment.author}</p>
              </div>
              <span className="rounded-full border border-slate-700/70 bg-slate-950/60 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
                Preview
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{comment.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4 text-xs text-slate-400">
        We&apos;ll replace these sample notes with real dashboard comments as soon as the private dev tooling goes live.
      </div>
    </NeonCard>
  );
}

function CommunityNotesPanel() {
  return (
    <NeonCard className="p-6">
      <div className="space-y-2">
        <MicroLabel>Community note board</MicroLabel>
        <h3 className="text-xl font-semibold tracking-tight text-white">Signal the features you want next</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          Drop ideas, vote with sats, and help prioritize what climbs the roadmap. Notes bubble to the top as zaps arrive.
        </p>
      </div>
      <div className="mt-6 space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
        <label
          className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-emerald-200/70"
          htmlFor="community-roadmap-note"
        >
          Share an idea with the crew
        </label>
        <textarea
          id="community-roadmap-note"
          className="h-24 w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          placeholder="Pitch a feature, quality-of-life tweak, or Lightning experiment you want to see."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">
            Top zapped notes get reviewed in weekly planning.
          </span>
          <button
            type="button"
            className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
          >
            Submit note
          </button>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {communityRoadmapNotes.map((note) => (
          <div key={note.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.35em] text-slate-400">
              <span>{note.author}</span>
              <span className="text-slate-600">•</span>
              <span>{note.createdAgo}</span>
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
                {note.replies} replies
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">{note.note}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-amber-100">
                ⚡ {formatZapAmount(note.zapMsats)}
              </span>
              <ZapButton
                lightningAddress={note.lightningAddress ?? undefined}
                recipientLabel={note.author}
                comment={`Support community note: ${note.note}`}
              />
            </div>
          </div>
        ))}
      </div>
    </NeonCard>
  );
}

export function DeveloperUpdatePanel() {
  return (
    <NeonCard className="p-6">
      <div className="space-y-2">
        <MicroLabel>Developer update feed</MicroLabel>
        <h3 className="text-xl font-semibold tracking-tight text-white">Broadcast where your head&apos;s at</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          Draft notes for the community and let them zap the ones that resonate. Updates publish to Nostr and surface on the
          roadmap instantly.
        </p>
      </div>
      <div className="mt-6 space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
        <label
          className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-emerald-200/70"
          htmlFor="developer-update-note"
        >
          Leave a note for the crew
        </label>
        <textarea
          id="developer-update-note"
          className="h-28 w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          placeholder="Sketch today&apos;s focus, call out blockers, or celebrate a shipped feature."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.6rem] uppercase tracking-[0.4em] text-slate-500">
            Notes pin to the top while zaps are flowing.
          </span>
          <button
            type="button"
            className="rounded-full border border-emerald-400/70 bg-emerald-500/20 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            Post update
          </button>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {developerUpdates.map((update) => (
          <div key={update.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">{update.publishedAt}</p>
                <h4 className="mt-2 text-base font-semibold tracking-tight text-white">{update.title}</h4>
              </div>
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-amber-100">
                ⚡ {formatZapAmount(update.zapMsats)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{update.body}</p>
            <div className="mt-4">
              <ZapButton
                lightningAddress={platformUpdateLightningAddress}
                recipientLabel="Proof of Play dev updates"
                comment={`Zap update: ${update.title}`}
              />
            </div>
          </div>
        ))}
      </div>
    </NeonCard>
  );
}
