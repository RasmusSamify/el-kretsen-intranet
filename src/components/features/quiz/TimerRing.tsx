interface TimerRingProps {
  timeLeft: number;
  total: number;
}

export function TimerRing({ timeLeft, total }: TimerRingProps) {
  const r = 34;
  const cx = 42;
  const cy = 42;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - timeLeft / total);
  const color = timeLeft > 10 ? 'var(--brand-500)' : timeLeft > 5 ? '#D97706' : '#DC2626';

  return (
    <div className="relative" style={{ width: 84, height: 84 }}>
      <svg width="84" height="84" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-200)" strokeWidth={6} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-ink-900"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800 }}
      >
        {timeLeft}
      </div>
    </div>
  );
}
