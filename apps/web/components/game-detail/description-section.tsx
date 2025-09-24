import { getDescriptionParagraphs } from "./utils";

type GameDetailDescriptionProps = {
  description: string | null;
};

export function GameDetailDescription({ description }: GameDetailDescriptionProps): JSX.Element {
  const paragraphs = getDescriptionParagraphs(description);

  return (
    <article className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-base leading-7 text-slate-300 shadow-lg shadow-emerald-500/10">
      {paragraphs.length > 0 ? (
        paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-slate-200">
            {paragraph}
          </p>
        ))
      ) : (
        <p className="rounded-2xl border border-dashed border-white/20 bg-slate-950/60 p-6 text-slate-400">
          The developer hasn&apos;t shared a full description yet. Check back soon for gameplay details and download instructions.
        </p>
      )}
    </article>
  );
}
