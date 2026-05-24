export function Alert({ tone, message }: { tone: "error" | "success" | "info"; message: string }) {
  return (
    <div className={`alert ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="alert-icon">{tone === "error" ? "!" : tone === "success" ? "✓" : "i"}</span>
      <p>{message}</p>
    </div>
  );
}
