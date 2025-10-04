import { buildApiUrl, requestJson } from "./core";
import { resolveSessionToken } from "./session";

export interface CommunityAuthor {
  id: string;
  display_name: string | null;
  is_admin: boolean;
}

export interface CommunityPost {
  id: string;
  thread_id: string;
  parent_post_id: string | null;
  body_md: string | null;
  is_removed: boolean;
  created_at: string;
  updated_at: string;
  reply_count: number;
  author: CommunityAuthor;
}

export interface CommunityThreadSummary {
  id: string;
  title: string | null;
  body_md: string | null;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  reply_count: number;
  tags: string[];
  author: CommunityAuthor | null;
}

export interface CommunityThreadDetail extends CommunityThreadSummary {
  posts: CommunityPost[];
}

export interface CommunityTagSummary {
  tag: string;
  thread_count: number;
}

export interface ListCommunityThreadsParams {
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCommunityThreadPayload {
  user_id: string;
  title?: string | null;
  body_md?: string | null;
  tags?: string[];
}

export interface CreateCommunityPostPayload {
  user_id: string;
  body_md: string;
  parent_post_id?: string | null;
}

export interface RemoveCommunityPostPayload {
  admin_id: string;
}

export async function listCommunityThreads(
  params: ListCommunityThreadsParams = {},
): Promise<CommunityThreadSummary[]> {
  const search = new URLSearchParams();
  if (params.tag) {
    search.set("tag", params.tag);
  }
  if (typeof params.limit === "number") {
    search.set("limit", String(params.limit));
  }
  if (typeof params.offset === "number") {
    search.set("offset", String(params.offset));
  }

  const path = search.size > 0 ? `/v1/community/threads?${search.toString()}` : "/v1/community/threads";
  return requestJson<CommunityThreadSummary[]>(path, {
    errorMessage: "Unable to load community threads.",
  });
}

export async function listCommunityTags(limit = 50): Promise<CommunityTagSummary[]> {
  const path = buildApiUrl(`/v1/community/tags?limit=${encodeURIComponent(String(limit))}`);
  return requestJson<CommunityTagSummary[]>(path, {
    errorMessage: "Unable to load community tags.",
  });
}

export async function getCommunityThread(threadId: string): Promise<CommunityThreadDetail> {
  return requestJson<CommunityThreadDetail>(`/v1/community/threads/${encodeURIComponent(threadId)}`, {
    errorMessage: "Unable to load this community thread.",
    notFoundMessage: "Community thread not found.",
  });
}

export async function createCommunityThread(
  payload: CreateCommunityThreadPayload,
  sessionToken?: string | null,
): Promise<CommunityThreadDetail> {
  const token = resolveSessionToken(sessionToken ?? null, "Sign in before starting a new thread.");
  return requestJson<CommunityThreadDetail>("/v1/community/threads", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    errorMessage: "Unable to create a community thread.",
  });
}

export async function createCommunityPost(
  threadId: string,
  payload: CreateCommunityPostPayload,
  sessionToken?: string | null,
): Promise<CommunityPost> {
  const token = resolveSessionToken(sessionToken ?? null, "Sign in before posting in the community.");
  return requestJson<CommunityPost>(`/v1/community/threads/${encodeURIComponent(threadId)}/posts`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    errorMessage: "Unable to publish your reply.",
  });
}

export async function listCommunityReplies(postId: string): Promise<CommunityPost[]> {
  return requestJson<CommunityPost[]>(`/v1/community/posts/${encodeURIComponent(postId)}/replies`, {
    errorMessage: "Unable to load replies for this post.",
    notFoundMessage: "Community post not found.",
  });
}

export async function removeCommunityPost(
  postId: string,
  payload: RemoveCommunityPostPayload,
  sessionToken?: string | null,
): Promise<CommunityPost> {
  const token = resolveSessionToken(
    sessionToken ?? null,
    "Sign in with an administrator account before moderating posts.",
  );
  return requestJson<CommunityPost>(`/v1/community/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    errorMessage: "Unable to remove this community post.",
  });
}

