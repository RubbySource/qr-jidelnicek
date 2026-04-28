import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

function formatPrice(p) {
  const n = Number(p) || 0;
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč`;
}

export default function PublicMenu() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMenu(slug)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <div className="container">
        <p className="error">Chyba: {error}</p>
      </div>
    );
  }
  if (!data) return <div className="container"><p>Načítání…</p></div>;

  const { restaurant, categories } = data;

  return (
    <div>
      <div className="menu-header">
        <h1>{restaurant.name}</h1>
      </div>
      <div className="container">
        {categories.length === 0 && <p className="muted">Menu zatím není připravené.</p>}
        {categories.map((c) => (
          <div className="category" key={c.id}>
            <h2>{c.name}</h2>
            {c.items.length === 0 && <p className="muted">Žádné položky.</p>}
            {c.items.map((it) => (
              <div className={`item ${it.available ? '' : 'unavailable'}`} key={it.id}>
                <div className="item-info">
                  <div className="item-name">{it.name}</div>
                  {it.description && <div className="item-desc">{it.description}</div>}
                  {!it.available && <div className="muted">Momentálně nedostupné</div>}
                </div>
                <div className="item-price">{formatPrice(it.price)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
