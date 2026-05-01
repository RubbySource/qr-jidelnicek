import { useEffect, useState } from 'react';
import { api, getToken } from '../api';

export default function UpgradeButton() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!getToken()) { setLoading(false); return; }
    api.me()
      .then((r) => { if (!cancelled) setPlan(r?.plan || 'free'); })
      .catch(() => { if (!cancelled) setPlan('free'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function upgrade() {
    setSubmitting(true);
    setError(null);
    try {
      const token = getToken();
      const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/stripe/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error('Stripe URL chybí v odpovědi');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (plan === 'pro') {
    return (
      <span
        title="Aktivní Pro předplatné"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: '#dcfce7',
          color: '#166534',
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Pro ✓
      </span>
    );
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        type="button"
        className="primary"
        onClick={upgrade}
        disabled={submitting}
        style={{ whiteSpace: 'nowrap' }}
      >
        {submitting ? 'Přesměrovávám…' : 'Upgrade na Pro — 299 Kč/měsíc'}
      </button>
      {error && <span className="error" style={{ fontSize: 12 }}>{error}</span>}
    </div>
  );
}
