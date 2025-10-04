import { redirect } from "next/navigation";

export default function LegacyChatRedirect(): JSX.Element | null {
  redirect("/community");
}

