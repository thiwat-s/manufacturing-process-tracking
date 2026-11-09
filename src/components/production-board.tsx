'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { api, errorMessage, formatDate } from '@/lib/client';
import type { BoardOrder, ConsumptionRecord, ResourceRecord } from '@/types/production';
type Column = {
  id: string;
  name: string;
  sequence: number;
  readyToStart: BoardOrder[];
  inProgress: BoardOrder[];
};
export function ProductionBoard() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [selected, setSelected] = useState<BoardOrder | null>(null);
  const [modal, setModal] = useState<'consume' | 'complete' | null>(null);
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  const [completionHasConsumption, setCompletionHasConsumption] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const load = () =>
    api<{ data: Column[] }>('/api/production/board')
      .then((x) => setColumns(x.data))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api<{ data: ResourceRecord[] }>('/api/resources')
      .then((x) => setResources(x.data.filter((r) => r.isActive)))
      .catch(() => {});
  }, []);
  async function start(order: BoardOrder) {
    setError('');
    try {
      await api(`/api/orders/${order.id}/steps/${order.orderStepId}/start`, {
        method: 'POST',
      });
      setToast(`${order.orderNumber} started.`);
      await load();
    } catch (error) {
      setError(errorMessage(error, 'Unable to start this production step.'));
    }
  }
  async function openConsume(order: BoardOrder) {
    setSelected(order);
    try {
      const r = await api<{ data: ConsumptionRecord[] }>(
        `/api/orders/${order.id}/steps/${order.orderStepId}/consumptions`,
      );
      setConsumptions(r.data);
    } catch {
      setConsumptions([]);
    }
    setModal('consume');
  }
  async function openComplete(order: BoardOrder) {
    setSelected(order);
    try {
      const result = await api<{ data: ConsumptionRecord[] }>(
        `/api/orders/${order.id}/steps/${order.orderStepId}/consumptions`,
      );
      setCompletionHasConsumption(result.data.length > 0);
      setModal('complete');
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to check step consumption.'));
    }
  }
  async function record(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await api(`/api/orders/${selected.id}/steps/${selected.orderStepId}/consumptions`, {
        method: 'POST',
        body: JSON.stringify({
          resourceId: f.get('resourceId'),
          quantity: Number(f.get('quantity')),
          notes: f.get('notes'),
        }),
      });
      setToast('Consumption recorded.');
      const r = await api<{ data: ConsumptionRecord[] }>(
        `/api/orders/${selected.id}/steps/${selected.orderStepId}/consumptions`,
      );
      setConsumptions(r.data);
      e.currentTarget.reset();
      await load();
    } catch (error) {
      setError(errorMessage(error, 'Unable to record consumption.'));
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/api/orders/${selected.id}/steps/${selected.orderStepId}/complete`, {
        method: 'POST',
      });
      setModal(null);
      setToast(`${selected.orderNumber} step completed. The next eligible step is now ready.`);
      await load();
    } catch (error) {
      setError(errorMessage(error, 'Unable to complete this production step.'));
      setModal(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="pagehead">
        <div>
          <div className="eyebrow">OPERATIONS / LIVE WORKFLOW</div>
          <h1 className="title">Production board</h1>
          <p className="subtitle">
            Work moves forward through controlled, traceable production steps.
          </p>
        </div>
        <button className="button" onClick={load}>
          ↻ Refresh
        </button>
      </div>
      <p className="board-hint">Swipe horizontally to view all five production steps.</p>
      {error && (
        <div className="panel" style={{ color: '#b42318' }}>
          {error}
          <button className="button" style={{ float: 'right' }} onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      {toast && (
        <div className="panel" style={{ color: '#157347' }}>
          {toast}
          <button className="button" style={{ float: 'right' }} onClick={() => setToast('')}>
            Dismiss
          </button>
        </div>
      )}
      <div className="board" tabIndex={0} role="region" aria-label="Production steps board">
        {columns.map((col) => (
          <section className="boardcol" key={col.id}>
            <div className="boardcolhead">
              <div className="eyebrow">STEP {String(col.sequence).padStart(2, '0')}</div>
              <b>{col.name}</b>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                {col.readyToStart.length} ready · {col.inProgress.length} active
              </div>
            </div>
            {col.inProgress.map((order) => (
              <article className="boardcard" key={order.orderStepId}>
                <Link className="link" href={`/orders/${order.id}`}>
                  {order.orderNumber}
                </Link>
                <strong style={{ marginTop: 8 }}>{order.productName}</strong>
                <small>
                  Qty {order.quantity} · Due {formatDate(order.dueDate)}
                </small>
                <div className="cardactions">
                  <button className="button" onClick={() => openConsume(order)}>
                    ＋ Consumption
                  </button>
                  <button className="button primary" onClick={() => void openComplete(order)}>
                    Complete
                  </button>
                </div>
              </article>
            ))}
            {col.readyToStart.map((order) => (
              <article className="boardcard" key={order.orderStepId}>
                <Link className="link" href={`/orders/${order.id}`}>
                  {order.orderNumber}
                </Link>
                <strong style={{ marginTop: 8 }}>{order.productName}</strong>
                <small>
                  Qty {order.quantity} · Due {formatDate(order.dueDate)}
                </small>
                <div className="cardactions">
                  <button className="button primary" onClick={() => start(order)}>
                    Start step
                  </button>
                </div>
              </article>
            ))}
            {col.readyToStart.length === 0 && col.inProgress.length === 0 && (
              <div style={{ fontSize: 11, color: '#85919c', padding: '12px 5px' }}>
                No orders ready for this step.
              </div>
            )}
          </section>
        ))}
      </div>
      {modal === 'consume' && (
        <div className="modalback">
          <div className="modal">
            <h2 className="paneltitle">Record resource consumption</h2>
            <p className="subtitle">
              {selected?.orderNumber} · {selected?.productName}
            </p>
            {consumptions.length > 0 && (
              <div style={{ margin: '16px 0', background: '#f7f9fa', padding: 12 }}>
                <b style={{ fontSize: 11 }}>Already recorded for this step</b>
                {consumptions.map((c) => (
                  <div key={c.id} className="muted" style={{ marginTop: 7, fontSize: 12 }}>
                    {c.resource.name}: {Number(c.quantity)} {c.unitSnapshot}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={record}>
              <div className="field">
                <label>Resource</label>
                <select name="resourceId" className="input" required defaultValue="">
                  <option value="" disabled>
                    Select active resource
                  </option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.category.replaceAll('_', ' ')} · {r.unit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantity</label>
                <input
                  className="input"
                  name="quantity"
                  type="number"
                  min="0.0001"
                  step="any"
                  required
                />
              </div>
              <div className="field">
                <label>
                  Notes <span className="muted">(optional)</span>
                </label>
                <textarea className="input" name="notes" rows={2} />
              </div>
              <div className="modalfoot">
                <button type="button" className="button" onClick={() => setModal(null)}>
                  Close
                </button>
                <button className="button primary" disabled={busy || resources.length === 0}>
                  {busy ? 'Saving…' : 'Save consumption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modal === 'complete' && (
        <div className="modalback">
          <div className="modal">
            <h2 className="paneltitle">Complete production step?</h2>
            <p className="subtitle">
              Confirm {selected?.orderNumber} is ready to leave this step. At least one resource
              consumption is required.
            </p>
            {!completionHasConsumption && (
              <p role="status" style={{ color: '#b45309', marginTop: 12 }}>
                Record at least one resource consumption before this step can be completed.
              </p>
            )}
            <div className="modalfoot">
              <button className="button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy || !completionHasConsumption}
                onClick={complete}
              >
                {busy ? 'Completing…' : 'Confirm completion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
