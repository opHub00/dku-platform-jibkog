export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "navy" | "sand";
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}
