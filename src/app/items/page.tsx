export default function ItemsPage() {
  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="filter-bar">
        <input className="form-control" placeholder="Search by UPC or description…" style={{ width: 320 }} />
        <input className="form-control" placeholder="Category…" style={{ width: 160 }} />
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>+ Add Item</button>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>UPC</th>
              <th>Description</th>
              <th>Brand</th>
              <th>Pack / Size</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                No items yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
