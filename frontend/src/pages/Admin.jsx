import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken, setToken } from '../api';

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', slug: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);
      setToken(res.token);
      onAuth(res.restaurant);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 48 }}>
      <h1>{mode === 'login' ? 'Přihlášení' : 'Registrace restaurace'}</h1>
      <form onSubmit={submit} className="card">
        {mode === 'register' && (
          <>
            <label>
              <span>Název restaurace</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              <span>URL slug (volitelně)</span>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="napr. u-bilka" />
            </label>
          </>
        )}
        <label>
          <span>E-mail</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          <span>Heslo</span>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Pracuji…' : (mode === 'login' ? 'Přihlásit' : 'Vytvořit účet')}
        </button>
      </form>
      <p className="muted" style={{ textAlign: 'center' }}>
        {mode === 'login' ? 'Nemáte účet?' : 'Už máte účet?'}{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
          {mode === 'login' ? 'Zaregistrujte se' : 'Přihlaste se'}
        </a>
      </p>
    </div>
  );
}

const MAX_IMAGE_DIM = 1024;
const IMAGE_QUALITY = 0.82;

function fileToResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Soubor není obrázek'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nepodařilo se přečíst soubor'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Neplatný obrázek'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, IMAGE_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ImageField({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <span style={{ display: 'block', marginBottom: 4, fontSize: 14, color: '#374151' }}>Obrázek</span>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {value && <img src={value} alt="Náhled" className="thumb" />}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} disabled={busy} style={{ flex: 1, minWidth: 200 }} />
        {value && (
          <button type="button" onClick={() => onChange('')}>Odstranit</button>
        )}
      </div>
      {busy && <p className="muted">Zpracovávám obrázek…</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ItemEditor({ categoryId, item, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price ?? 0,
    image_url: item?.image_url || '',
    available: item?.available ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (item) {
        await api.updateItem(item.id, form);
      } else {
        await api.createItem({ ...form, category_id: categoryId });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card" style={{ background: '#f9fafb' }}>
      <label>
        <span>Název</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </label>
      <label>
        <span>Popis</span>
        <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      <label>
        <span>Cena (Kč)</span>
        <input type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
      </label>
      <ImageField value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })} />
      <label className="row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} style={{ width: 'auto', marginRight: 8 }} />
        Dostupné
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" disabled={saving}>{saving ? 'Ukládám…' : 'Uložit'}</button>
        <button type="button" onClick={onCancel}>Zrušit</button>
      </div>
    </form>
  );
}

