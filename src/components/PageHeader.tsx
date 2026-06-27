import { ReactNode } from "react";

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  stats?: ReactNode;
  actions?: ReactNode;
  searchBlock?: ReactNode;
  filtersBlock?: ReactNode;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  stats,
  actions,
  searchBlock,
  filtersBlock,
}: PageHeaderProps) {
  return (
    <div className="px-8 py-5 border-b border-[var(--bd-faint)] space-y-5 bg-[var(--bg-deep)]/80 backdrop-blur-xl sticky top-0 z-30 flex-shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--tx-base)] leading-none">{title}</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1.5">{subtitle}</p>
          </div>
        </div>
        
        {(stats || actions) && (
          <div className="flex items-center gap-4 text-end">
            {stats && <div>{stats}</div>}
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        )}
      </div>

      {(searchBlock || filtersBlock) && (
        <div className="flex flex-wrap items-center gap-4">
          {searchBlock && <div className="flex-1 max-w-md">{searchBlock}</div>}
          {filtersBlock && <div className="flex flex-wrap items-center gap-2">{filtersBlock}</div>}
        </div>
      )}
    </div>
  );
}
