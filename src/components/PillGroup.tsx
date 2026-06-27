import { ReactNode } from "react";

export function PillGroup<T extends string | number>({
  options, value, onChange,
}: {
  options: { id: T; label: ReactNode }[];
  value:   T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-2xl p-1 gap-0.5 shadow-sm">
      {options.map(o => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            value === o.id
              ? "bg-[#14B8A6] text-slate-900 shadow-[0_4px_14px_0_rgba(20,184,166,0.39)]"
              : "text-slate-500 hover:text-[var(--tx-base)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
