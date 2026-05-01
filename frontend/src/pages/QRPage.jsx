import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function QRPage() {
  const { slug } = useParams();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const previewSrc = api.qrUrl(slug);
  const menuUrl = `${window.location.origin}/menu/${slug}`;

  async function download(format, ext, mime) {
    setBusy(format);
    setError(null);
    try {
      const res = await fetch(api.qrUrl(slug, { format, download: true }));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], mime ? { type: mime } : undefined));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qr-${slug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="admin-bar">
        <h1>QR kód — {slug}</h1>
        <Link className="btn" to="/admin" style={{ color: '#1f2937' }}>← Zpět do administrace</Link>
      </div>
      <div className="container" style={{ paddingTop: 32 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ marginTop: 0 }}>
            Veřejné menu:{' '}
            <a href={menuUrl} target="_blank" rel="noreferrer">{menuUrl}</a>
          </p>
          <img
            src={previewSrc}
            alt={`QR kód pro ${slug}`}
            className="qr-img"
            style={{ maxWidth: 320, width: '100%', margin: '0 auto', display: 'block' }}
          />
          <p className="muted">
            Stáhněte si QR kód v požadovaném formátu, vytiskněte a umístěte na stoly.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
            <button
              className="primary"
              onClick={() => download('png', 'png', 'image/png')}
              disabled={!!busy}
            >
              {busy === 'png' ? 'Stahuji…' : '📥 Stáhnout PNG'}
            </button>
            <button
              onClick={() => download('svg', 'svg', 'image/svg+xml')}
              disabled={!!busy}
            >
              {busy === 'svg' ? 'Stahuji…' : '📥 Stáhnout SVG'}
            </button>
            <button
              onClick={() => download('pdf', 'pdf', 'application/pdf')}
              disabled={!!busy}
            >
              {busy === 'pdf' ? 'Stahuji…' : '📄 Stáhnout PDF (A4)'}
            </button>
          </div>
          {error && <p className="error" style={{ marginTop: 16 }}>Chyba: {error}</p>}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Tipy pro tisk</h3>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li><strong>PNG</strong> — ideální pro digitální použití (sociální sítě, web).</li>
            <li><strong>SVG</strong> — vektorový formát bez ztráty kvality, vhodný pro grafiky a polepy.</li>
            <li><strong>PDF (A4)</strong> — předpřipravený leták s názvem restaurace a URL, stačí vytisknout.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
