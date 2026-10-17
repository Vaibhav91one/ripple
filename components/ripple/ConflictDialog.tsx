"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useState } from "react";
import { ConflictDetail, type Choice } from "@/components/panels/ConflictDetail";
import { getRipple } from "@/lib/api";
import { useDecisionId } from "./useDecisionId";

const RESULT: Record<Choice, string> = {
  acknowledge: "Legal acknowledged the conflict. The gap shrinks once the ack is written.",
  move_date: "Proposal sent to Eng: move the sunset after Jun 30.",
  negotiate: "Task created for Legal: negotiate clause 7.2 with both customers.",
};

// Conflict detail as a dialog over the Ripple screen, opened with ?conflict=open.
export function ConflictDialog() {
  const [conflict, setConflict] = useQueryState("conflict", parseAsString);
  const [d] = useDecisionId();
  const { data } = useQuery({ queryKey: ["ripple", d], queryFn: () => getRipple(d), enabled: !!conflict });
  const [done, setDone] = useState<Choice | null>(null);
  const c = data?.conflicts.find((x) => x.id === conflict) ?? data?.conflicts[0];
  const close = () => { setConflict(null); setDone(null); };
  return (
    <Dialog.Root open={!!conflict && !!c} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-page/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(880px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 outline-none">
          <Dialog.Title className="sr-only">Conflict detail</Dialog.Title>
          <Dialog.Description className="sr-only">The RFC sentence and the contract clauses that disagree, and how to resolve it.</Dialog.Description>
          <Dialog.Close className="absolute -top-9 right-0 rounded-md p-1.5 text-faint hover:text-strong transition-colors" aria-label="Close"><X className="size-4" /></Dialog.Close>
          {c && data && <ConflictDetail conflict={c} arrAtRisk={data.counts.arrAtRisk} onResolve={setDone} />}
          {done && <p role="status" className="mt-3 rounded-md bg-covered-soft px-3 py-2 text-sm text-covered">{RESULT[done]}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
