import { useEffect, useState } from 'react';
import { api } from '../api';

const DAY_LABELS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

function formatDayLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return DAY_LABELS[d.getUTCDay()];
}

function BarChart({ data }) {
  const width = 320;
  const height = 160;
  const padding = { top: 16, right: 8, bottom: 28, left: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((d) => d.count));
  const barCount = data.length;
  const slot = chartW / barCount;
  const barW = Math.max(8, slot * 0.6);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Zobrazení posledních 7 dní"
      style={{ display: 'block' }}
    >
      {data.map((d, i) => {
        const h = (d.count / max) * chartH;
        const x = padding.left + i * slot + (slot - barW) / 2;
        const y = padding.top + (chartH - h);
        return (
          <g key={d.date}>
            {d.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="11"
                fill="#374151"
              >
                {d.count}
              </text>
            )}
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(0, h)}
              fill="#b91c1c"
              rx="3"
            />
            <text
              x={x + barW / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#6b7280"
            >
              {formatDayLabel(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AnalyticsCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.analytics()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">Chyba při načítání statistik: {error}</p>;
  if (!data) return <p className="muted">Načítání statistik…</p>;

  return (
    <div>
      <div className="card">
        <div className="row-spread" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#b91c1c', lineHeight: 1 }}>
              {data.total_views_7d}
            </div>
            <div className="muted">zobrazení tento týden</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#1f2937', lineHeight: 1 }}>
              {data.total_views_30d}
            </div>
            <div className="muted">zobrazení za 30 dní</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>Zobrazení po dnech (posledních 7 dní)</h3>
        <BarChart data={data.views_by_day} />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 12px' }}>Top 5 nejčastěji zobrazených položek</h3>
        {data.top_items.length === 0 ? (
          <p className="muted">Zatím žádné položky.</p>
        ) : (
          <div>
            {data.top_items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: i === data.top_items.length - 1 ? 'none' : '1px solid #f3f4f6',
                }}
              >
                <span>
                  <span style={{ color: '#9ca3af', marginRight: 8 }}>{i + 1}.</span>
                  {it.name}
                </span>
                <span className="muted">{it.view_count}×</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
