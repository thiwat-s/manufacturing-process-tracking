'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/shell';
import { api, errorMessage, formatDate } from '@/lib/client';
import type { ConsumptionHistoryRecord, ResourceRecord } from '@/types/production';
export function Resources() {
  const [rows, setRows] = useState<ResourceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ConsumptionHistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api<{ data: ResourceRecord[] }>(
        `/api/resources?search=${encodeURIComponent(search)}&category=${category}`,
      )
        .then((x) => setRows(x.data))
        .catch((e) => setError(e.message)),
    [search, category],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          name: f.get('name'),
          category: f.get('category'),
          unit: f.get('unit'),
        }),
      });
      setModal(false);
      load();
    } catch (error) {
      setError(errorMessage(error, 'Unable to save resource.'));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(row: ResourceRecord) {
    try {
      await api(`/api/resources/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      load();
    } catch (error) {
      setError(errorMessage(error, 'Unable to update resource.'));
    }
  }
  async function consumptionHistory() {
    try {
      const r = await api<{ data: ConsumptionHistoryRecord[] }>('/api/consumptions');
      setHistory(r.data);
      setShowHistory(true);
    } catch (error) {
      setError(errorMessage(error, 'Unable to load consumption history.'));
    }
  }
  return (
    <Shell>
      <div className="pagehead">
        <div>
          <div className="eyebrow">OPERATIONS / MASTER DATA</div>
          <h1 className="title">Resources</h1>
          <p className="subtitle">Manage production materials, machine time, and labour time.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button" onClick={consumptionHistory}>
            Consumption history
          </button>
          <button className="button primary" onClick={() => setModal(true)}>
            ＋ Add resource
          </button>
        </div>
      </div>
      {error && (
        <div className="panel" style={{ color: '#b42318' }}>
          {error}
          <button className="button" style={{ float: 'right' }} onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      <div className="panel">
        <div className="toolbar">
          <input
            className="input"
            style={{ maxWidth: 330 }}
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 210 }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            <option value="MATERIAL">Material</option>
            <option value="MACHINE_TIME">Machine time</option>
            <option value="LABOUR_TIME">Labour time</option>
          </select>
        </div>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Added</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.name}</b>
                  </td>
                  <td>{r.category.replaceAll('_', ' ')}</td>
                  <td>{r.unit}</td>
                  <td>
                    <span className={`pill ${r.isActive ? 'completed' : 'pending'}`}>
                      {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>
                    <button className="button" onClick={() => toggle(r)}>
                      {r.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty">No resources found.</div>}
        </div>
      </div>
      {modal && (
        <div className="modalback">
          <div className="modal">
            <h2 className="paneltitle">Add resource</h2>
            <form onSubmit={save}>
              <div className="field">
                <label>Resource name</label>
                <input className="input" name="name" required maxLength={120} />
              </div>
              <div className="field">
                <label>Category</label>
                <select name="category" className="input">
                  <option value="MATERIAL">Material</option>
                  <option value="MACHINE_TIME">Machine time</option>
                  <option value="LABOUR_TIME">Labour time</option>
                </select>
              </div>
              <div className="field">
                <label>Unit</label>
                <input
                  className="input"
                  name="unit"
                  required
                  placeholder="kg, pcs, min, hour"
                  maxLength={24}
                />
              </div>
              <div className="modalfoot">
                <button type="button" className="button" onClick={() => setModal(false)}>
                  Cancel
                </button>
                <button disabled={busy} className="button primary">
                  {busy ? 'Saving…' : 'Save resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showHistory && (
        <div className="modalback">
          <div className="modal" style={{ width: 'min(850px,100%)' }}>
            <div className="panelhead">
              <h2 className="paneltitle">Resource consumption history</h2>
              <button className="button" onClick={() => setShowHistory(false)}>
                Close
              </button>
            </div>
            <div className="tablewrap" style={{ maxHeight: '65vh' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Recorded</th>
                    <th>Order</th>
                    <th>Step</th>
                    <th>Resource</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id}>
                      <td>{formatDate(c.recordedAt)}</td>
                      <td>{c.orderStep.order.orderNumber}</td>
                      <td>{c.orderStep.productionStep.name}</td>
                      <td>{c.resourceNameSnapshot}</td>
                      <td>
                        {Number(c.quantity)} {c.unitSnapshot}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && <div className="empty">No consumption records yet.</div>}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