function CategoryHeader({ category, onRename, onDelete, dragHandlers }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) {
      setEditing(false);
      setName(category.name);
      return;
    }
    await onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="row-spread">
      <div className="row" style={{ flex: 1, minWidth: 0 }}>
        <span className="drag-handle" title="Přetáhnout pro změnu pořadí" {...dragHandlers}>⋮⋮</span>
        {editing ? (
          <>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setName(category.name); } }}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={save}>Uložit</button>
            <button type="button" onClick={() => { setEditing(false); setName(category.name); }}>Zrušit</button>
          </>
        ) : (
          <h3 style={{ margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{category.name}</h3>
        )}
      </div>
      {!editing && (
        <div className="row">
          <button type="button" onClick={() => setEditing(true)}>Přejmenovat</button>
          <button className="danger" onClick={onDelete}>Smazat kategorii</button>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, onEdit, onDelete, onToggleAvailable, dragHandlers, onDragOver, onDrop, isDragging }) {
  return (
    <div
      className={`item ${isDragging ? 'item-dragging' : ''} ${!item.available ? 'item-row-unavailable' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="drag-handle" title="Přetáhnout pro změnu pořadí" {...dragHandlers}>⋮⋮</span>
      {item.image_url && <img src={item.image_url} alt="" className="thumb" />}
      <div className="item-info">
        <div className="item-name">{item.name}</div>
        {item.description && <div className="item-desc">{item.description}</div>}
      </div>
      <div className="row">
        <span className="item-price">{Number(item.price).toLocaleString('cs-CZ')} Kč</span>
        <label className="switch" title={item.available ? 'Dostupné' : 'Nedostupné'}>
          <input
            type="checkbox"
            checked={!!item.available}
            onChange={(e) => onToggleAvailable(e.target.checked)}
          />
          <span className="slider" />
        </label>
        <button onClick={onEdit}>Upravit</button>
        <button className="danger" onClick={onDelete}>×</button>
      </div>
    </div>
  );
}

function Dashboard({ restaurant, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const dragRef = useRef({ kind: null, id: null, categoryId: null });
  const [dragKey, setDragKey] = useState(null);

  async function load() {
    try {
      const res = await api.myMenu();
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    await api.createCategory({ name: newCategory.trim() });
    setNewCategory('');
    load();
  }

  async function renameCategory(id, name) {
    await api.updateCategory(id, { name });
    load();
  }

  async function deleteCategory(id) {
    if (!confirm('Opravdu smazat kategorii a všechny její položky?')) return;
    await api.deleteCategory(id);
    load();
  }

  async function deleteItem(id) {
    if (!confirm('Smazat položku?')) return;
    await api.deleteItem(id);
    load();
  }

  async function toggleAvailable(item, available) {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => ({
        ...c,
        items: c.items.map((it) => (it.id === item.id ? { ...it, available } : it)),
      })),
    }));
    try {
      await api.setItemAvailability(item.id, available);
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  function startDragCategory(id) {
    dragRef.current = { kind: 'category', id, categoryId: null };
    setDragKey(`cat-${id}`);
  }

  function startDragItem(id, categoryId) {
    dragRef.current = { kind: 'item', id, categoryId };
    setDragKey(`item-${id}`);
  }

  function endDrag() {
    dragRef.current = { kind: null, id: null, categoryId: null };
    setDragKey(null);
  }

  async function dropOnCategory(targetId) {
    const drag = dragRef.current;
    endDrag();
    if (drag.kind !== 'category' || drag.id === targetId) return;
    const ids = data.categories.map((c) => c.id);
    const targetIdx = ids.indexOf(targetId);
    if (targetIdx < 0) return;
    try {
      await api.reorderCategory(drag.id, targetIdx);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function dropOnItem(targetItem, targetCategoryId) {
    const drag = dragRef.current;
    endDrag();
    if (drag.kind !== 'item') return;
    if (drag.categoryId !== targetCategoryId) return;
    if (drag.id === targetItem.id) return;
    const cat = data.categories.find((c) => c.id === targetCategoryId);
    if (!cat) return;
    const ids = cat.items.map((i) => i.id);
    const targetIdx = ids.indexOf(targetItem.id);
    if (targetIdx < 0) return;
    try {
      await api.reorderItem(drag.id, targetIdx);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) return <p className="error">Chyba: {error}</p>;
  if (!data) return <p>Načítání…</p>;

  const publicUrl = `${window.location.origin}/menu/${restaurant.slug}`;

  return (
    <div>
      <div className="admin-bar">
        <h1>QR Jídelníček — {restaurant.name}</h1>
        <button onClick={onLogout}>Odhlásit</button>
      </div>
      <div className="container-wide">
        {error && <p className="error">{error}</p>}
        <div className="card">
          <div className="row-spread">
            <div>
              <strong>Veřejné menu:</strong>{' '}
              <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
            </div>
            <div className="row">
              <a className="btn" href={publicUrl} target="_blank" rel="noreferrer">
                Zobrazit jako zákazník ↗
              </a>
              <Link className="btn primary" to={`/qr/${restaurant.slug}`}>
                📥 QR kód
              </Link>
            </div>
          </div>
          <img className="qr-img" src={api.qrUrl(restaurant.slug)} alt="QR kód" />
          <p className="muted">
            Vytiskněte si QR kód a umístěte ho na stůl. Zákazníci ho načtou mobilem.{' '}
            <Link to={`/qr/${restaurant.slug}`}>Stáhnout v PNG / SVG / PDF →</Link>
          </p>
        </div>

        <h2>Kategorie a položky</h2>

        <form onSubmit={addCategory} className="card row">
          <input
            placeholder="Název nové kategorie (např. Předkrmy)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button className="primary">Přidat kategorii</button>
        </form>

        {data.categories.length === 0 && (
          <p className="muted">Zatím žádné kategorie. Začněte přidáním první.</p>
        )}

        {data.categories.map((c) => (
          <div
            className={`card ${dragKey === `cat-${c.id}` ? 'card-dragging' : ''}`}
            key={c.id}
            onDragOver={(e) => { if (dragRef.current.kind === 'category') e.preventDefault(); }}
            onDrop={() => dropOnCategory(c.id)}
          >
            <CategoryHeader
              category={c}
              onRename={(name) => renameCategory(c.id, name)}
              onDelete={() => deleteCategory(c.id)}
              dragHandlers={{
                draggable: true,
                onDragStart: () => startDragCategory(c.id),
                onDragEnd: endDrag,
              }}
            />

            {c.items.length === 0 && (
              <p className="muted" style={{ marginTop: 12 }}>Zatím žádné položky.</p>
            )}

            {c.items.map((it) => (
              <div key={it.id}>
                {editingItem?.id === it.id ? (
                  <ItemEditor
                    item={it}
                    categoryId={c.id}
                    onSaved={() => { setEditingItem(null); load(); }}
                    onCancel={() => setEditingItem(null)}
                  />
                ) : (
                  <ItemRow
                    item={it}
                    onEdit={() => setEditingItem(it)}
                    onDelete={() => deleteItem(it.id)}
                    onToggleAvailable={(v) => toggleAvailable(it, v)}
                    isDragging={dragKey === `item-${it.id}`}
                    dragHandlers={{
                      draggable: true,
                      onDragStart: () => startDragItem(it.id, c.id),
                      onDragEnd: endDrag,
                    }}
                    onDragOver={(e) => {
                      if (dragRef.current.kind === 'item' && dragRef.current.categoryId === c.id) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                    onDrop={(e) => { e.stopPropagation(); dropOnItem(it, c.id); }}
                  />
                )}
              </div>
            ))}

            {addingTo === c.id ? (
              <ItemEditor
                categoryId={c.id}
                onSaved={() => { setAddingTo(null); load(); }}
                onCancel={() => setAddingTo(null)}
              />
            ) : (
              <button onClick={() => setAddingTo(c.id)} style={{ marginTop: 8 }}>+ Přidat položku</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Admin() {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me()
      .then(setRestaurant)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    setToken(null);
    setRestaurant(null);
  }

  if (loading) return <div className="container"><p>Načítání…</p></div>;
  if (!restaurant) return <AuthForm onAuth={setRestaurant} />;
  return <Dashboard restaurant={restaurant} onLogout={logout} />;
}
