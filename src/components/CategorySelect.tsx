import { Category } from "../types";
import { groupCategories } from "../lib/categories";

const BASE = "w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--bd-base)] focus:border-[#14B8A6]/50 focus:outline-none rounded-xl text-[var(--tx-base)] text-sm transition-colors cursor-pointer";

export default function CategorySelect({
  value,
  onChange,
  categories,
  className,
  placeholder = "— None —",
}: {
  value: string;
  onChange: (v: string) => void;
  categories: Category[];
  className?: string;
  placeholder?: string;
}) {
  const groups = groupCategories(categories);

  return (
    <select
      className={className ?? BASE}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {groups.map(({ parent, children }) =>
        children.length > 0 ? (
          <optgroup key={parent.id} label={parent.name}>
            {children.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        ) : (
          <option key={parent.id} value={parent.id}>{parent.name}</option>
        )
      )}
    </select>
  );
}
