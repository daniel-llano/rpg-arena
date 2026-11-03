interface Props {
  side: "hero" | "enemy";
  title: string;
  subtitle?: string;
  hp: number;
  maxHp: number;
  stats: string;
}

export function FighterCard({ side, title, subtitle, hp, maxHp, stats }: Props) {
  const percent = maxHp > 0 ? Math.round((100 * hp) / maxHp) : 0;
  return (
    <div className={`panel fighter ${side}`}>
      <div className="name">
        <strong id={`${side}-title`}>{title}</strong> {subtitle && <span id={`${side}-sub`} className="muted">{subtitle}</span>}
      </div>
      <div className="bar" role="meter" aria-label={`${title} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
        <div id={`${side}-hp`} className={`fill ${side}${percent <= 25 ? " low" : ""}`} style={{ width: `${percent}%` }} />
      </div>
      <div id={`${side}-stats`} className="muted small">
        {stats}
      </div>
    </div>
  );
}
