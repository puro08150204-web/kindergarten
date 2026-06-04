import { clsx } from "clsx";

export function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "tap w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base outline-none transition focus:border-leaf focus:ring-4 focus:ring-leaf/15";

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      className={clsx(
        "tap inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-leaf text-white hover:bg-leaf/90",
        variant === "secondary" && "border border-ink/15 bg-white text-ink hover:bg-sky/30",
        variant === "danger" && "bg-coral text-white hover:bg-coral/90",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "bg-ink/10 text-ink",
        tone === "good" && "bg-leaf/[0.12] text-leaf",
        tone === "warn" && "bg-honey/25 text-ink",
        tone === "bad" && "bg-coral/[0.15] text-coral"
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = "good"
}: {
  children: React.ReactNode;
  tone?: "good" | "bad";
}) {
  return (
    <div
      className={clsx(
        "rounded-md px-3 py-2 text-sm font-medium",
        tone === "good" && "bg-leaf/[0.12] text-leaf",
        tone === "bad" && "bg-coral/[0.15] text-coral"
      )}
    >
      {children}
    </div>
  );
}
