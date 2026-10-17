/** Registry of item kinds (a decision, a ticket, a contract...) for the item page. Filled by the item-page issue. */
export type ItemKind = string;

export interface ItemAdapter {
  kind: ItemKind;
  /** Load one item of this kind by id, or null when it does not exist. */
  load: (id: string) => Promise<unknown | null>;
}

export const ITEM_KINDS: Record<ItemKind, ItemAdapter> = {};
