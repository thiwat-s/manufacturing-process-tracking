'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { api, formatDate, statusClass } from '@/lib/client';
import type { ProductionEventRecord } from '@/types/production';
type DashboardEvent = ProductionEventRecord & {
  orderId: string;
  order: { orderNumber: string };
};
type DashboardData = {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  stepOverview: {
    id: string;
    name: string;
    readyToStart: number;
    inProgress: number;
    completed: number;
  }[];
  resourceConsumption: {
    resourceId: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
  }[];
  recentEvents: DashboardEvent[];
};
export function Dashboard() {
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ data: DashboardData }>('/api/dashboard')
      .then((x) => setData(x.data))
      .catch((e) => setError(e.message));
  }, []);
  const kpis = [
    ['Total orders', data?.totalOrders],
    ['Pending', data?.pendingOrders],
    ['In progress', data?.inProgressOrders],
    ['Completed', data?.completedOrders],
  ];
  return (
    <Shell>
      <div className="pagehead">
        <div>
          <div className="eyebrow">OPERATIONS / OVERVIEW</div>
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">A live view of manufacturing activity across your facility.</p>
        </div>
        <Link className="button primary" href="/orders">
          Create order&nbsp; +
        </Link>
      </div>
      {error && (
        <div className="panel" style={{ color: '#b42318' }}>
          Could not load live dashboard data: {error}. Check the database connection and seed data.
        </div>
      )}
      <section className="kpis grid">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}>
            <div className="kpilabel">{label}</div>
            <div className="kpivalue">{value ?? '—'}</div>
            <div className="kpinote">Live order records</div>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panelhead">
          <h2 className="paneltitle">Production step overview</h2>
          <Link className="link" href="/production">
            Open production board&nbsp; →
          </Link>
        </div>
        {!data ? (
          <div className="empty">Loading production metrics…</div>
        ) : (
          data.stepOverview.map((s, i) => (
            <div className="step-row" key={s.id}>
              <span>
                {String(i + 1).padStart(2, '0')} &nbsp;{s.name}
              </span>
              <div className="track">
                <div
                  className="fill"
                  style={{
                    width: `${Math.min(100, (s.completed + s.inProgress + s.readyToStart) * 8)}%`,
                  }}
                />
              </div>
              <span className="muted">{s.inProgress} active</span>
              <span className="muted">{s.readyToStart} ready</span>
            </div>
          ))
        )}
      </section>
      <div className="dashboard-panels grid">
        <section className="panel">
          <div className="panelhead">
            <h2 className="paneltitle">Resource consumption</h2>
            <Link className="link" href="/resources">
              Resources
            </Link>
          </div>
          {!data ? (
            <div className="empty">Loading resource usage…</div>
          ) : data.resourceConsumption.length === 0 ? (
            <div className="empty">No consumption has been recorded yet.</div>
          ) : (
            <>
              <p className="table-hint">Swipe horizontally to view all columns.</p>
              <div
                className="tablewrap"
                tabIndex={0}
                role="region"
                aria-label="Resource consumption summary"
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Category</th>
                      <th>Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.resourceConsumption.slice(0, 6).map((r) => (
                      <tr key={`${r.resourceId}-${r.name}-${r.category}-${r.unit}`}>
                        <td>
                          <b>{r.name}</b>
                          <br />
                          <span className="muted">
                            {r.quantity.toLocaleString()} {r.unit}
                          </span>
                        </td>
                        <td>{r.category.replaceAll('_', ' ')}</td>
                        <td>{r.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
        <section className="panel">
          <div className="panelhead">
            <h2 className="paneltitle">Recent production activity</h2>
          </div>
          {!data ? (
            <div className="empty">Loading activity…</div>
          ) : data.recentEvents.length === 0 ? (
            <div className="empty">No activity has been recorded.</div>
          ) : (
            <div className="timeline">
              {data.recentEvents.map((e) => (
                <div className="event" key={e.id}>
                  <b>{e.description}</b>
                  <div className="muted" style={{ marginTop: 5 }}>
                    <Link className="link" href={`/orders/${e.orderId}`}>
                      {e.order.orderNumber}
                    </Link>{' '}
                    · {formatDate(e.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
