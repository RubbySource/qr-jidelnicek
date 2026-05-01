import { useState } from 'react';
import { api } from '../api';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_BASE = 'https://qr-jidelnicek-demo.loca.lt';

export default function SlugEditor({ restaurant, onUpdated }) {
  const initial = restaurant.custom_slug || '';
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const trimmed = value.trim().toLowerCase();
  const localValid = trimmed.length >= 3 && trimmed.length <= 40 && SLUG_RE.test(trimmed);
  const previewSlug = trimmed || restaurant.slug;
  const previewUrl = `${PUBLIC_BASE}/menu/${previewSlug}`;

  async function save(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!localValid) {
      setError('Slug musí mít 3–40 znaků a obsahovat jen a-z, 0-9 a pomlčky.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateSlug(restaurant.id, trimmed);
      setSuccess(true);
      if (onUpdated) onUpdated(res.slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Vlastní URL slug</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Nastavte si přátelskou adresu pro vaše menu. Původní odkaz bude dál fungovat.
      </p>
      <form onSubmit={save}>
        <label>
          <span>Slug</span>
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); setSuccess(false); }}
            placeholder="napr. u-bilka"
            maxLength={40}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <p className="muted" style={{ margin: '8px 0' }}>
          Náhled: <a href={previewUrl} target="_blank" rel="noreferrer">{previewUrl}</a>
        </p>
        {error && <p className="error">{error}</p>}
        {success && <p style={{ color: '#059669' }}>Uloženo.</p>}
        <button className="primary" disabled={saving || !localValid || trimmed === initial}>
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
      </form>
    </div>
  );
}
