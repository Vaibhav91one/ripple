import { PageLoading } from "@/components/states/States";
import { Suspense } from "react";
import { ItemPage } from "@/components/items/ItemPage";

// params is read inside Suspense so the shell can prerender instantly (Cache Components).
async function Item({ params }: Pick<PageProps<"/items/[kind]/[id]">, "params">) {
  const { kind, id } = await params;
  return <ItemPage kind={kind} id={id} />;
}

export default function ItemRoute({ params }: PageProps<"/items/[kind]/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Item params={params} />
    </Suspense>
  );
}
