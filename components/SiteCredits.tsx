// Licence attribution for the third-party component kits (see THIRD_PARTY_NOTICES.md).
const credits = [
  ["Rare UI", "https://rareui.com"],
  ["Beautiful UI", "https://www.beautifului.dev"],
  ["Bencho", "https://bencho.dev"],
] as const;

export function SiteCredits() {
  return (
    <footer className="px-8 py-6 text-center text-xs text-faint">
      Components by{" "}
      {credits.map(([name, href], i) => (
        <span key={name}>
          {i > 0 && (i === credits.length - 1 ? " and " : ", ")}
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-body">
            {name}
          </a>
        </span>
      ))}
    </footer>
  );
}
