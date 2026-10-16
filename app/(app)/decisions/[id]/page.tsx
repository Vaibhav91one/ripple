import { RippleHome } from "@/components/ripple/RippleHome";

// The decision id comes from the route; useDecisionId reads it from there (falling back to ?d=).
export default function DecisionPage() {
  return <RippleHome />;
}
