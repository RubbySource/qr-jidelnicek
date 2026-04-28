import { useEffect, useState } from 'react';
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
      <label>
        <span>URL obrázku (volitelně)</span>
        <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
      </label>
      <label className="row">
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

function Dashboard({ restaurant, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [addingTo, setAddingTo] = useState(null);

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
    await api.createCategory({ name: newCategory.trim(), order: data.categories.length });
    setNewCategory('');
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

  if (error) return <p className="error">Chyba: {error}</p>;
  if (!data) return <p>Načítání…</p>;

  const publicUrl = `${window.location.origin}/menu/${restaurant.slug}`;

  return (
    <div>
      <div className="admin-bar">
        <h1>QR Jídelníček — {restaurant.name}</h1>
        <button onClick={onLogout}>Odhlásit</button>
      </div>
      <div className="container-wide">
        <div className="card">
          <div className="row-spread">
            <div>
              <strong>Veřejné menu:</strong>{' '}
              <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
            </div>
          </div>
          <img className="qr-img" src={api.qrUrl(restaurant.slug)} alt="QR kód" />
          <p className="muted">Vytiskněte si QR kód a umístěte ho na stůl. Zákazníci ho načtou mobilem.</p>
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
          <div className="card" key={c.id}>
            <div className="row-spread">
              <h3 style={{ margin: 0 }}>{c.name}</h3>
              <button className="danger" onClick={() => deleteCategory(c.id)}>Smazat kategorii</button>
            </div>

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
                  <div className="item">
                    <div className="item-info">
                      <div className="item-name">{it.name} {!it.available && <span className="muted">(nedostupné)</span>}</div>
                      {it.description && <div className="item-desc">{it.description}</div>}
                    </div>
                    <div className="row">
                      <span className="item-price">{Number(it.price).toLocaleString('cs-CZ')} Kč</span>
                      <button onClick={() => setEditingItem(it)}>Upravit</button>
                      <button className="danger" onClick={() => deleteItem(it.id)}>×</button>
                    </div>
                  </div>
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
