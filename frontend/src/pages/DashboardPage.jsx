import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DonutChart from '../components/DonutChart';
import DateRangeFilter from '../components/DateRangeFilter';
import { Users, Store, UserCheck, Star } from 'lucide-react';

// Horizontal bar list. Rows are clickable to drill into the Directory (via filterKey).
function Bars({ data, color, filterKey, navigate, emptyText = 'No data yet' }) {
  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px 0' }}>{emptyText}</div>;
  }
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div
          key={d.label}
          className="bar-row"
          onClick={filterKey ? () => navigate(`/?${filterKey}=${encodeURIComponent(d.label)}`) : undefined}
          style={{ cursor: filterKey ? 'pointer' : 'default' }}
          title={filterKey ? `View ${d.label} contacts` : d.label}
        >
          <div className="bar-label" title={d.label}>{d.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%`, background: color }} />
          </div>
          <div className="bar-count">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${accent}1A`, color: accent }}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // "All time" first — the dashboard opens showing everything, then narrows.
  const [range, setRange] = useState({ preset: 'all', from: null, to: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.post('/contact/analytics', { from: range.from, to: range.to })
      .then(res => { if (!cancelled && res.data.success) setData(res.data.data); })
      .catch(err => { if (!cancelled) console.error(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const find = (arr, label) => (arr || []).find(x => (x.label || '').toUpperCase() === label.toUpperCase())?.count || 0;

  const total = data?.total || 0;
  const dealers = find(data?.byCategory, 'DEALER');
  const customers = find(data?.byCategory, 'CUSTOMER');
  const highPotential = find(data?.byGrade, 'High Potential');
  // The donut's whole: every product selection made, across all contacts.
  const productSelections = (data?.byProduct || []).reduce((s, d) => s + d.count, 0);

  return (
    <div className="page-container" style={{ paddingTop: 32 }}>
      <div className="form-header-flex" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-dark)' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>Product &amp; customer analytics — click any bar to see those contacts</p>
        </div>
        {/* One filter row above everything it scopes: every figure below moves
            with this control. Scopes the dashboard only — the Directory keeps
            its own filters and is not affected. */}
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {range.preset !== 'all' && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
          Dated by the contact&apos;s <strong>Date</strong> field, or the date it was added when no Date is set.
        </div>
      )}

      {loading && !data ? (
        <div style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Loading analytics…</div>
      ) : (
        // On refetch, hold the previous render dimmed rather than flashing a
        // skeleton and jumping the layout.
        <div style={loading ? { opacity: 0.55, pointerEvents: 'none' } : undefined}>
          {/* Stat cards */}
          <div className="stat-grid">
            <StatCard icon={<Users size={22} />} label="Total Contacts" value={total} accent="#E25C24" />
            <StatCard icon={<Store size={22} />} label="Dealers" value={dealers} accent="#0369A1" />
            <StatCard icon={<UserCheck size={22} />} label="Customers" value={customers} accent="#7E22CE" />
            <StatCard icon={<Star size={22} />} label="High Potential" value={highPotential} accent="#16A34A" />
          </div>

          {/* Products — the core of the request. Two views of the same data:
              the donut answers "what share of demand is each product", the bars
              answer "exactly how many contacts buy each one". */}
          <div className="form-section">
            <div className="form-section-title">Product Mix</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: -6, marginBottom: 14 }}>
              Share of all {productSelections} product selections across {data?.productContacts ?? 0} contacts.
              Contacts can choose more than one product, so shares are of selections — not of contacts.
            </p>
            <DonutChart
              data={data?.byProduct}
              onSliceClick={(label) => navigate(`/?product=${encodeURIComponent(label)}`)}
              valueNoun="selections"
            />
          </div>

          <div className="form-section">
            <div className="form-section-title">Contacts by Product</div>
            <Bars data={data?.byProduct} color="#2a78d6" filterKey="product" navigate={navigate} emptyText="No products recorded on contacts yet." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <div className="form-section" style={{ marginBottom: 0 }}>
              <div className="form-section-title">Customer Grade</div>
              <Bars data={data?.byGrade} color="#16A34A" filterKey="customer_grade" navigate={navigate} />
            </div>
            <div className="form-section" style={{ marginBottom: 0 }}>
              <div className="form-section-title">Category (Dealer / Customer)</div>
              <Bars data={data?.byCategory} color="#0369A1" filterKey="category" navigate={navigate} />
            </div>
            <div className="form-section" style={{ marginBottom: 0 }}>
              <div className="form-section-title">Type of Purchase</div>
              <Bars data={data?.byPurchase} color="#7E22CE" filterKey="purchase_type" navigate={navigate} />
            </div>
            <div className="form-section" style={{ marginBottom: 0 }}>
              <div className="form-section-title">Type of House</div>
              <Bars data={data?.byHouse} color="#C54C1A" filterKey="house_type" navigate={navigate} />
            </div>
          </div>

          {/* Top states */}
          <div className="form-section" style={{ marginTop: 24 }}>
            <div className="form-section-title">Top States</div>
            <Bars data={data?.byState} color="#2C5282" filterKey="state" navigate={navigate} />
          </div>
        </div>
      )}
    </div>
  );
}
