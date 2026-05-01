import { Link } from 'react-router-dom';

const colors = {
  bg: '#0f172a',
  bgAlt: '#111c33',
  card: '#1e293b',
  cardBorder: '#334155',
  accent: '#6366f1',
  accentHover: '#7c7ff5',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  white: '#ffffff',
};

const styles = {
  page: {
    background: colors.bg,
    color: colors.text,
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    lineHeight: 1.6,
  },
  container: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '0 24px',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 0',
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.white,
    letterSpacing: '-0.02em',
  },
  navLink: {
    color: colors.textMuted,
    textDecoration: 'none',
    fontSize: 15,
    marginRight: 24,
  },
  hero: {
    textAlign: 'center',
    padding: '80px 0 100px',
  },
  heroBadge: {
    display: 'inline-block',
    padding: '6px 14px',
    background: 'rgba(99, 102, 241, 0.12)',
    color: colors.accent,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 24,
    border: '1px solid rgba(99, 102, 241, 0.3)',
  },
  heroTitle: {
    fontSize: 'clamp(36px, 5vw, 60px)',
    fontWeight: 800,
    color: colors.white,
    margin: '0 0 24px',
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
  },
  heroAccent: {
    color: colors.accent,
  },
  heroSubtitle: {
    fontSize: 'clamp(16px, 2vw, 19px)',
    color: colors.textMuted,
    maxWidth: 640,
    margin: '0 auto 40px',
  },
  ctaPrimary: {
    display: 'inline-block',
    background: colors.accent,
    color: colors.white,
    padding: '14px 32px',
    borderRadius: 10,
    fontSize: 17,
    fontWeight: 600,
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(99, 102, 241, 0.35)',
    transition: 'transform 0.15s ease, background 0.15s ease',
  },
  ctaSecondary: {
    display: 'inline-block',
    background: 'transparent',
    color: colors.text,
    padding: '14px 28px',
    borderRadius: 10,
    fontSize: 17,
    fontWeight: 600,
    textDecoration: 'none',
    border: `1px solid ${colors.cardBorder}`,
    marginLeft: 12,
    cursor: 'pointer',
  },
  heroNote: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textDim,
  },
  section: {
    padding: '80px 0',
  },
  sectionAlt: {
    background: colors.bgAlt,
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 'clamp(28px, 4vw, 40px)',
    fontWeight: 700,
    color: colors.white,
    margin: '0 0 16px',
    letterSpacing: '-0.02em',
  },
  sectionSubtitle: {
    textAlign: 'center',
    fontSize: 17,
    color: colors.textMuted,
    maxWidth: 600,
    margin: '0 auto 56px',
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24,
  },
  stepCard: {
    background: colors.card,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 14,
    padding: 32,
    textAlign: 'center',
  },
  stepNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: colors.accent,
    color: colors.white,
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 19,
    fontWeight: 600,
    color: colors.white,
    margin: '0 0 10px',
  },
  stepDesc: {
    color: colors.textMuted,
    fontSize: 15,
    margin: 0,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
  },
  featureCard: {
    background: colors.card,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 14,
    padding: 28,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 14,
    display: 'block',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: colors.white,
    margin: '0 0 8px',
  },
  featureDesc: {
    color: colors.textMuted,
    fontSize: 14.5,
    margin: 0,
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 24,
    maxWidth: 820,
    margin: '0 auto',
  },
  pricingCard: {
    background: colors.card,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 16,
    padding: 36,
    position: 'relative',
  },
  pricingCardPro: {
    border: `2px solid ${colors.accent}`,
    boxShadow: '0 20px 50px rgba(99, 102, 241, 0.2)',
  },
  pricingBadge: {
    position: 'absolute',
    top: -12,
    right: 24,
    background: colors.accent,
    color: colors.white,
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 999,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  planName: {
    fontSize: 18,
    fontWeight: 600,
    color: colors.white,
    margin: '0 0 8px',
  },
  planPrice: {
    fontSize: 40,
    fontWeight: 800,
    color: colors.white,
    margin: '0 0 4px',
    letterSpacing: '-0.02em',
  },
  planPriceUnit: {
    fontSize: 16,
    fontWeight: 500,
    color: colors.textMuted,
  },
  planDesc: {
    color: colors.textMuted,
    fontSize: 14,
    margin: '0 0 24px',
  },
  planList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 28px',
  },
  planListItem: {
    color: colors.text,
    fontSize: 15,
    padding: '8px 0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  planCheck: {
    color: colors.accent,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 2,
  },
  planButton: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '12px 20px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    border: `1px solid ${colors.cardBorder}`,
    color: colors.text,
    background: 'transparent',
    boxSizing: 'border-box',
  },
  planButtonPrimary: {
    background: colors.accent,
    color: colors.white,
    border: `1px solid ${colors.accent}`,
  },
  ctaSection: {
    textAlign: 'center',
    padding: '90px 24px',
    background: `linear-gradient(135deg, ${colors.accent} 0%, #8b5cf6 100%)`,
    borderRadius: 20,
    margin: '80px 24px',
    maxWidth: 1080,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  ctaTitle: {
    fontSize: 'clamp(28px, 4vw, 40px)',
    fontWeight: 800,
    color: colors.white,
    margin: '0 0 16px',
    letterSpacing: '-0.02em',
  },
  ctaSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    margin: '0 0 32px',
  },
  ctaButtonInverse: {
    display: 'inline-block',
    background: colors.white,
    color: colors.accent,
    padding: '16px 36px',
    borderRadius: 10,
    fontSize: 17,
    fontWeight: 700,
    textDecoration: 'none',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
  },
  footer: {
    textAlign: 'center',
    padding: '40px 24px',
    color: colors.textDim,
    fontSize: 14,
    borderTop: `1px solid ${colors.cardBorder}`,
  },
};

