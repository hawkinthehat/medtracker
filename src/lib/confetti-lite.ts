/** Tiny burst for movement success — no extra npm deps. Safe to skip if DOM missing. */
export function fireMiniConfetti(origin?: { x: number; y: number }) {
  if (typeof document === "undefined") return;

  const cx =
    origin?.x ??
    (typeof window !== "undefined" ? window.innerWidth / 2 : 200);
  const cy =
    origin?.y ??
    (typeof window !== "undefined" ? window.innerHeight * 0.38 : 200);

  const colors = ["#22c55e", "#38bdf8", "#fbbf24", "#a855f7", "#f472b6"];
  const n = 28;

  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 80 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist + Math.random() * 40;
    el.style.cssText = [
      "position:fixed",
      "pointer-events:none",
      "width:9px",
      "height:9px",
      `left:${cx}px`,
      `top:${cy}px`,
      `background:${colors[i % colors.length]}`,
      "border-radius:50%",
      "z-index:9999",
      "opacity:1",
      "transition:transform 0.75s ease-out,opacity 0.75s ease-out",
    ].join(";");
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px,${dy}px) scale(0.3)`;
      el.style.opacity = "0";
    });
    window.setTimeout(() => el.remove(), 800);
  }
}
