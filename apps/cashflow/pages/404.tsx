// Custom 404 pagina — overschrijft Next.js ingebouwde error page
// die styled-jsx gebruikt en conflicteert met de monorepo React versie
export default function Custom404() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>404</h1>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>Pagina niet gevonden</p>
      </div>
    </div>
  );
}
