import { ComingSoon } from "@/components/states/ComingSoon";

export default function HomePage() {
  return (
    <ComingSoon title="Home" href="/inbox" linkLabel="Open the inbox">
      One place for what needs you today: briefs to acknowledge, reviews waiting on you and decisions that touch your team. Until then, the inbox has all of it.
    </ComingSoon>
  );
}
