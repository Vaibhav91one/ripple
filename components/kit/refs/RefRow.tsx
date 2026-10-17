// One reviewed component: the reference screenshot, the replica (inside a reference skin) and the Ripple version.
// Screenshots live in public/refs (gitignored, local only); without one the pane links to the post.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import "./skins.css";

export type Skin = "nizam" | "sakani" | "gr8r" | "proton" | "push";
export type License = "MIT port" | "spec rebuild" | "image recreation";

const hasRef = (img: string) => existsSync(join(process.cwd(), "public", "refs", img));

export function RefRow({ n, name, from, post, license, img, crop = "center", skin, wide, replica, ripple }: {
  n: number; name: string; from: string; post: string; license: License;
  /** File in public/refs, e.g. "05-invoice-exceptions.jpg". */
  img: string;
  /** CSS object-position that frames the part of the screenshot this component comes from. */
  crop?: string;
  skin: Skin; wide?: boolean; replica: ReactNode; ripple: ReactNode;
}) {
  const pane = "min-w-0 space-y-2";
  const label = "text-xs text-faint";
  return (
    <article id={`ref-${n}`} className="space-y-3 border-t border-hairline pt-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-md text-strong"><span className="mr-2 font-mono text-faint">{n}</span>{name}</h3>
        <p className="text-xs text-faint">
          {from} · <a href={post} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-body">source</a> · {license}
        </p>
      </header>
      <div className={`grid grid-cols-1 gap-4 ${wide ? "" : "lg:grid-cols-[1fr_2fr_2fr]"}`}>
        <div className={pane}>
          <p className={label}>Reference</p>
          {hasRef(img) ? (
            // eslint-disable-next-line @next/next/no-img-element -- local-only screenshot, not optimised on purpose
            <img src={`/refs/${img}`} alt={`${from} reference`} className={`w-full rounded-lg border border-hairline object-cover ${wide ? "max-h-[420px]" : "h-72"}`} style={{ objectPosition: crop }} />
          ) : (
            <a href={post} target="_blank" rel="noreferrer" className="flex h-24 items-center justify-center rounded-lg border border-dashed border-hairline text-faint hover:text-body">
              Open the reference post
            </a>
          )}
        </div>
        <div className={pane}>
          <p className={label}>Replica</p>
          <div className={`skin-${skin} overflow-x-auto rounded-lg bg-page p-5 text-body`}>{replica}</div>
        </div>
        <div className={pane}>
          <p className={label}>Ripple</p>
          <div className="skin-ripple overflow-x-auto rounded-lg border border-hairline bg-page p-5 text-body">{ripple}</div>
        </div>
      </div>
    </article>
  );
}