const features = [
  { icon: '📱', title: 'QR kód barevný', desc: 'Stáhněte si QR kód v PNG, SVG nebo PDF s vlastními barvami.' },
  { icon: '🌍', title: 'CZ/EN vícejazyčné menu', desc: 'Hosté přepnou na anglickou verzi jedním klikem.' },
  { icon: '✏️', title: 'Drag-drop řazení položek', desc: 'Přetáhněte kategorie a položky myší – bez technických znalostí.' },
  { icon: '📊', title: 'Statistiky zobrazení', desc: 'Sledujte, kolikrát zákazníci načetli menu a které položky frčí.' },
  { icon: '🔔', title: 'Email notifikace', desc: 'Dostávejte přehledné reporty o aktivitě restaurace na e-mail.' },
  { icon: '💳', title: '14 dní zdarma bez karty', desc: 'Vyzkoušejte celý Pro plán bez nutnosti zadávat platební údaje.' },
];

const steps = [
  { n: 1, title: 'Registrujte se zdarma', desc: 'Vytvořte si účet za 30 sekund. Bez karty, bez závazků.' },
  { n: 2, title: 'Přidejte položky menu', desc: 'Nahrajte kategorie, jídla, ceny a obrázky. Vše přehledně v jednom dashboardu.' },
  { n: 3, title: 'Zákazníci skenují QR kód', desc: 'Vytiskněte QR kód, dejte ho na stůl – a hosté vidí aktuální menu na mobilu.' },
];

const freePlanFeatures = [
  '1 restaurace',
  'Základní digitální menu',
  'QR kód v PNG',
  'CZ/EN vícejazyčné menu',
  'Neomezený počet položek',
];

const proPlanFeatures = [
  'Neomezený počet restaurací',
  'Statistiky zobrazení a aktivity',
  'QR kód v PNG, SVG i PDF',
  'Vlastní barvy a branding',
  'Email notifikace s reporty',
  'Prioritní emailová podpora',
];

