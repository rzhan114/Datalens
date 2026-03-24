import { useState, useEffect } from 'react'
import {
  BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import './App.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Dataset {
  id: string;
  kind: string;
  numRows: number;
}

interface Message {
  type: 'success' | 'error';
  text: string;
}

interface Role {
  jobId: string;
  role: string;
}

interface SalaryBenchmarkItem {
  company: string;
  industry: string;
  avgSalary: number;
}

interface CompetitionItem {
  company: string;
  avgSalary: number;
  openings: number;
  applicants: number;
  acceptanceRate: number;
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const API_BASE = 'http://localhost:1220'
  const DEV_API_KEY = 'datalens-dev-key'

  // Auth
  const [token, setToken] = useState<string>('')
  const [authError, setAuthError] = useState<string>('')

  // Dataset management
  const [datasetId, setDatasetId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [message, setMessage] = useState<Message | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [expandedDataset, setExpandedDataset] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'benchmark' | 'competition' | 'opportunities'>('benchmark')

  // Shared: industry list for current dataset
  const [industries, setIndustries] = useState<string[]>([])
  const [loadingIndustries, setLoadingIndustries] = useState(false)

  // View 1 – Salary Benchmarking
  const [benchIndustry, setBenchIndustry] = useState('')
  const [benchRoles, setBenchRoles] = useState<Role[]>([])
  const [benchSelectedRole, setBenchSelectedRole] = useState('')
  const [salaryBenchmark, setSalaryBenchmark] = useState<SalaryBenchmarkItem[]>([])
  const [loadingBenchRoles, setLoadingBenchRoles] = useState(false)
  const [loadingBenchmark, setLoadingBenchmark] = useState(false)

  // Views 2 & 3 – Competition / Opportunities (shared data)
  const [compIndustry, setCompIndustry] = useState('')
  const [competitionData, setCompetitionData] = useState<CompetitionItem[]>([])
  const [loadingCompetition, setLoadingCompetition] = useState(false)

  // ─── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => { fetchToken() }, [])

  const fetchToken = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: DEV_API_KEY }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setToken(data.token)
    } catch (err: any) {
      setAuthError('Could not authenticate with server: ' + err.message)
    }
  }

  const authHeader = () => ({ Authorization: `Bearer ${token}` })

  // ─── Datasets ──────────────────────────────────────────────────────────────

  useEffect(() => { if (token) fetchDatasets() }, [token])

  const fetchDatasets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/datasets`, { headers: authHeader() })
      if (res.ok) { const data = await res.json(); setDatasets(data.result || []) }
    } catch (err) { console.error('Failed to fetch datasets:', err) }
  }

  const validateId = (id: string): string | null => {
    if (!id.trim()) return 'Dataset ID cannot be empty'
    if (id.includes('_')) return 'Dataset ID cannot contain underscores'
    if (id.trim() !== id) return 'Dataset ID cannot have leading or trailing whitespace'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    const idError = validateId(datasetId)
    if (idError) { setMessage({ type: 'error', text: idError }); return }
    if (!selectedFile) { setMessage({ type: 'error', text: 'Please select a zip file' }); return }
    if (!selectedFile.name.endsWith('.zip')) { setMessage({ type: 'error', text: 'Please select a .zip file' }); return }

    setIsLoading(true)
    try {
      const buffer = new Uint8Array(await selectedFile.arrayBuffer())
      const res = await fetch(`${API_BASE}/api/v1/dataset/${datasetId}`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/x-zip-compressed' },
        body: buffer,
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: `Dataset "${datasetId}" added successfully!` })
        await fetchDatasets()
        setDatasetId(''); setSelectedFile(null)
        const fi = document.getElementById('file-input') as HTMLInputElement
        if (fi) fi.value = ''
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add dataset' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error: Could not connect to server on port 1220.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete dataset "${id}"?`)) return
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/dataset/${id}`, { method: 'DELETE', headers: authHeader() })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: `Dataset "${id}" removed.` })
        await fetchDatasets()
        if (expandedDataset === id) setExpandedDataset(null)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove dataset' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchIndustries = async (dsId: string) => {
    setLoadingIndustries(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/analytics/${dsId}/industries`, { headers: authHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setIndustries(data.result)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to load industries: ${err.message}` })
    } finally {
      setLoadingIndustries(false)
    }
  }

  const fetchBenchRoles = async (dsId: string, industry: string) => {
    setLoadingBenchRoles(true)
    setBenchRoles([]); setBenchSelectedRole(''); setSalaryBenchmark([])
    try {
      const res = await fetch(`${API_BASE}/api/v1/analytics/${dsId}/roles/${industry}`, { headers: authHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBenchRoles(data.result)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to load roles: ${err.message}` })
    } finally {
      setLoadingBenchRoles(false)
    }
  }

  const fetchSalaryBenchmark = async (dsId: string, role: string) => {
    setLoadingBenchmark(true); setSalaryBenchmark([])
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/analytics/${dsId}/salary-benchmark/${encodeURIComponent(role)}`,
        { headers: authHeader() }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSalaryBenchmark(data.result)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to load benchmark: ${err.message}` })
    } finally {
      setLoadingBenchmark(false)
    }
  }

  const fetchCompetitionData = async (dsId: string, industry: string) => {
    setLoadingCompetition(true); setCompetitionData([])
    try {
      const res = await fetch(`${API_BASE}/api/v1/analytics/${dsId}/competition/${industry}`, { headers: authHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCompetitionData(data.result)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to load competition data: ${err.message}` })
    } finally {
      setLoadingCompetition(false)
    }
  }

  // ─── Event handlers ────────────────────────────────────────────────────────

  const toggleInsights = async (id: string) => {
    if (expandedDataset === id) {
      setExpandedDataset(null)
      setIndustries([])
      setBenchIndustry(''); setBenchRoles([]); setBenchSelectedRole(''); setSalaryBenchmark([])
      setCompIndustry(''); setCompetitionData([])
    } else {
      setExpandedDataset(id)
      await fetchIndustries(id)
    }
  }

  const handleBenchIndustrySelect = async (industry: string) => {
    setBenchIndustry(industry)
    if (industry && expandedDataset) await fetchBenchRoles(expandedDataset, industry)
  }

  const handleBenchRoleSelect = async (role: string) => {
    setBenchSelectedRole(role)
    if (role && expandedDataset) await fetchSalaryBenchmark(expandedDataset, role)
  }

  const handleCompIndustrySelect = async (industry: string) => {
    setCompIndustry(industry)
    setCompetitionData([])
    if (industry && expandedDataset) await fetchCompetitionData(expandedDataset, industry)
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  // Color for acceptance rate bars: green > 5%, yellow 1-5%, red < 1%
  const rateColor = (rate: number) =>
    rate >= 5 ? '#43e97b' : rate >= 1 ? '#fee140' : '#fa709a'

  if (authError) {
    return (
      <div className="app">
        <div className="container" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#fa709a', fontSize: '16px' }}>⚠️ {authError}</p>
          <p>Make sure the server is running: <code>yarn start</code> in the project root.</p>
        </div>
      </div>
    )
  }

  // ─── Scatter data for View 3 ───────────────────────────────────────────────

  const avgSalary = competitionData.length
    ? competitionData.reduce((s, c) => s + c.avgSalary, 0) / competitionData.length : 0
  const avgRate = competitionData.length
    ? competitionData.reduce((s, c) => s + c.acceptanceRate, 0) / competitionData.length : 0

  const sweetSpot   = competitionData.filter(c => c.avgSalary >= avgSalary && c.acceptanceRate >= avgRate)
  const highPayHard = competitionData.filter(c => c.avgSalary >= avgSalary && c.acceptanceRate < avgRate)
  const easyLowPay  = competitionData.filter(c => c.avgSalary < avgSalary  && c.acceptanceRate >= avgRate)
  const lowPayHard  = competitionData.filter(c => c.avgSalary < avgSalary  && c.acceptanceRate < avgRate)

  const toScatter = (arr: CompetitionItem[]) =>
    arr.map(c => ({ x: c.acceptanceRate, y: c.avgSalary, company: c.company, openings: c.openings }))

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label"><strong>{d.company}</strong></p>
          <p className="tooltip-content">Avg Salary: <strong>${d.y}K</strong></p>
          <p className="tooltip-content">Acceptance Rate: <strong>{d.x}%</strong></p>
          <p className="tooltip-content">Openings: <strong>{d.openings}</strong></p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="app">
      <header className="header">
        <h1>DataLens — Job Market Analytics</h1>
        <p>Upload job listing datasets and explore salary benchmarks, competition, and opportunity insights</p>
      </header>

      <div className="container">

        {/* ── Upload ── */}
        <div className="card">
          <h2>Add New Dataset</h2>
          <form onSubmit={handleSubmit} className="upload-form">
            <div className="form-group">
              <label htmlFor="dataset-id">Dataset ID <span className="required">*</span></label>
              <input id="dataset-id" type="text" value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                placeholder="e.g., jobs2024" className="input" disabled={isLoading} />
              <small className="hint">Cannot contain underscores or whitespace</small>
            </div>
            <div className="form-group">
              <label htmlFor="file-input">Select ZIP File <span className="required">*</span></label>
              <input id="file-input" type="file" accept=".zip"
                onChange={(e) => { if (e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setMessage(null) } }}
                className="file-input" disabled={isLoading} />
              {selectedFile && (
                <small className="file-selected">✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)</small>
              )}
            </div>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? '⏳ Uploading...' : '⬆ Add Dataset'}
            </button>
          </form>
          {message && (
            <div className={`message ${message.type}`}>
              {message.type === 'success' ? '✓ ' : '✗ '}{message.text}
            </div>
          )}
        </div>

        {/* ── Dataset list ── */}
        <div className="card">
          <h2>Current Datasets ({datasets.length})</h2>
          {datasets.length === 0 ? (
            <p className="empty-state">No datasets yet. Upload a job listings ZIP above.</p>
          ) : (
            <div className="datasets-list">
              {datasets.map((ds) => (
                <div key={ds.id} className="dataset-item">
                  <div className="dataset-info">
                    <h3>📁 {ds.id}</h3>
                    <p>Type: {ds.kind}</p>
                    <p>Rows: {ds.numRows.toLocaleString()}</p>
                  </div>
                  <div className="dataset-actions">
                    <button className="btn-insights" onClick={() => toggleInsights(ds.id)} disabled={loadingIndustries}>
                      📊 {expandedDataset === ds.id ? 'Hide Insights' : 'View Insights'}
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(ds.id)} disabled={isLoading}>
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Insights panel ── */}
      {expandedDataset && (
        <div className="insights-section">
          <div className="insights-container">
            <h3>📊 Insights for "{expandedDataset}"</h3>

            <div className="view-mode-toggle">
              <button className={`toggle-btn ${viewMode === 'benchmark' ? 'active' : ''}`}
                onClick={() => setViewMode('benchmark')}>
                💰 Salary Benchmark
              </button>
              <button className={`toggle-btn ${viewMode === 'competition' ? 'active' : ''}`}
                onClick={() => setViewMode('competition')}>
                ⚔️ Competition Index
              </button>
              <button className={`toggle-btn ${viewMode === 'opportunities' ? 'active' : ''}`}
                onClick={() => setViewMode('opportunities')}>
                🎯 Best Opportunities
              </button>
            </div>

            {/* ── View 1: Salary Benchmark ── */}
            {viewMode === 'benchmark' && (
              <>
                <p className="insight-description">
                  Select a role to see what different companies pay — useful when negotiating salary.
                </p>
                <div className="filter-selectors">
                  <div className="selector-group">
                    <label><strong>Step 1:</strong> Select an Industry</label>
                    <select value={benchIndustry} onChange={(e) => handleBenchIndustrySelect(e.target.value)}
                      className="dropdown" disabled={loadingIndustries || loadingBenchRoles}>
                      <option value="">-- Choose an industry --</option>
                      {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                    {loadingIndustries && <p className="loading-text">⏳ Loading industries...</p>}
                  </div>

                  {benchIndustry && (
                    <div className="selector-group">
                      <label><strong>Step 2:</strong> Select a Role</label>
                      <select value={benchSelectedRole} onChange={(e) => handleBenchRoleSelect(e.target.value)}
                        className="dropdown" disabled={loadingBenchRoles || loadingBenchmark}>
                        <option value="">-- Choose a role --</option>
                        {benchRoles.map((r) => <option key={r.jobId} value={r.role}>{r.role}</option>)}
                      </select>
                      {loadingBenchRoles && <p className="loading-text">⏳ Loading roles...</p>}
                    </div>
                  )}
                </div>

                {loadingBenchmark && <p className="loading-text">⏳ Loading salary data...</p>}

                {salaryBenchmark.length > 0 && (
                  <div className="chart-panel">
                    <h4>Salary Comparison — "{benchSelectedRole}"</h4>
                    <ResponsiveContainer width="100%" height={Math.max(300, salaryBenchmark.length * 45)}>
                      <BarChart data={salaryBenchmark} layout="vertical"
                        margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" unit="K"
                          label={{ value: 'Avg Salary ($K)', position: 'insideBottom', offset: -5 }}
                          domain={[0, 'dataMax + 20']} />
                        <YAxis type="category" dataKey="company" width={160}
                          tick={{ fontSize: 12 }} />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload?.length) {
                            const d = payload[0].payload
                            return (
                              <div className="custom-tooltip">
                                <p className="tooltip-label"><strong>{d.company}</strong></p>
                                <p className="tooltip-content">Avg Salary: <strong>${d.avgSalary}K</strong></p>
                                <p className="tooltip-content">Industry: <strong>{d.industry}</strong></p>
                              </div>
                            )
                          }
                          return null
                        }} />
                        <Bar dataKey="avgSalary" name="Avg Salary ($K)" radius={[0, 6, 6, 0]}>
                          {salaryBenchmark.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#43e97b' : i === salaryBenchmark.length - 1 ? '#fa709a' : '#667eea'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="course-summary">
                      <h5>Benchmark Summary:</h5>
                      <p>• Companies compared: <strong>{salaryBenchmark.length}</strong></p>
                      <p>• Highest pay: <strong>${salaryBenchmark[0].avgSalary}K</strong> — {salaryBenchmark[0].company}</p>
                      <p>• Lowest pay: <strong>${salaryBenchmark[salaryBenchmark.length - 1].avgSalary}K</strong> — {salaryBenchmark[salaryBenchmark.length - 1].company}</p>
                      <p>• Market avg: <strong>
                        ${(salaryBenchmark.reduce((s, c) => s + c.avgSalary, 0) / salaryBenchmark.length).toFixed(1)}K
                      </strong></p>
                    </div>
                  </div>
                )}

                {benchSelectedRole && salaryBenchmark.length === 0 && !loadingBenchmark && (
                  <p className="empty-state">No salary data found for this role.</p>
                )}
              </>
            )}

            {/* ── View 2: Competition Index ── */}
            {viewMode === 'competition' && (
              <>
                <p className="insight-description">
                  Acceptance rate = openings ÷ applicants. Higher = easier to get in.
                  <span style={{ marginLeft: 12 }}>
                    <span style={{ color: '#43e97b' }}>■</span> &gt;5%&nbsp;
                    <span style={{ color: '#fee140' }}>■</span> 1–5%&nbsp;
                    <span style={{ color: '#fa709a' }}>■</span> &lt;1%
                  </span>
                </p>
                <div className="filter-selectors">
                  <div className="selector-group">
                    <label><strong>Select an Industry</strong></label>
                    <select value={compIndustry} onChange={(e) => handleCompIndustrySelect(e.target.value)}
                      className="dropdown" disabled={loadingIndustries || loadingCompetition}>
                      <option value="">-- Choose an industry --</option>
                      {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                    {loadingIndustries && <p className="loading-text">⏳ Loading industries...</p>}
                  </div>
                </div>

                {loadingCompetition && <p className="loading-text">⏳ Loading competition data...</p>}

                {competitionData.length > 0 && (
                  <div className="chart-panel">
                    <h4>Acceptance Rate by Company — {compIndustry}</h4>
                    <ResponsiveContainer width="100%" height={Math.max(300, competitionData.length * 40)}>
                      <BarChart data={competitionData} layout="vertical"
                        margin={{ top: 10, right: 70, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" unit="%"
                          label={{ value: 'Acceptance Rate (%)', position: 'insideBottom', offset: -5 }}
                          domain={[0, 'dataMax + 1']} />
                        <YAxis type="category" dataKey="company" width={160} tick={{ fontSize: 12 }} />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload?.length) {
                            const d = payload[0].payload
                            return (
                              <div className="custom-tooltip">
                                <p className="tooltip-label"><strong>{d.company}</strong></p>
                                <p className="tooltip-content">Acceptance Rate: <strong>{d.acceptanceRate}%</strong></p>
                                <p className="tooltip-content">Openings: <strong>{d.openings}</strong></p>
                                <p className="tooltip-content">Applicants: <strong>{d.applicants.toLocaleString()}</strong></p>
                                <p className="tooltip-content">Avg Salary: <strong>${d.avgSalary}K</strong></p>
                              </div>
                            )
                          }
                          return null
                        }} />
                        <Bar dataKey="acceptanceRate" name="Acceptance Rate (%)" radius={[0, 6, 6, 0]}>
                          {competitionData.map((c, i) => (
                            <Cell key={i} fill={rateColor(c.acceptanceRate)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="course-summary">
                      <h5>Competition Summary — {compIndustry}:</h5>
                      <p>• Easiest to get into: <strong>{competitionData[0].company}</strong> ({competitionData[0].acceptanceRate}%)</p>
                      <p>• Most competitive: <strong>{competitionData[competitionData.length - 1].company}</strong> ({competitionData[competitionData.length - 1].acceptanceRate}%)</p>
                      <p>• Industry avg acceptance rate: <strong>
                        {(competitionData.reduce((s, c) => s + c.acceptanceRate, 0) / competitionData.length).toFixed(2)}%
                      </strong></p>
                    </div>
                  </div>
                )}

                {compIndustry && competitionData.length === 0 && !loadingCompetition && (
                  <p className="empty-state">No competition data found for this industry.</p>
                )}
              </>
            )}

            {/* ── View 3: Best Opportunities ── */}
            {viewMode === 'opportunities' && (
              <>
                <p className="insight-description">
                  Each dot is a company. <strong>Top-right</strong> = high salary + easy to get in = sweet spot.
                  Hover over dots to see company details.
                </p>
                <div className="filter-selectors">
                  <div className="selector-group">
                    <label><strong>Select an Industry</strong></label>
                    <select value={compIndustry} onChange={(e) => handleCompIndustrySelect(e.target.value)}
                      className="dropdown" disabled={loadingIndustries || loadingCompetition}>
                      <option value="">-- Choose an industry --</option>
                      {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                    {loadingIndustries && <p className="loading-text">⏳ Loading industries...</p>}
                  </div>
                </div>

                {loadingCompetition && <p className="loading-text">⏳ Loading data...</p>}

                {competitionData.length > 0 && (
                  <div className="chart-panel">
                    <h4>Salary vs Acceptance Rate — {compIndustry}</h4>
                    <ResponsiveContainer width="100%" height={480}>
                      <ScatterChart margin={{ top: 20, right: 40, left: 20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="x" name="Acceptance Rate" unit="%"
                          label={{ value: 'Acceptance Rate (%)', position: 'insideBottom', offset: -20 }} />
                        <YAxis type="number" dataKey="y" name="Avg Salary" unit="K"
                          label={{ value: 'Avg Salary ($K)', angle: -90, position: 'insideLeft', offset: 10 }} />
                        <ZAxis range={[60, 60]} />
                        <Tooltip content={<CustomScatterTooltip />} />
                        <Legend verticalAlign="top" />
                        <Scatter name="🟢 Sweet Spot (high pay + easy)" data={toScatter(sweetSpot)} fill="#43e97b" />
                        <Scatter name="🟡 High Pay, Competitive" data={toScatter(highPayHard)} fill="#fee140" />
                        <Scatter name="🔵 Easy, Lower Pay" data={toScatter(easyLowPay)} fill="#4facfe" />
                        <Scatter name="🔴 Low Pay + Competitive" data={toScatter(lowPayHard)} fill="#fa709a" />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="course-summary">
                      <h5>Opportunity Summary — {compIndustry}:</h5>
                      <p>• Sweet spot companies: <strong>{sweetSpot.length}</strong>
                        {sweetSpot.length > 0 && <> — {sweetSpot.slice(0, 3).map(c => c.company).join(', ')}{sweetSpot.length > 3 ? '...' : ''}</>}
                      </p>
                      <p>• Industry avg salary: <strong>${avgSalary.toFixed(1)}K</strong></p>
                      <p>• Industry avg acceptance rate: <strong>{avgRate.toFixed(2)}%</strong></p>
                      <p>• Total companies analysed: <strong>{competitionData.length}</strong></p>
                    </div>
                  </div>
                )}

                {compIndustry && competitionData.length === 0 && !loadingCompetition && (
                  <p className="empty-state">No data found for this industry.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
