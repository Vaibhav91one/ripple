"use client";

import { useQuery } from "@tanstack/react-query";
import { getNames, getTeamDashboard } from "@/lib/api";
import type { TeamDashboard, TeamId } from "@/lib/teams/dashboards";

/** The team's dashboard payload, narrowed to that team's shape. */
export function useTeamDashboard<T extends TeamId>(team: T) {
  return useQuery({
    queryKey: ["team", team],
    queryFn: () => getTeamDashboard(team) as Promise<Extract<TeamDashboard, { team: T }>>,
  });
}

/** id → display name for people, teams, systems, customers… (payload rows carry ids only). */
export function useNames() {
  const { data } = useQuery({ queryKey: ["names"], queryFn: getNames, staleTime: Infinity });
  return (id: string | null | undefined) => (id ? data?.[id] ?? id : "");
}
