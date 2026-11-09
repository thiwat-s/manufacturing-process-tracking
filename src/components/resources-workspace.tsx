'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shell } from '@/components/shell';
import { api, errorMessage, formatDate } from '@/lib/client';
import { resourceInput } from '@/server/validations';
import type { ConsumptionHistoryRecord, ResourceRecord } from '@/types/production';

export function ResourcesWorkspace() {
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<ResourceRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<ConsumptionHistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm<z.input<typeof resourceInput>, unknown, z.output<typeof resourceInput>>({
    resolver: zodResolver(resourceInput),
    defaultValues: { category: 'MATERIAL' },
  });

  const load = useCallback(async () => {
    try {
      setError('');
      const query = new URLSearchParams({ search, category });
      const response = await api<{ data: ResourceRecord[] }>(`/api/resources?${query}`);
      setResources(response.data);
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to load resources.'));
    }
  }, [search, category]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(payload: z.output<typeof resourceInput>) {
    setBusy(true);
    setError('');
    try {
      if (editing)
        await api(`/api/resources/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      else await api('/api/resources', { method: 'POST', body: JSON.stringify(payload) });
      setCreating(false);
      setEditing(null);
      form.reset({ category: 'MATERIAL' });
      await load();
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to save resource.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(resource: ResourceRecord) {
    try {
      await api(`/api/resources/${resource.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !resource.isActive }),
      });
      await load();
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to update resource.'));
    }
  }

  async function openHistory(resourceId?: string) {
    try {
      const response = await api<{ data: ConsumptionHistoryRecord[] }>(
        `/api/consumptions${resourceId ? `?resourceId=${resourceId}` : ''}`,
      );
      setHistory(response.data);
      setShowHistory(true);
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to load consumption history.'));
    }
  }
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    form.reset({ category: 'MATERIAL' });
  };
  const openEdit = (resource: ResourceRecord) => {
    setEditing(resource);
    form.reset({ name: resource.name, category: resource.category, unit: resource.unit });
  };

  return (
    <Shell>
      <div className="pagehead">
        <div>
          <div className="eyebrow">OPERATIONS / MASTER DATA</div>
          <h1 className="title">Resources</h1>
          <p className="subtitle">Manage production materials, machine time, and labour time.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="button" onClick={() => void openHistory()}>
            Consumption history
          </button>
          <button className="button primary" onClick={() => setCreating(true)}>
            + Add resource
          </button>
        </div>
      </div>
      {error && (
        <div className="panel" role="alert" style={{ color: '#b42318' }}>
          {error}
          <button className="button" style={{ float: 'right' }} onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      <section className="panel">
        <div className="toolbar">
          <input
            className="input"
            style={{ maxWidth: 330 }}
            placeholder="Search resources"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="input"
            style={{ maxWidth: 210 }}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            <option value="MATERIAL">Material</option>
            <option value="MACHINE_TIME">Machine time</option>
            <option value="LABOUR_TIME">Labour time</option>
          </select>
          <span className="muted" style={{ alignSelf: 'center', marginLeft: 'auto' }}>
            {resources.length} resources
          </span>
        </div>
        <p className="table-hint">Swipe horizontally to view resource actions.</p>
        <div className="tablewrap" tabIndex={0} role="region" aria-label="Resources table">
          <table className="table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <b>{resource.name}</b>
                  </td>
                  <td>{resource.category.replaceAll('_', ' ')}</td>
                  <td>{resource.unit}</td>
                  <td>
                    <span className={`pill ${resource.isActive ? 'completed' : 'pending'}`}>
                      {resource.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td>{formatDate(resource.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="button" onClick={() => openEdit(resource)}>
                        Edit
                      </button>
                      <button className="button" onClick={() => void toggle(resource)}>
                        {resource.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="button" onClick={() => void openHistory(resource.id)}>
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {resources.length === 0 && <div className="empty">No resources match these filters.</div>}
        </div>
      </section>
      {(creating || editing) && (
        <div className="modalback">
          <div className="modal">
            <h2 className="paneltitle">{editing ? 'Edit resource' : 'Add resource'}</h2>
            <form onSubmit={form.handleSubmit(save)}>
              <div className="field">
                <label htmlFor="resourceName">Resource name</label>
                <input
                  id="resourceName"
                  className="input"
                  maxLength={120}
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <small role="alert" style={{ color: '#b42318' }}>
                    {String(form.formState.errors.name.message)}
                  </small>
                )}
              </div>
              <div className="field">
                <label htmlFor="resourceCategory">Category</label>
                <select id="resourceCategory" className="input" {...form.register('category')}>
                  <option value="MATERIAL">Material</option>
                  <option value="MACHINE_TIME">Machine time</option>
                  <option value="LABOUR_TIME">Labour time</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="resourceUnit">Unit</label>
                <input
                  id="resourceUnit"
                  className="input"
                  maxLength={24}
                  placeholder="kg, pcs, min, hour"
                  {...form.register('unit')}
                />
                {form.formState.errors.unit && (
                  <small role="alert" style={{ color: '#b42318' }}>
                    {String(form.formState.errors.unit.message)}
                  </small>
                )}
              </div>
              <div className="modalfoot">
                <button type="button" className="button" onClick={closeForm}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? 'Saving…' : editing ? 'Save changes' : 'Add resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showHistory && (
        <div className="modalback">
          <div className="modal" style={{ width: 'min(900px,100%)' }}>
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
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.recordedAt)}</td>
                      <td>{row.orderStep.order.orderNumber}</td>
                      <td>{row.orderStep.productionStep.name}</td>
                      <td>{row.resourceNameSnapshot}</td>
                      <td>
                        {Number(row.quantity)} {row.unitSnapshot}
                      </td>
                      <td>{row.notes || '—'}</td>
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
