import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { t, allergenLabel } from '../i18n';

const LANG_KEY = 'qrj_lang';

function formatPrice(p, lang) {
  const n = Number(p) || 0;
  if (lang === 'en') {
    return `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} CZK`;
  }
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč`;
}

const FILTER_DEFS = [
  { key: 'vegetarian', flag: 'is_vegetarian' },
  { key: 'vegan', flag: 'is_vegan' },
  { key: 'glutenFree', flag: 'is_gluten_free' },
  { key: 'lactoseFree', flag: 'is_lactose_free' },
  { key: 'spicy', flag: 'is_spicy' },
];

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function DietBadges({ item, lang, includeFeatured = true }) {
  const flags = [
    includeFeatured && item.is_featured && { key: 'featured', cls: 'badge-featured', prefix: '★ ' },
    item.is_vegetarian && { key: 'vegetarian', cls: 'badge-veg' },
    item.is_vegan && { key: 'vegan', cls: 'badge-vegan' },
    item.is_gluten_free && { key: 'glutenFree', cls: 'badge-gf' },
    item.is_lactose_free && { key: 'lactoseFree', cls: 'badge-lf' },
    item.is_spicy && { key: 'spicy', cls: 'badge-spicy' },
  ].filter(Boolean);
  if (flags.length === 0) return null;
  return (
    <div className="badges">
      {flags.map((f) => (
        <span key={f.key} className={`badge ${f.cls}`}>
          {f.prefix || ''}{t(lang, `badges.${f.key}`)}
        </span>
      ))}
    </div>
  );
}

function AllergensLine({ item, lang }) {
  if (!item.allergens || item.allergens.length === 0) return null;
  const labels = item.allergens.map((c) => `${c} ${allergenLabel(c, lang)}`).join(' · ');
  return (
    <div className="item-allergens">
      <strong>{t(lang, 'contains')}:</strong> {labels}
    </div>
  );
}

export default function PublicMenu() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState(() => new Set());
  const [lang, setLang] = useState(() => {
    const stored = localStorage.getItem(LANG_KEY);
    return stored === 'en' ? 'en' : 'cs';
  });

  useEffect(() => {
    api.getMenu(slug)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  function toggleFilter(key) {
    const next = new Set(activeFilters);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setActiveFilters(next);
  }

  const { filteredCategories, totalShown } = useMemo(() => {
    if (!data) return { filteredCategories: [], totalShown: 0 };
    const needle = normalizeText(search.trim());
    let shown = 0;
    const cats = data.categories
      .map((c) => {
        const items = c.items.filter((it) => {
          for (const def of FILTER_DEFS) {
            if (activeFilters.has(def.key) && !it[def.flag]) return false;
          }
          if (needle) {
            const hay = normalizeText(`${it.name} ${it.description || ''}`);
            if (!hay.includes(needle)) return false;
          }
          return true;
        });
        shown += items.length;
        return { ...c, items };
      })
      .filter((c) => c.items.length > 0);
    return { filteredCategories: cats, totalShown: shown };
  }, [data, search, activeFilters]);

  if (error) {
    return (
      <div className="container">
        <p className="error">{t(lang, 'error')}: {error}</p>
      </div>
    );
  }
  if (!data) return <div className="container"><p>{t(lang, 'loading')}</p></div>;

  const { restaurant, categories } = data;
  const hasAnyItems = categories.some((c) => c.items.length > 0);
  const noFiltersActive = !search && activeFilters.size === 0;
  const featuredItems = noFiltersActive
    ? categories.flatMap((c) => c.items.filter((it) => it.is_featured && it.available))
    : [];

  return (
    <div>
      <div className="menu-header">
        <button
          className="lang-toggle"
          onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
          aria-label="Switch language"
        >
          {lang === 'cs' ? 'EN' : 'CS'}
        </button>
        <h1>{restaurant.name}</h1>
      </div>
      <div className="container">
        {categories.length === 0 && (
          <p className="muted">{t(lang, 'menuEmpty')}</p>
        )}

        {hasAnyItems && (
          <div className="menu-controls">
            <input
              type="search"
              className="search-input"
              placeholder={t(lang, 'searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filter-chips">
              {FILTER_DEFS.map((def) => {
                const active = activeFilters.has(def.key);
                return (
                  <button
                    key={def.key}
                    className={`chip ${active ? 'active' : ''}`}
                    onClick={() => toggleFilter(def.key)}
                  >
                    {t(lang, `filters.${def.key}`)}
                  </button>
                );
              })}
              {(activeFilters.size > 0 || search) && (
                <button
                  className="chip chip-clear"
                  onClick={() => { setActiveFilters(new Set()); setSearch(''); }}
                >
                  × {t(lang, 'clearFilters')}
                </button>
              )}
            </div>
          </div>
        )}

        {hasAnyItems && totalShown === 0 && (
          <p className="muted">{t(lang, 'noResults')}</p>
        )}

        {featuredItems.length > 0 && (
          <div className="category specials">
            <h2>★ {t(lang, 'specialsTitle')}</h2>
            {featuredItems.map((it) => (
              <div className={`item ${it.available ? '' : 'unavailable'}`} key={`feat-${it.id}`}>
                <div className="item-info">
                  <div className="item-name">{it.name}</div>
                  {it.description && <div className="item-desc">{it.description}</div>}
                  <DietBadges item={it} lang={lang} includeFeatured={false} />
                  <AllergensLine item={it} lang={lang} />
                </div>
                <div className="item-price">{formatPrice(it.price, lang)}</div>
              </div>
            ))}
          </div>
        )}

        {filteredCategories.map((c) => (
          <div className="category" key={c.id}>
            <h2>{c.name}</h2>
            {c.items.map((it) => (
              <div className={`item ${it.available ? '' : 'unavailable'}`} key={it.id}>
                <div className="item-info">
                  <div className="item-name">{it.name}</div>
                  {it.description && <div className="item-desc">{it.description}</div>}
                  <DietBadges item={it} lang={lang} />
                  <AllergensLine item={it} lang={lang} />
                  {!it.available && <div className="muted">{t(lang, 'unavailable')}</div>}
                </div>
                <div className="item-price">{formatPrice(it.price, lang)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
