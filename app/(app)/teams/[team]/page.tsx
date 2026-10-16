import { notFound } from "next/navigation";
import { TEAMS, isTeamId } from "@/components/shell/nav";

export function generateStaticParams() {
  return TEAMS.map((t) => ({ team: t.id }));
}

export default async function TeamPage({ params }: PageProps<"/teams/[team]">) {
  const { team } = await params;
  if (!isTeamId(team)) notFound();
  const label = TEAMS.find((t) => t.id === team)?.label;
  return <p className="p-6 text-body">{label} workspace: coming in the v2 dashboard.</p>;
}
