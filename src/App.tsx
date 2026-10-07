import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type CandlePoint = {
  time: string;
  price: number;
};

type GoldSnapshot = {
  price: number;
  previousClose: number;
  high: number;
  low: number;
  source: string;
  isFallback: boolean;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);

const generateSeries = (base: number): CandlePoint[] => {
  const points: CandlePoint[] = [];
  let current = base * 0.985;
  const now = new Date();

  for (let i = 23; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    current += (Math.random() - 0.45) * 6;
    points.push({
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: Number(current.toFixed(2)),
    });
  }

  return points;
};

const getNestedValue = (obj: Record<string, any>, path: string[]): any => {
  let cursor: any = obj;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object' || !(key in cursor)) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
};

const normalizePrice = (payload: any): number | null => {
  const candidates = [
    ['price'],
    ['data', 'price'],
    ['data', 'rate'],
    ['data', 'gold', 'price'],
    ['data', 'gold', 'price_gram_24k'],
    ['gold', 'price'],
    ['gold', 'price_usd'],
    ['gold', 'gold_price'],
    ['rates', 'XAU'],
    ['rates', 'USD'],
    ['xau', 'price'],
    ['meta', 'price'],
    ['result'],
    ['price_gram_24k'],
    ['price_ounce'],
  ];

  for (const path of candidates) {
    const value = getNestedValue(payload, path);
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }

  return null;
};

const fetchGoldData = async (): Promise<GoldSnapshot> => {
  const demoBase = 2345.12;
  const endpoints = [
    'https://api.gold-api.com/price/XAU/USD',
    'https://api.gold-api.com/price/XAU/THB',
    'https://livegoldsilver.com/api',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) continue;

      const data = await response.json();
      const price = normalizePrice(data);
      if (price) {
        const previousClose = price * 0.992;
        const high = price + Math.random() * 18;
        const low = price - Math.random() * 14;

        return {
          price,
          previousClose,
          high,
          low,
          source: endpoint,
          isFallback: false,
        };
      }
    } catch (error) {
      console.warn(`Failed to load price from ${endpoint}:`, error);
    }
  }

  const fallbackPrice = demoBase + Math.random() * 30;
  const previousClose = fallbackPrice - 22;
  return {
    price: Number(fallbackPrice.toFixed(2)),
    previousClose: Number(previousClose.toFixed(2)),
    high: Number((fallbackPrice + 16).toFixed(2)),
    low: Number((fallbackPrice - 18).toFixed(2)),
    source: 'Demo fallback data',
    isFallback: true,
  };
};

function App() {
  const [snapshot, setSnapshot] = useState<GoldSnapshot>({
    price: 2345.12,
    previousClose: 2321.43,
    high: 2361.1,
    low: 2315.7,
    source: 'Loading…',
    isFallback: true,
  });
  const [history, setHistory] = useState<CandlePoint[]>(() => generateSeries(2345.12));
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const next = await fetchGoldData();
      setSnapshot(next);
      setHistory((prev) => {
        const series = [...prev.slice(-23), { time: 'Now', price: next.price }];
        return series;
      });
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };

    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const change = snapshot.price - snapshot.previousClose;
  const changePercent = (change / snapshot.previousClose) * 100;
  const trend = change >= 0 ? 'Bullish' : 'Bearish';

  const averagePrice = useMemo(
    () => history.reduce((sum, item) => sum + item.price, 0) / history.length,
    [history]
  );

  const buyZone = snapshot.price <= snapshot.previousClose * 0.995;
  const sellZone = snapshot.price >= snapshot.previousClose * 1.005;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Market Pulse</p>
          <h1>Gold Trading Dashboard</h1>
        </div>
        <div className="status-pill">{snapshot.isFallback ? 'Demo mode' : 'Live feed'}</div>
      </header>

      <main className="dashboard">
        <section className="hero card">
          <div>
            <span className="label">XAU/USD</span>
            <h2>{formatMoney(snapshot.price)}</h2>
            <div className={`price-change ${change >= 0 ? 'up' : 'down'}`}>
              {change >= 0 ? '+' : ''}
              {formatMoney(change)} ({changePercent >= 0 ? '+' : ''}
              {changePercent.toFixed(2)}%)
            </div>
          </div>
          <div className="meta-box">
            <p>Updated</p>
            <strong>{lastUpdated || 'Awaiting feed'}</strong>
            <small>{snapshot.source}</small>
          </div>
        </section>

        <section className="stats-grid">
          <div className="card statistic">
            <span>High</span>
            <strong>{formatMoney(snapshot.high)}</strong>
          </div>
          <div className="card statistic">
            <span>Low</span>
            <strong>{formatMoney(snapshot.low)}</strong>
          </div>
          <div className="card statistic">
            <span>Daily Avg</span>
            <strong>{formatMoney(averagePrice)}</strong>
          </div>
          <div className="card statistic">
            <span>Trend</span>
            <strong>{trend}</strong>
          </div>
        </section>

        <section className="card chart-card">
          <div className="section-head">
            <h3>Gold Price</h3>
            <span>{snapshot.isFallback ? 'Sample market data' : 'Real time market'}</span>
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <AreaChart data={history} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f4c86b" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#f4c86b" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: '#d0d7e6', fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 20', 'dataMax + 20']}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  tick={{ fill: '#d0d7e6', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [formatMoney(Number(value)), 'Gold Price']}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                />
                <Area type="monotone" dataKey="price" stroke="#f4c86b" strokeWidth={3} fill="url(#goldFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="card signal-box">
            <div className="section-head">
              <h3>Trade Signal</h3>
            </div>
            <div className={`signal ${buyZone ? 'buy' : sellZone ? 'sell' : 'hold'}`}>
              {buyZone ? 'BUY ZONE' : sellZone ? 'SELL ZONE' : 'HOLD ZONE'}
            </div>
            <ul>
              <li>Entry: {formatMoney(snapshot.price * 0.995)}</li>
              <li>Exit: {formatMoney(snapshot.price * 1.005)}</li>
              <li>Risk: {formatCompact(snapshot.price * 0.02)}</li>
            </ul>
          </div>

          <div className="card note-box">
            <div className="section-head">
              <h3>Trading Notes</h3>
            </div>
            <p>
              This dashboard is for market monitoring only. It does not provide financial advice and
              should be used together with independent analysis.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
