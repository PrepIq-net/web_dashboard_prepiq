import toast from "react-hot-toast";
import { Button } from "../ui/button";

interface ClipboardModalProps {
  open: boolean;
  title: string;
  description?: string;
  value: string | "";
  onClose: () => void;
  copyLabel?: string;
  closeLabel?: string;
  showCopy?: boolean;
}

export function ClipboardModal({
  open,
  title,
  description,
  value,
  onClose,
  copyLabel = "Copy",
  closeLabel = "Close",
  showCopy = true,
}: ClipboardModalProps) {
  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#2A2A2E] bg-[#1C1C1F] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>

          <button
            onClick={onClose}
            className="text-text-muted transition-colors hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {description && (
          <p className="mt-2 text-sm text-text-muted">{description}</p>
        )}

        <div className="mt-5">
          <input
            readOnly
            value={value}
            className="w-full rounded-xl border border-[#2A2A2E] bg-[#111113] px-4 py-3 text-sm text-text-primary outline-none"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {closeLabel}
          </Button>

          {showCopy && <Button onClick={handleCopy}>{copyLabel}</Button>}
        </div>
      </div>
    </div>
  );
}
