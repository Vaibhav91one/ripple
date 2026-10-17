import { CircleCheck } from "lucide-react";

export type TrustChecklistProps = {
  heading: string;
  items: { title: string; sub: string }[];
};

export function TrustChecklist({ heading, items }: TrustChecklistProps) {
  return (
    <section>
      <h4 className="text-xs font-medium text-strong">{heading}</h4>
      <ul className="mt-3 space-y-3">
        {items.map((it) => (
          <li key={it.title} className="flex items-start gap-2.5">
            <CircleCheck size={15} className="mt-px shrink-0 text-covered" aria-hidden />
            <div>
              <p className="text-xs font-medium leading-4 text-strong">{it.title}</p>
              <p className="mt-0.5 text-2xs leading-4 text-faint">{it.sub}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
