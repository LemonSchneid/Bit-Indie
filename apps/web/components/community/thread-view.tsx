'use client';

import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";

import {
  CommunityPost,
  CommunityThreadDetail,
  createCommunityPost,
  listCommunityReplies,
  removeCommunityPost,
} from "../../lib/api";
import { formatDateLabel } from "../../lib/format";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";

type CommunityThreadViewProps = {
  initialThread: CommunityThreadDetail;
};

export function CommunityThreadView({ initialThread }: CommunityThreadViewProps): JSX.Element {
  const profile = useStoredUserProfile();
  const [thread, setThread] = useState<CommunityThreadDetail>(initialThread);
  const [threadReply, setThreadReply] = useState("");
  const [isPostingThreadReply, setIsPostingThreadReply] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>({});
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({});
  const [postReplies, setPostReplies] = useState<Record<string, CommunityPost[]>>({});
  const [expandedPosts, setExpandedPosts] = useState<string[]>([]);

  const isAdmin = Boolean(profile?.is_admin);

  const handleThreadReplySubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) {
        setThreadError("Sign in to reply.");
        return;
      }
      const message = threadReply.trim();
      if (!message) {
        setThreadError("Reply cannot be empty.");
        return;
      }
      setIsPostingThreadReply(true);
      setThreadError(null);
      try {
        const post = await createCommunityPost(thread.id, {
          user_id: profile.id,
          body_md: message,
        });
        setThread((current) => ({
          ...current,
          reply_count: current.reply_count + 1,
          posts: [...current.posts, post],
        }));
        setThreadReply("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to post your reply.";
        setThreadError(message);
      } finally {
        setIsPostingThreadReply(false);
      }
    },
    [profile, thread.id, threadReply],
  );

  const toggleReplies = useCallback(
    async (postId: string) => {
      setExpandedPosts((current) => {
        if (current.includes(postId)) {
          return current.filter((id) => id !== postId);
        }
        return [...current, postId];
      });

      if (postReplies[postId]) {
        return;
      }

      setReplyLoading((state) => ({ ...state, [postId]: true }));
      setReplyErrors((state) => ({ ...state, [postId]: null }));
      try {
        const replies = await listCommunityReplies(postId);
        setPostReplies((state) => ({ ...state, [postId]: replies }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load replies.";
        setReplyErrors((state) => ({ ...state, [postId]: message }));
      } finally {
        setReplyLoading((state) => ({ ...state, [postId]: false }));
      }
    },
    [postReplies],
  );

  const handleReplyDraftChange = useCallback((postId: string, value: string) => {
    setReplyDrafts((state) => ({ ...state, [postId]: value }));
  }, []);

  const handleSubmitReply = useCallback(
    async (event: FormEvent<HTMLFormElement>, postId: string) => {
      event.preventDefault();
      if (!profile) {
        setReplyErrors((state) => ({ ...state, [postId]: "Sign in to reply." }));
        return;
      }
      const message = replyDrafts[postId]?.trim();
      if (!message) {
        setReplyErrors((state) => ({ ...state, [postId]: "Reply cannot be empty." }));
        return;
      }

      setReplyErrors((state) => ({ ...state, [postId]: null }));
      setReplyLoading((state) => ({ ...state, [postId]: true }));
      try {
        const reply = await createCommunityPost(thread.id, {
          user_id: profile.id,
          body_md: message,
          parent_post_id: postId,
        });

        setThread((current) => ({
          ...current,
          reply_count: current.reply_count + 1,
          posts: current.posts.map((post) =>
            post.id === postId ? { ...post, reply_count: post.reply_count + 1 } : post,
          ),
        }));

        setPostReplies((state) => {
          const existing = state[postId] ?? [];
          return {
            ...state,
            [postId]: [...existing, reply],
          };
        });

        setReplyDrafts((state) => ({ ...state, [postId]: "" }));
        if (!expandedPosts.includes(postId)) {
          setExpandedPosts((current) => [...current, postId]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to post your reply.";
        setReplyErrors((state) => ({ ...state, [postId]: message }));
      } finally {
        setReplyLoading((state) => ({ ...state, [postId]: false }));
      }
    },
    [expandedPosts, profile, replyDrafts, thread.id],
  );

  const applyPostUpdate = useCallback((updated: CommunityPost) => {
    if (updated.parent_post_id) {
      setPostReplies((state) => {
        const existing = state[updated.parent_post_id!];
        if (!existing) {
          return state;
        }
        return {
          ...state,
          [updated.parent_post_id!]: existing.map((reply) => (reply.id === updated.id ? updated : reply)),
        };
      });
    } else {
      setThread((current) => ({
        ...current,
        posts: current.posts.map((post) => (post.id === updated.id ? updated : post)),
      }));
    }
  }, []);

  const handleRemovePost = useCallback(
    async (postId: string) => {
      if (!profile) {
        return;
      }
      try {
        const updated = await removeCommunityPost(postId, { admin_id: profile.id });
        applyPostUpdate(updated);
      } catch (error) {
        // Surface minimal feedback; reuse thread error banner.
        const message = error instanceof Error ? error.message : "Unable to remove this post.";
        setThreadError(message);
      }
    },
    [applyPostUpdate, profile],
  );

  const sortedPosts = useMemo(() => thread.posts, [thread.posts]);

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">Community Thread</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {thread.title ?? "Untitled thread"}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-[#b8ffe5]/70">
          <span>Started {formatDateLabel(thread.created_at, { fallback: "recently" })}</span>
          {thread.author ? (
            <span>by {thread.author.display_name ?? thread.author.id.slice(0, 8)}</span>
          ) : (
            <span>by Bit Indie</span>
          )}
          {thread.is_locked ? (
            <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-amber-100">Locked</span>
          ) : null}
        </div>
        {thread.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {thread.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[#dcfff2]/70">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {thread.body_md ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-[#dcfff2]/85 shadow-[0_10px_30px_rgba(10,30,20,0.25)]">
          {thread.body_md}
        </section>
      ) : null}

      <section className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold text-white">Replies ({thread.reply_count})</h2>
          <p className="text-sm text-[#dcfff2]/70">Share what you’d like to see, ask questions, or help shape the roadmap.</p>
        </header>
        {threadError ? (
          <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{threadError}</p>
        ) : null}
        <form className="space-y-3" onSubmit={handleThreadReplySubmit}>
          <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">
            Add a reply
            <textarea
              value={threadReply}
              onChange={(event) => setThreadReply(event.target.value)}
              placeholder={profile ? "Share an update or question" : "Sign in to reply"}
              disabled={!profile || isPostingThreadReply}
              className="mt-2 h-32 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white focus:border-[#7bffc8] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={!profile || isPostingThreadReply}
            className="inline-flex items-center justify-center rounded-full border border-[#7bffc8]/70 bg-[#7bffc8]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-white transition hover:border-[#7bffc8] hover:bg-[#7bffc8]/80 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPostingThreadReply ? "Posting…" : "Reply"}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {sortedPosts.length === 0 ? (
          <p className="text-sm text-[#dcfff2]/70">No replies yet. Start the conversation above.</p>
        ) : (
          <ul className="space-y-4">
            {sortedPosts.map((post) => {
              const isExpanded = expandedPosts.includes(post.id);
              const replies = postReplies[post.id] ?? [];
              const loading = replyLoading[post.id];
              const replyError = replyErrors[post.id];
              const draft = replyDrafts[post.id] ?? "";
              return (
                <li key={post.id} className="space-y-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-[#dcfff2]/85 shadow-[0_10px_30px_rgba(10,30,20,0.2)]">
                  <header className="flex flex-wrap items-start justify-between gap-3 text-xs uppercase tracking-[0.3em] text-[#b8ffe5]/80">
                    <div className="flex flex-col gap-1">
                      <span>{post.author.display_name ?? post.author.id.slice(0, 8)}</span>
                      <span>Posted {formatDateLabel(post.created_at, { fallback: "recently" })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleReplies(post.id)}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.65rem] uppercase tracking-[0.35em] text-white/80 transition hover:border-[#7bffc8]/60 hover:text-white"
                      >
                        {isExpanded ? "Hide replies" : `View replies (${post.reply_count})`}
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleRemovePost(post.id)}
                          className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.35em] text-rose-200 transition hover:border-rose-300 hover:text-rose-100"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </header>
                  {post.body_md ? (
                    <p>{post.body_md}</p>
                  ) : (
                    <p className="italic text-[#dcfff2]/60">This post was removed by a moderator.</p>
                  )}

                  {isExpanded ? (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      {replyError ? (
                        <p className="text-xs text-rose-200">{replyError}</p>
                      ) : null}
                      {loading ? (
                        <p className="text-xs text-[#dcfff2]/60">Loading replies…</p>
                      ) : replies.length === 0 ? (
                        <p className="text-xs text-[#dcfff2]/60">No replies yet. Add one below.</p>
                      ) : (
                        <ul className="space-y-3">
                          {replies.map((reply) => (
                            <li key={reply.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#dcfff2]/80">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6rem] uppercase tracking-[0.35em] text-[#b8ffe5]/70">
                                <span>{reply.author.display_name ?? reply.author.id.slice(0, 8)}</span>
                                <span>{formatDateLabel(reply.created_at, { fallback: "recently" })}</span>
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePost(reply.id)}
                                    className="rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[0.6rem] uppercase tracking-[0.35em] text-rose-200"
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                              {reply.body_md ? (
                                <p className="mt-2 text-[0.75rem] text-[#dcfff2]/80">{reply.body_md}</p>
                              ) : (
                                <p className="mt-2 text-[0.75rem] italic text-[#dcfff2]/60">Removed by a moderator.</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <form onSubmit={(event) => handleSubmitReply(event, post.id)} className="space-y-2">
                        <textarea
                          value={draft}
                          onChange={(event) => handleReplyDraftChange(post.id, event.target.value)}
                          placeholder={profile ? "Reply to this comment" : "Sign in to reply"}
                          disabled={!profile || replyLoading[post.id]}
                          className="h-24 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-[#7bffc8] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <button
                          type="submit"
                          disabled={!profile || replyLoading[post.id]}
                          className="inline-flex items-center justify-center rounded-full border border-[#7bffc8]/70 bg-[#7bffc8]/20 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-white transition hover:border-[#7bffc8] hover:bg-[#7bffc8]/80 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {replyLoading[post.id] ? "Posting…" : "Reply"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
