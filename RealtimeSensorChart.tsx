import { useEffect, useMemo, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TelemetryMessage = {
  type: "telemetry";
  source: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  quality: "good" | "uncertain" | "bad";
};

type ChartPoint = { time: string; timestamp: string; [key: string]: string | number };

const COLORS = ["#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"];

export interface RealtimeSensorChartProps {
  wsUrl: string;
  metrics: string[];
  maxPoints?: number;
}

export function RealtimeSensorChart({ wsUrl, metrics, maxPoints = 60 }: RealtimeSensorChartProps) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting" | "closed">("connecting");
  const [lastError, setLastError] = useState<string | null>(null);
  const retry = useRef(0);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed) return;
      setStatus(retry.current ? "reconnecting" : "connecting");
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        retry.current = 0;
        setStatus("connected");
        socket?.send(JSON.stringify({ type: "subscribe", metrics }));
      };
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as TelemetryMessage;
          if (message.type !== "telemetry" || !metrics.includes(message.metric)) return;
          const date = new Date(message.timestamp);
          setPoints(previous => {
            const next = [...previous, {
              time: date.toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
              timestamp: message.timestamp,
              [message.metric]: message.value,
            }];
            return next.slice(-maxPoints);
          });
          setLastError(null);
        } catch {
          setLastError("پیام دریافتی از سنسور معتبر نیست");
        }
      };
      socket.onerror = () => setLastError("خطا در اتصال WebSocket");
      socket.onclose = () => {
        if (disposed) return;
        retry.current += 1;
        setStatus("reconnecting");
        const delay = Math.min(30_000, 500 * 2 ** Math.min(retry.current, 6)) + Math.round(Math.random() * 250);
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      socket?.close(1000, "component unmounted");
      setStatus("closed");
    };
  }, [wsUrl, maxPoints, metrics.join(",")]);

  const latest = useMemo(() => points.at(-1), [points]);
  const statusClass = status === "connected" ? "bg-emerald-400" : status === "reconnecting" ? "bg-amber-400" : "bg-slate-500";

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-950/80 p-5 text-slate-100 shadow-xl">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">مانیتورینگ بلادرنگ سنسورها</h2>
          <p className="mt-1 text-xs text-slate-400">{points.length} نقطه‌ی اخیر، حداکثر {maxPoints} نقطه</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className={`h-2.5 w-2.5 rounded-full ${statusClass}`} />
          <span>{status === "connected" ? "متصل" : status === "reconnecting" ? "در حال اتصال مجدد" : status === "connecting" ? "در حال اتصال" : "بسته"}</span>
        </div>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} width={42} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12 }} />
            {metrics.map((metric, index) => <Line key={metric} type="monotone" dataKey={metric} connectNulls stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.map((metric, index) => (
          <span key={metric} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{metric}: {latest?.[metric] ?? "—"}
          </span>
        ))}
      </div>
      {lastError && <p className="mt-3 text-xs text-rose-300">{lastError}</p>}
    </section>
  );
}
