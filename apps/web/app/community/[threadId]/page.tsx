import { notFound } from "next/navigation";

import { CommunityThreadView } from "../../../components/community/thread-view";
import { MatteShell } from "../../../components/layout/matte-shell";
import { getCommunityThread } from "../../../lib/api";

type CommunityThreadPageProps = {
  params: {
    threadId: string;
  };
};

export default async function CommunityThreadPage({ params }: CommunityThreadPageProps): Promise<JSX.Element> {
  const { threadId } = params;

  try {
    const thread = await getCommunityThread(threadId);
    return (
      <MatteShell>
        <CommunityThreadView initialThread={thread} />
      </MatteShell>
    );
  } catch (error) {
    notFound();
  }
}

