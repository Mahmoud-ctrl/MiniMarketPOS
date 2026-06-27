import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export default function Modal({ title, onClose, children, width = "max-w-lg" }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div className={`relative ${width} w-full bg-[var(--bg-panel)] border border-[var(--bd-base)] rounded-3xl shadow-2xl modal-enter flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--bd-faint)] flex-shrink-0">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--tx-base)]">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl text-slate-500 hover:text-[var(--tx-base)] hover:bg-[var(--bg-base)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
