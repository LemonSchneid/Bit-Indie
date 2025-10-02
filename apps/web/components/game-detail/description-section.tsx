import { getDescriptionParagraphs } from "./utils";

type GameDetailDescriptionProps = {
  description: string | null;
};

export function GameDetailDescription({ description }: GameDetailDescriptionProps): JSX.Element {
  const paragraphs = getDescriptionParagraphs(description);

  return (
    <article className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-8 text-base leading-7 text-[#dcfff2]/80 shadow-[0_0_45px_rgba(123,255,200,0.08)]">
      {paragraphs.length > 0 ? (
        paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-[#f3fff9]/85">
            {paragraph}
          </p>
        ))
      ) : (
        <p className="rounded-2xl border border-dashed border-white/20 bg-[#080808]/80 p-6 text-[#b8ffe5]/60">
          The developer hasn&apos;t shared a full description yet. Check back soon for gameplay details and download instructions.
        </p>
      )}
    </article>
  );
}
