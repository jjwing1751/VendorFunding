export default function VendorsPage() {
  return (
    <div style={{ maxWidth: 900 }}>
      <div className="filter-bar">
        <input className="form-control" placeholder="Search vendors…" style={{ width: 280 }} />
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>+ Add Vendor</button>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor Name</th>
              <th>Account #</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Active Deals</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                No vendors yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
