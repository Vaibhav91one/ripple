import { LOGOS } from "./logos";

export type BrandName = keyof typeof LOGOS;

// Inline brand logo. Server component, no runtime dependency on the icon packages.
// Monochrome logos inherit colour from `currentColor`; colour logos keep their brand fills.
export function BrandIcon({ name, size = 20, className, title }: { name: BrandName; size?: number; className?: string; title?: string }) {
  const logo = LOGOS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={logo.viewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: logo.body }}
    />
  );
}
