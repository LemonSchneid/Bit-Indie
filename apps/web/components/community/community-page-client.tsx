'use client';

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import {
  CommunityTagSummary,
  CommunityThreadDetail,
  CommunityThreadSummary,
  createCommunityThread,
  listCommunityTags,
  listCommunityThreads,
} from "../../lib/api";
import { formatDateLabel } from "../../lib/format";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";

const cardClasses =
  "relative overflow-hidden rounded-3xl border border-[#7bffc8]/20 bg-white/5 p-6 text-[#e8f9f1] shadow-[0_0_35px_rgba(123,255,200,0.1)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-[#7bffc8]/20 before:opacity-60";

type CommunityPageClientProps = {
  initialThreads: CommunityThreadSummary[];
  tags: CommunityTagSummary[];
};

export function CommunityPageClient({ initialThreads, tags }: CommunityPageClientProps): JSX.Element {
  const profile = useStoredUserProfile();
  const [threads, setThreads] = useState<CommunityThreadSummary[]>(initialThreads);
  const [tagSummaries, setTagSummaries] = useState<CommunityTagSummary[]>(tags);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTagLabel = selectedTag ?? "All";

  const handleSelectTag = useCallback(
    async (tag: string | null) => {
      setSelectedTag(tag);
      setIsLoading(true);
      setError(null);
      try {
        const nextThreads = await listCommunityThreads({ tag: tag ?? undefined });
        setThreads(nextThreads);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load community threads.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleCreateThread = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) {
        setError("Sign in to start a thread.");
        return;
      }

      const normalizedTags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      setIsSubmitting(true);
      setError(null);
      try {
        const created = await createCommunityThread({
          user_id: profile.id,
          title: title.trim() || null,
          body_md: body.trim() || null,
          tags: normalizedTags,
        });
        const summary = threadDetailToSummary(created);
        setThreads((previous) => [summary, ...previous]);
        setShowComposer(false);
        setTitle("");
        setBody("");
        setTagsInput("");

        // Refresh tag usage in the background so the filter list stays current.
        listCommunityTags()
          .then((nextTags) => {
            setTagSummaries(nextTags);
          })
          .catch(() => {
            // Non-fatal; ignore
          });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create your thread.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [body, profile, tagsInput, title],
  );

  const tagButtons = useMemo(() => {
    const entries = tagSummaries.slice(0, 20);
    return entries.map((tag) => {
      const isActive = selectedTag === tag.tag;
      return (
        <button
          key={tag.tag}
          type="button"
          onClick={() => handleSelectTag(isActive ? null : tag.tag)}
          className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
            isActive
              ? "border-[#7bffc8] bg-[#7bffc8]/20 text-white"
              : "border-white/15 text-[#dcfff2]/70 hover:border-[#7bffc8]/60 hover:text-white"
          }`}
        >
          {tag.tag}
          <span className="ml-2 inline-flex min-w-[1.75rem] items-center justify-center rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[0.65rem] font-semibold text-white/80">
            {tag.thread_count}
          </span>
        </button>
      );
    });
  }, [handleSelectTag, selectedTag, tagSummaries]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">Community</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Updates &amp; Community</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowComposer((value) => !value)}
            className="rounded-full border border-[#7bffc8]/70 bg-[#7bffc8]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:border-[#7bffc8] hover:bg-[#7bffc8]/80 hover:text-black"
          >
            {showComposer ? "Cancel" : "Start a thread"}
          </button>
        </div>
        <p className="max-w-3xl text-base text-[#b8ffe5]/70">
          Browse milestone notes, gameplay feedback, and roadmap chatter. Signed-in players can join the conversation and share ideas for Bit Indie.
        </p>
      </section>

      {showComposer ? (
        <section className={cardClasses}>
          {profile ? (
            <form className="space-y-4" onSubmit={handleCreateThread}>
              <header className="space-y-1">
                <h2 className="text-2xl font-semibold text-white">Start a new discussion</h2>
                <p className="text-sm text-[#dcfff2]/80">Titles are optional—kick off a quick status update or polish a full changelog.</p>
              </header>
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">
                  Title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Optional headline"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#7bffc8] focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">
                  Message
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Share updates, feedback requests, or questions for the community"
                    required={!title.trim()}
                    className="mt-2 h-36 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white focus:border-[#7bffc8] focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">
                  Tags
                  <input
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="Comma separated, e.g. updates, roadmap"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#7bffc8] focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-full border border-[#7bffc8]/70 bg-[#7bffc8]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:border-[#7bffc8] hover:bg-[#7bffc8]/80 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Posting…" : "Post thread"}
                </button>
                <p className="text-xs text-[#b8ffe5]/60">Signed in as {profile.display_name ?? profile.account_identifier}</p>
              </div>
            </form>
          ) : (
            <p className="text-sm text-[#dcfff2]/80">
              Sign in to start a new thread. Threads keep the community loop transparent, from roadmap updates to feature requests.
            </p>
          )}
        </section>
      ) : null}

      <section className="space-y-5">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.3em] text-[#dcfff2]/70">
              Viewing
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-white">{activeTagLabel}</span>
            {selectedTag ? (
              <button
                type="button"
                onClick={() => handleSelectTag(null)}
                className="text-xs uppercase tracking-[0.3em] text-[#7bffc8]/70 hover:text-white"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">{tagButtons}</div>
        </header>

        {error ? (
          <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-[#dcfff2]/70">Loading threads…</p>
        ) : threads.length === 0 ? (
          <p className="text-sm text-[#dcfff2]/70">No threads yet. Be the first to share an update.</p>
        ) : (
          <ul className="space-y-3">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link href={`/community/${thread.id}`} className="block transition hover:translate-y-[-2px]">
                  <article className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-[0_10px_30px_rgba(10,30,20,0.25)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold text-white">
                        {thread.title ?? "Untitled thread"}
                      </h2>
                      <p className="text-xs uppercase tracking-[0.3em] text-[#b8ffe5]/70">
                        Updated {formatDateLabel(thread.updated_at, { fallback: "recently" })}
                      </p>
                    </div>
                    {thread.body_md ? (
                      <p className="mt-2 line-clamp-3 text-sm text-[#dcfff2]/80">{thread.body_md}</p>
                    ) : (
                      <p className="mt-2 text-sm italic text-[#dcfff2]/60">No summary yet—open the thread to catch up.</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-[#7bffc8]/70">
                      <span className="rounded-full border border-[#7bffc8]/40 bg-[#7bffc8]/10 px-3 py-1 text-white">
                        {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
                      </span>
                      {thread.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[#dcfff2]/70">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function threadDetailToSummary(detail: CommunityThreadDetail): CommunityThreadSummary {
  const { posts: _posts, ...summary } = detail;
  return summary;
}
