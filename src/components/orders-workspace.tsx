'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shell } from '@/components/shell';
import { api, errorMessage, formatDate, statusClass } from '@/lib/client';
import { orderInput } from '@/server/validations';
import type { OrderRecord } from '@/types/production';

type OrderList = {
  data: OrderRecord[];
  pagination: { page: number; pages: number; total: number };
};

export function OrdersWorkspace() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [direction, setDirection] = useState('desc');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const form = useForm<z.input<typeof orderInput>, unknown, z.output<typeof orderInput>>({
    resolver: zodResolver(orderInput),
    defaultValues: { quantity: 1 },
  });

  const load = useCallback(async () => {
    try {
      setError('');
      const query = new URLSearchParams({
        search,
        status,
        dueBefore,
        sort,
        direction,
        page: String(page),
        pageSize: '10',
      });
      const result = await api<OrderList>(`/api/orders?${query}`);
      setOrders(result.data);
      setPages(Math.max(1, result.pagination.pages));
      setTotal(result.pagination.total);
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to load orders.'));
    }
  }, [search, status, dueBefore, sort, direction, page]);
  useEffect(() => {
    void load();
  }, [load]);

  async function createOrder(values: z.output<typeof orderInput>) {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ data: { orderNumber: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setCreating(false);
      setNotice(`Order ${result.data.orderNumber} was created with five production steps.`);
      form.reset({ quantity: 1 });
      setPage(1);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to create order.'));
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
        <button className="button primary" onClick={() => setCreating(true)}>
          + Create order
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
        <div className="panel" role="alert" style={{ color: '#b42318' }}>
          {error}
        </div>
      )}
      <section className="panel">
        <div className="toolbar">
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search order or product"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
          <select
            className="input"
            style={{ maxWidth: 165 }}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <input
            className="input"
            style={{ maxWidth: 165 }}
            type="date"
            aria-label="Due on or before"
            value={dueBefore}
            onChange={(event) => {
              setPage(1);
              setDueBefore(event.target.value);
            }}
          />
          <select
            className="input"
            style={{ maxWidth: 165 }}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="createdAt">Sort: created</option>
            <option value="dueDate">Sort: due date</option>
          </select>
          <select
            className="input"
            style={{ maxWidth: 130 }}
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          <span className="muted" style={{ alignSelf: 'center', marginLeft: 'auto' }}>
            {total} orders
          </span>
        </div>
        <p className="table-hint">Swipe horizontally to view all order details.</p>
        <div className="tablewrap" tabIndex={0} role="region" aria-label="Orders table">
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
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link className="link" href={`/orders/${order.id}`}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>{order.productName}</td>
                  <td>{order.quantity}</td>
                  <td>{formatDate(order.dueDate)}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    <span className={`pill ${statusClass(order.status)}`}>
                      {order.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {order.steps.filter((step) => step.status === 'COMPLETED').length}/5 steps
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="empty">No orders match these filters.</div>}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
          }}
        >
          <span className="muted">
            Page {page} of {pages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <button
              className="button"
              disabled={page >= pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {creating && (
        <div className="modalback">
          <div className="modal">
            <h2 className="paneltitle">Create manufacturing order</h2>
            <p className="subtitle">
              The order number and five production steps are generated automatically.
            </p>
            <form onSubmit={form.handleSubmit(createOrder)}>
              <div className="field">
                <label htmlFor="productName">Product name</label>
                <input
                  id="productName"
                  className="input"
                  maxLength={160}
                  {...form.register('productName')}
                />
                {form.formState.errors.productName && (
                  <small role="alert" style={{ color: '#b42318' }}>
                    {String(form.formState.errors.productName.message)}
                  </small>
                )}
              </div>
              <div className="field">
                <label htmlFor="quantity">Quantity</label>
                <input
                  id="quantity"
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  {...form.register('quantity', { valueAsNumber: true })}
                />
                {form.formState.errors.quantity && (
                  <small role="alert" style={{ color: '#b42318' }}>
                    {String(form.formState.errors.quantity.message)}
                  </small>
                )}
              </div>
              <div className="field">
                <label htmlFor="dueDate">
                  Due date <span className="muted">(optional)</span>
                </label>
                <input id="dueDate" className="input" type="date" {...form.register('dueDate')} />
              </div>
              <div className="field">
                <label htmlFor="notes">
                  Notes <span className="muted">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  className="input"
                  rows={3}
                  maxLength={2000}
                  {...form.register('notes')}
                />
              </div>
              <div className="modalfoot">
                <button type="button" className="button" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
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
