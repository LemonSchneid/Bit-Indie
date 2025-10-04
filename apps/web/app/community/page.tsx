import { CommunityPageClient } from "../../components/community/community-page-client";
import { MatteShell } from "../../components/layout/matte-shell";
import { listCommunityTags, listCommunityThreads } from "../../lib/api";

export default async function CommunityPage(): Promise<JSX.Element> {
  const [threads, tags] = await Promise.all([
    listCommunityThreads({ limit: 50 }),
    listCommunityTags(50),
  ]);

  return (
    <MatteShell>
      <CommunityPageClient initialThreads={threads} tags={tags} />
    </MatteShell>
  );
}
