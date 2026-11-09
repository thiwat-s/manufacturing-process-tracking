'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { api, errorMessage, formatDate, statusClass } from '@/lib/client';
import type { OrderRecord } from '@/types/production';
export function Orders() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(
    () =>
      api<{ data: OrderRecord[] }>(
        `/api/orders?search=${encodeURIComponent(search)}&status=${status}`,
      )
        .then((r) => setOrders(r.data))
        .catch((e) => setError(e.message)),
    [search, status],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const f = new FormData(e.currentTarget);
      const r = await api<{ data: { orderNumber: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          productName: f.get('productName'),
          quantity: Number(f.get('quantity')),
          dueDate: f.get('dueDate'),
          notes: f.get('notes'),
        }),
      });
      setShow(false);
      setNotice(`Order ${r.data.orderNumber} created with five production steps.`);
      e.currentTarget.reset();
      await load();
    } catch (error) {
      setError(errorMessage(error, 'Unable to create order.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="pagehead">
        <div>
          <div className="eyebrow">OPERATIONS / ORDER MANAGEMENT</div>
          <h1 className="title">Manufacturing orders</h1>
          <p className="subtitle">Create orders and follow each job through production.</p>
        </div>
        <button className="button primary" onClick={() => setShow(true)}>
          ＋ Create order
        </button>
      </div>
      {notice && (
        <div className="panel" style={{ color: '#157347' }}>
          {notice}
          <button className="button" style={{ float: 'right' }} onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="panel" style={{ color: '#b42318' }}>
          {error}
        </div>
      )}
      <div className="panel">
        <div className="toolbar">
          <input
            className="input"
            style={{ maxWidth: 330 }}
            placeholder="Search order number or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 180 }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option>PENDING</option>
            <option>IN_PROGRESS</option>
            <option>COMPLETED</option>
          </select>
          <span className="muted" style={{ alignSelf: 'center', marginLeft: 'auto' }}>
            {orders.length} orders
          </span>
        </div>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Due date</th>
                <th>Created</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link className="link" href={`/orders/${o.id}`}>
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td>{o.productName}</td>
                  <td>{o.quantity}</td>
                  <td>{formatDate(o.dueDate)}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>
                    <span className={`pill ${statusClass(o.status)}`}>
                      {o.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {o.steps.filter((step) => step.status === 'COMPLETED').length}
                    /5 steps
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="empty">No orders found. Create an order to get production moving.</div>
          )}
        </div>
      </div>
      {show && (
        <div className="modalback">
          <div className="modal">
            <h2 className="paneltitle">Create manufacturing order</h2>
            <p className="subtitle">
              A unique order number and five production steps will be generated.
            </p>
            <form onSubmit={create}>
              <div className="field">
                <label>Product name</label>
                <input
                  name="productName"
                  className="input"
                  required
                  maxLength={160}
                  placeholder="e.g. Precision valve housing"
                />
              </div>
              <div className="field">
                <label>Quantity</label>
                <input
                  name="quantity"
                  className="input"
                  type="number"
                  required
                  min="1"
                  step="1"
                  defaultValue="1"
                />
              </div>
              <div className="field">
                <label>
                  Due date <span className="muted">(optional)</span>
                </label>
                <input name="dueDate" className="input" type="date" />
              </div>
              <div className="field">
                <label>
                  Notes <span className="muted">(optional)</span>
                </label>
                <textarea name="notes" className="input" rows={3} maxLength={2000} />
              </div>
              <div className="modalfoot">
                <button type="button" className="button" onClick={() => setShow(false)}>
                  Cancel
                </button>
                <button disabled={busy} className="button primary">
                  {busy ? 'Creating…' : 'Create order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