export default function LandingPage() {
  return (
    <div style={styles.page}>
      <style>{`
        a.cta-primary:hover { background: ${colors.accentHover} !important; transform: translateY(-1px); }
        a.cta-secondary:hover { border-color: ${colors.accent} !important; color: ${colors.white} !important; }
        a.plan-button:hover { border-color: ${colors.accent} !important; color: ${colors.white} !important; }
        a.plan-button-primary:hover { background: ${colors.accentHover} !important; border-color: ${colors.accentHover} !important; }
        a.cta-inverse:hover { transform: translateY(-2px); }
        a.nav-link:hover { color: ${colors.white} !important; }
      `}</style>

      <div style={styles.container}>
        <nav style={styles.nav}>
          <div style={styles.logo}>QR Jídelníček <span style={{ color: colors.accent }}>Pro</span></div>
          <div>
            <Link to="/admin" className="nav-link" style={styles.navLink}>Přihlásit</Link>
            <Link to="/admin" className="cta-primary" style={{ ...styles.ctaPrimary, padding: '8px 18px', fontSize: 14 }}>
              Začít zdarma
            </Link>
          </div>
        </nav>

        <section style={styles.hero}>
          <div style={styles.heroBadge}>✨ Nová generace digitálního menu</div>
          <h1 style={styles.heroTitle}>
            Digitální menu pro vaši restauraci{' '}
            <span style={styles.heroAccent}>za 5 minut</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Vytvořte interaktivní jídelníček s QR kódem. Zákazníci načtou kód mobilem a vidí aktuální nabídku.
            Bez aplikací, bez instalace – jen čistý a rychlý zážitek.
          </p>
          <div>
            <Link to="/admin" className="cta-primary" style={styles.ctaPrimary}>
              Začít zdarma →
            </Link>
            <Link to="/admin" className="cta-secondary" style={styles.ctaSecondary}>
              Přihlásit se
            </Link>
          </div>
          <p style={styles.heroNote}>14 dní Pro plánu zdarma · žádná platební karta</p>
        </section>
      </div>

      <section style={{ ...styles.section, ...styles.sectionAlt }}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Jak to funguje</h2>
          <p style={styles.sectionSubtitle}>Tři kroky a vaše menu žije online.</p>
          <div style={styles.stepsGrid}>
            {steps.map((s) => (
              <div key={s.n} style={styles.stepCard}>
                <div style={styles.stepNumber}>{s.n}</div>
                <h3 style={styles.stepTitle}>{s.title}</h3>
                <p style={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Vše, co potřebujete</h2>
          <p style={styles.sectionSubtitle}>
            Postaveno pro restaurace, kavárny i pop-up koncepty.
          </p>
          <div style={styles.featuresGrid}>
            {features.map((f) => (
              <div key={f.title} style={styles.featureCard}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...styles.section, ...styles.sectionAlt }}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Jednoduchý ceník</h2>
          <p style={styles.sectionSubtitle}>Začněte zdarma. Vyrosťte, až to budete potřebovat.</p>
          <div style={styles.pricingGrid}>
            <div style={styles.pricingCard}>
              <h3 style={styles.planName}>Free</h3>
              <div style={styles.planPrice}>0 Kč<span style={styles.planPriceUnit}> / měsíc</span></div>
              <p style={styles.planDesc}>Pro malé provozy a začátky.</p>
              <ul style={styles.planList}>
                {freePlanFeatures.map((f) => (
                  <li key={f} style={styles.planListItem}>
                    <span style={styles.planCheck}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/admin" className="plan-button" style={styles.planButton}>
                Začít zdarma
              </Link>
            </div>

            <div style={{ ...styles.pricingCard, ...styles.pricingCardPro }}>
              <span style={styles.pricingBadge}>Doporučeno</span>
              <h3 style={styles.planName}>Pro</h3>
              <div style={styles.planPrice}>299 Kč<span style={styles.planPriceUnit}> / měsíc</span></div>
              <p style={styles.planDesc}>Pro restaurace, které chtějí růst.</p>
              <ul style={styles.planList}>
                {proPlanFeatures.map((f) => (
                  <li key={f} style={styles.planListItem}>
                    <span style={styles.planCheck}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/admin" className="plan-button-primary" style={{ ...styles.planButton, ...styles.planButtonPrimary }}>
                Vyzkoušet 14 dní zdarma
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.ctaSection}>
        <h2 style={styles.ctaTitle}>Vyzkoušejte zdarma 14 dní</h2>
        <p style={styles.ctaSubtitle}>Bez platební karty. Bez závazků. Začněte za pět minut.</p>
        <Link to="/admin" className="cta-inverse" style={styles.ctaButtonInverse}>
          Začít zdarma →
        </Link>
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} QR Jídelníček Pro. Digitální menu pro českou gastronomii.
      </footer>
    </div>
  );
}
