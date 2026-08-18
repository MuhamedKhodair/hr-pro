'use client';

export function ChartTooltip({ active, payload, label, formatter, labelFormatter }: {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string | number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-[140px] rounded-lg border border-border bg-card px-3 py-2 shadow-[0_4px_16px_rgba(16,24,40,0.1)]">
      {label != null && (
        <p className="mb-1.5 border-b border-border pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color || p.payload?.fill || 'var(--primary)' }}
              />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatter ? formatter(p.value, p.name) : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
