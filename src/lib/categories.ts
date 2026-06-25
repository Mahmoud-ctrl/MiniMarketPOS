import { Category } from "../types";

export interface CategoryGroup {
  parent: Category;
  children: Category[];
}

export function groupCategories(cats: Category[]): CategoryGroup[] {
  const parents = cats
    .filter(c => c.parent_id === null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const childMap = new Map<number, Category[]>();
  for (const c of cats) {
    if (c.parent_id !== null) {
      const arr = childMap.get(c.parent_id) ?? [];
      arr.push(c);
      childMap.set(c.parent_id, arr);
    }
  }

  return parents.map(p => ({
    parent: p,
    children: (childMap.get(p.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
