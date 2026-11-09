'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shell } from '@/components/shell';
import { api, errorMessage, formatDate, statusClass } from '@/lib/client';
import type { OrderDetailRecord } from '@/types/production';
export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetailRecord | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ data: OrderDetailRecord }>(`/api/orders/${id}`)
      .then((x) => setOrder(x.data))
      .catch((error) => setError(errorMessage(error, 'Unable to load order details.')));
  }, [id]);
  return (
    <Shell>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            <Link className="link" href="/orders">
              ORDERS
            </Link>{' '}
            / ORDER DETAILS
          </div>
          <h1 className="title">{order?.orderNumber || 'Order details'}</h1>
          <p className="subtitle">{order?.productName || 'Loading order information…'}</p>
        </div>
        {order && (
          <span className={`pill ${statusClass(order.status)}`}>
            {order.status.replaceAll('_', ' ')}
          </span>
        )}
      </div>
      {error && (
        <div className="panel" style={{ color: '#b42318' }}>
          {error}
        </div>
      )}
      {!order ? (
        <div className="panel empty">Loading order…</div>
      ) : (
        <>
          <section className="kpis grid">
            <div className="kpi">
              <div className="kpilabel">Order quantity</div>
              <div className="kpivalue">{order.quantity}</div>
              <div className="kpinote">Units ordered</div>
            </div>
            <div className="kpi">
              <div className="kpilabel">Due date</div>
              <div className="kpivalue" style={{ fontSize: 21 }}>
                {formatDate(order.dueDate)}
              </div>
              <div className="kpinote">Target completion</div>
            </div>
            <div className="kpi">
              <div className="kpilabel">Production progress</div>
              <div className="kpivalue">{order.progress}%</div>
              <div className="track" style={{ marginTop: 10 }}>
                <div className="fill" style={{ width: `${order.progress}%` }} />
              </div>
            </div>
            <div className="kpi">
              <div className="kpilabel">Created</div>
              <div className="kpivalue" style={{ fontSize: 21 }}>
                {formatDate(order.createdAt)}
              </div>
              <div className="kpinote">Order opened</div>
            </div>
          </section>
          <section className="panel">
            <div className="panelhead">
              <h2 className="paneltitle">Production progress</h2>
            </div>
            <div className="stepslist">
              {order.steps.map((s, i) => (
                <div className="stepbox" key={s.id}>
                  <span className={`circle ${s.status === 'COMPLETED' ? 'done' : ''}`}>
                    {s.status === 'COMPLETED' ? '✓' : i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <b>{s.productionStep.name}</b>
                    <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                      Started {s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'} &nbsp; ·
                      &nbsp; Completed{' '}
                      {s.completedAt ? new Date(s.completedAt).toLocaleString() : '—'}
                    </div>
                  </div>
                  <span className={`pill ${statusClass(s.status)}`}>
                    {s.status.replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            {order.notes && (
              <div style={{ marginTop: 18 }}>
                <div className="eyebrow">ORDER NOTES</div>
                <p>{order.notes}</p>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panelhead">
              <h2 className="paneltitle">Resource consumption by step</h2>
            </div>
            {order.steps.map((s) => (
              <div key={s.id} style={{ marginBottom: 19 }}>
                <b>{s.productionStep.name}</b>
                {s.consumptions.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 7 }}>
                    No consumption recorded.
                  </div>
                ) : (
                  <>
                    <p className="table-hint">
                      Swipe horizontally to view all consumption details.
                    </p>
                    <div
                      className="tablewrap"
                      tabIndex={0}
                      role="region"
                      aria-label="Step resource consumption"
                    >
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Resource</th>
                            <th>Category</th>
                            <th>Quantity</th>
                            <th>Recorded</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.consumptions.map((c) => (
                            <tr key={c.id}>
                              <td>{c.resourceNameSnapshot}</td>
                              <td>{c.resourceCategorySnapshot.replaceAll('_', ' ')}</td>
                              <td>
                                {Number(c.quantity)} {c.unitSnapshot}
                              </td>
                              <td>{formatDate(c.recordedAt)}</td>
                              <td>{c.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="panelhead">
              <h2 className="paneltitle">Production timeline</h2>
            </div>
            {order.events.length === 0 ? (
              <div className="empty">No production events have been recorded.</div>
            ) : (
              <div className="timeline">
                {order.events.map((e) => (
                  <div className="event" key={e.id}>
                    <b>{e.description}</b>
                    <div className="muted" style={{ marginTop: 5 }}>
                      {new Date(e.createdAt).toLocaleString()}{' '}
                      {e.orderStep ? ` · ${e.orderStep.productionStep.name}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
