import { openDb } from '@/lib/db';

export default async function Dashboard() {
  const db = await openDb();
  
  // Ambil rekap data
  const leads = await db.all(`
    SELECT L.*, C.name as categoryName 
    FROM Lead L
    LEFT JOIN Category C ON L.categoryId = C.id
    ORDER BY L.id DESC
  `);
  
  const totalLeads = leads.length;
  const noWebsite = leads.filter(l => !l.website).length;
  
  // Ambil kategori untuk filter (opsional bisa dikembangkan nanti)
  const categories = await db.all('SELECT * FROM Category ORDER BY name');

  return (
    <div>
      <div className="dashboard-grid">
        <div className="stat-card glass">
          <h3>Total Leads</h3>
          <p className="value">{totalLeads}</p>
        </div>
        <div className="stat-card glass">
          <h3>Belum Punya Website</h3>
          <p className="value" style={{color: '#fca5a5'}}>{noWebsite}</p>
        </div>
        <div className="stat-card glass">
          <h3>Kategori Bisnis</h3>
          <p className="value" style={{color: '#93c5fd'}}>{categories.length}</p>
        </div>
      </div>

      <div className="glass table-container">
        <table>
          <thead>
            <tr>
              <th>Nama Bisnis</th>
              <th>Kategori</th>
              <th>Alamat</th>
              <th>Kontak</th>
              <th>Website</th>
              <th>Status Website</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan="6" style={{textAlign: 'center', color: 'var(--text-muted)'}}>
                  Belum ada data. Silakan import dari menu Import Data.
                </td>
              </tr>
            ) : leads.map(lead => (
              <tr key={lead.id}>
                <td style={{fontWeight: 600}}>{lead.name}</td>
                <td>
                  <span className="badge cat">{lead.categoryName || 'Tanpa Kategori'}</span>
                </td>
                <td style={{color: 'var(--text-muted)'}}>
                  {lead.address || '-'}
                </td>
                <td>
                  {lead.phone ? (
                    <a className="link" href={`https://wa.me/${lead.phone.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer">
                      {lead.phone}
                    </a>
                  ) : '-'}
                </td>
                <td>
                  {lead.website ? (
                    <a className="link" href={lead.website} target="_blank" rel="noopener noreferrer">Kunjungi</a>
                  ) : '-'}
                </td>
                <td>
                  {lead.website ? (
                    <span className="badge yes">Ada</span>
                  ) : (
                    <span className="badge no">Belum Ada</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
