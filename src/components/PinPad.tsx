import { Delete, CornerDownLeft } from "lucide-react";

interface Props {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export default function PinPad({ onDigit, onBackspace, onSubmit, disabled, loading }: Props) {
  return (
    <div className="w-full space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k, i) => {
          if (k === "") return <div key={i} />;

          if (k === "⌫") {
            return (
              <button
                key={i}
                onClick={onBackspace}
                disabled={disabled}
                className="h-14 rounded-xl bg-[#1A2A44] border border-[#1E3050] text-slate-300 hover:bg-[#243558] hover:border-[#2D4A70] hover:text-white active:scale-95 transition-all duration-100 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Delete size={18} />
              </button>
            );
          }

          return (
            <button
              key={i}
              onClick={() => onDigit(k)}
              disabled={disabled}
              className="h-14 rounded-xl bg-[#1A2A44] border border-[#1E3050] text-white text-xl font-semibold hover:bg-[#1E3050] hover:border-[#14B8A6]/40 hover:text-[#14B8A6] active:scale-95 active:bg-[#14B8A6]/10 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {k}
            </button>
          );
        })}
      </div>

      <button
        onClick={onSubmit}
        disabled={disabled || loading}
        className="w-full h-12 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] active:scale-[0.98] text-slate-900 font-bold text-base transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#14B8A6]/20"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
        ) : (
          <>
            <span>Unlock</span>
            <CornerDownLeft size={16} />
          </>
        )}
      </button>
    </div>
  );
}
