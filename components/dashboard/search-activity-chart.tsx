"use client";

const POINTS = [2, 14, 3, 3, 22, 4, 18, 9];

const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SearchActivityChart() {
  const width = 520;
  const height = 200;
  const padding = 28;
  const max = Math.max(...POINTS, 1);
  const step = (width - padding * 2) / (POINTS.length - 1);

  const coordinates = POINTS.map((value, index) => {
    const x = padding + index * step;
    const y = height - padding - (value / max) * (height - padding * 2);
    return { x, y, value };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`;

  return (
    <div className="dash-panel h-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-gray-300">
            ⌁
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Search Activity</h3>
            <p className="text-xs text-gray-400">Last 7 days</p>
          </div>
        </div>
        <span className="text-2xl font-semibold text-white">67</span>
      </div>

      <svg className="w-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => {
          const y = padding + (line * (height - padding * 2)) / 3;
          return (
            <line
              key={line}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
            />
          );
        })}
        <path d={areaPath} fill="url(#chartFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        {coordinates.map((point) => (
          <circle
            key={point.x}
            cx={point.x}
            cy={point.y}
            fill="#000000"
            r="5"
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="mt-2 flex justify-between px-1 text-[11px] text-gray-500">
        {LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
