import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="hero">
      <h1>QR Jídelníček Pro</h1>
      <p>
        Digitální menu pro vaši restauraci. Zákazníci načtou QR kód a mají na mobilu
        aktuální nabídku. Bez aplikací, bez instalace. Jen 199 Kč/měsíc.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/admin" className="btn primary">Začít zdarma</Link>
      </div>
    </div>
  );
}
