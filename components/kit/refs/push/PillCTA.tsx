// Hero with a floating pill navbar, a huge tight headline, one white pill button and a caption.
export function PillCTA({ brand, links, cta, headline, sub, button, caption }: {
  brand: string; links: string[]; cta: string;
  /** One entry per line. */
  headline: string[]; sub: string; button: string; caption: string;
}) {
  return (
    <div className="mx-auto @container flex w-full max-w-[360px] flex-col items-center py-2 text-center">
      <nav aria-label={brand} className="flex items-center gap-3 rounded-full border border-hairline bg-surface py-1 pl-4 pr-1">
        <span className="mr-1 text-[17px] font-black tracking-tighter text-strong">{brand}</span>
        {links.map((l) => <a key={l} href="#push" className="text-[12px] text-body hover:text-strong focus-visible:outline-2 focus-visible:outline-ripple">{l}</a>)}
        <a href="#push" className="whitespace-nowrap rounded-full bg-raised px-3 py-1.5 text-[13px] text-strong focus-visible:outline-2 focus-visible:outline-ripple">{cta}</a>
      </nav>
      <h1 className="mt-6 whitespace-nowrap text-[min(42px,11.4cqw)] font-semibold leading-[0.98] tracking-[-0.045em] text-strong">
        {headline.map((l) => <span key={l} className="block">{l}</span>)}
      </h1>
      <p className="mt-4 max-w-[270px] text-balance text-[14px] leading-snug text-faint">{sub}</p>
      <button type="button" className="mt-6 h-[46px] w-[190px] rounded-full bg-strong text-[14px] font-medium text-page outline-none focus-visible:ring-2 focus-visible:ring-ripple focus-visible:ring-offset-2 focus-visible:ring-offset-page">
        {button}
      </button>
      <p className="mt-3 text-[11px] text-faint">{caption}</p>
    </div>
  );
}
