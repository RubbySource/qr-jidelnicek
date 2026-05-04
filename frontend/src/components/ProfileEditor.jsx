import { useRef, useState } from 'react';
import { api } from '../api';

const MAX_LOGO_DIM = 512;
const LOGO_QUALITY = 0.9;

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
        const scale = Math.min(1, MAX_LOGO_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, LOGO_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileEditor({ restaurant, onUpdated }) {
  const [form, setForm] = useState({
    name: restaurant.name || '',
    logo_url: restaurant.logo_url || '',
    phone: restaurant.phone || '',
    address: restaurant.address || '',
    opening_hours: restaurant.opening_hours || '',
    website_url: restaurant.website_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const logoInputRef = useRef(null);

  async function save(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updated = await api.updateProfile(form);
      setSuccess(true);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLogoBusy(true);
    try {
      const url = await fileToResizedDataUrl(file);
      setForm((f) => ({ ...f, logo_url: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Profil restaurace</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Tyto údaje se zobrazí v hlavičce vašeho veřejného menu.
      </p>
      <form onSubmit={save}>
        <label>
          <span>Název restaurace</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={120}
            required
          />
        </label>

        <div>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Logo</span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo" className="thumb" style={{ width: 80, height: 80 }} />
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoFile}
              disabled={logoBusy}
              style={{ flex: 1, minWidth: 200 }}
            />
            {form.logo_url && (
              <button type="button" onClick={() => setForm({ ...form, logo_url: '' })}>Odstranit</button>
            )}
          </div>
          {logoBusy && <p className="muted">Zpracovávám…</p>}
        </div>

        <label>
          <span>Telefon</span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+420 123 456 789"
            inputMode="tel"
          />
        </label>

        <label>
          <span>Adresa</span>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Václavské náměstí 1, Praha 1"
          />
        </label>

        <label>
          <span>Otevírací doba</span>
          <textarea
            rows={3}
            value={form.opening_hours}
            onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
            placeholder="Po–Pá: 11:00–22:00&#10;So–Ne: 12:00–23:00"
          />
        </label>

        <label>
          <span>Webová stránka</span>
          <input
            value={form.website_url}
            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            placeholder="https://www.vase-restaurace.cz"
            type="url"
          />
        </label>

        {error && <p className="error">{error}</p>}
        {success && <p style={{ color: '#16a34a' }}>Uloženo.</p>}
        <button className="primary" disabled={saving}>{saving ? 'Ukládám…' : 'Uložit profil'}</button>
      </form>
    </div>
  );
}
