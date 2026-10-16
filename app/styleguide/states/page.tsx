import { AskEmpty, GraphDownBanner, LlmDownBanner, LoadingBlock, ResetConfirm } from "@/components/states/States";

const Section = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-sm text-faint">{name}</h2>
    {children}
  </section>
);

export default function StatesStyleguide() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <h1 className="text-xl">States</h1>
      <Section name="Loading"><LoadingBlock /></Section>
      <Section name="LLM down"><LlmDownBanner /></Section>
      <Section name="Graph down"><GraphDownBanner /></Section>
      <Section name="Ask found nothing"><AskEmpty kind="nothing" question="Who owns the moon API?" /></Section>
      <Section name="Ask budget used"><AskEmpty kind="budget" /></Section>
      <Section name="Reset confirmation"><ResetConfirm /></Section>
    </main>
  );
}
