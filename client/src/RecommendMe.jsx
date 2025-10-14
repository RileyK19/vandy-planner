import React, { useMemo, useRef, useState } from 'react'
import { getCourseRecommendations } from './api.jsx'

function timeOptions(startHour = 7, endHour = 21) {
  const opts = []
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour12 = ((h + 11) % 12) + 1
      const ampm = h < 12 ? 'AM' : 'PM'
      const label = `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      opts.push({ label, value })
    }
  }
  return opts
}

const PILL_OPTIONS = [
  { label: 'Early Morning (8:00–10:00 AM)', value: 'early_morning' },
  { label: 'Late Morning (10:00–12:00 PM)', value: 'late_morning' },
  { label: 'Lunch (12:00–2:00 PM)', value: 'lunch' },
  { label: 'Early Afternoon (2:00–4:00 PM)', value: 'early_afternoon' },
  { label: 'Late Afternoon (4:00–6:00 PM)', value: 'late_afternoon' },
  { label: 'Evening (6:00–8:00 PM)', value: 'evening' },
]

const WORKLOAD_OPTIONS = [
  { label: 'Challenging', value: 'challenging', helper: 'Lean into demanding courses.' },
  { label: 'Balanced', value: 'balanced', helper: 'Mix of tough + lighter.' },
  { label: 'Easier', value: 'easier', helper: 'Prefer lighter load.' },
]

const WEEK_PATTERN_OPTIONS = [
  { label: 'Heavier MWF', value: 'heavier_mwf', helper: 'Concentrate classes on Mon/Wed/Fri.' },
  { label: 'Balanced', value: 'balanced_days', helper: 'Spread evenly across the week.' },
  { label: 'Heavier TR', value: 'heavier_tr', helper: 'Concentrate classes on Tue/Thu.' },
]

export default function RecommendMe({ 
  knownProfessors = [],
  major = 'Computer Science',
  userEmail = null,
  plannedClasses = [],
  onAddToPlanner,  // NEW
  onReset  // Keep if you had it
}) {
  const [avoidProfessors, setAvoidProfessors] = useState([])
  const [profQuery, setProfQuery] = useState('')
  const [showProfPopover, setShowProfPopover] = useState(false)
  const inputRef = useRef(null)

  const [blockedSlots, setBlockedSlots] = useState(new Set())

  const [workload, setWorkload] = useState('balanced')
  const [weekPattern, setWeekPattern] = useState('balanced_days')

  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState(null)
  const [error, setError] = useState(null)

  const timeOpts = useMemo(() => timeOptions(7, 21), [])

  const filteredProfessors = useMemo(() => {
    const q = profQuery.trim().toLowerCase()
    if (!q) return []
    const base = knownProfessors.length > 0 ? knownProfessors : []
    return base
      .filter((p) => p.toLowerCase().includes(q))
      .slice(0, 8)
  }, [profQuery, knownProfessors])

  function addProfessorChip(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (avoidProfessors.length >= 8) return
    if (avoidProfessors.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return
    setAvoidProfessors((prev) => [...prev, trimmed])
    setProfQuery('')
    setShowProfPopover(false)
  }

  function handleProfKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addProfessorChip(profQuery)
    }
  }

  function removeProfessorChip(name) {
    setAvoidProfessors((prev) => prev.filter((p) => p !== name))
  }

  function togglePill(value) {
    setBlockedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function handleReset() {
    setAvoidProfessors([])
    setProfQuery('')
    setShowProfPopover(false)
    setBlockedSlots(new Set())
    setWorkload('balanced')
    setWeekPattern('balanced_days')
    if (onReset) onReset()
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    
    try {
      const payload = {
        avoidProfessors,
        blockedSlots: Array.from(blockedSlots),
        workload,
        weekPattern,
      }
      console.log(payload);
      
      const recs = await getCourseRecommendations(payload, major, userEmail, plannedClasses)
      setRecommendations(recs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const workloadHelper = WORKLOAD_OPTIONS.find((w) => w.value === workload)?.helper
  const weekPatternHelper = WEEK_PATTERN_OPTIONS.find((w) => w.value === weekPattern)?.helper

  if (recommendations) {
    return (
      <div style={{ padding: '20px' }}>
        <button onClick={handleReset} style={{ marginBottom: '20px' }}>← Back</button>
        <h2>Your Recommendations ({recommendations.length})</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          {recommendations.map((course, idx) => (
            <div key={course.id} style={{ border: '1px solid #ddd', padding: '16px', borderRadius: '8px' }}>
              <h3>#{idx + 1} {course.code} - {course.name}</h3>
              <p><strong>Match Score:</strong> {course.score}%</p>
              <ul>
                {course.recommendationReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {onAddToPlanner && (
                <button onClick={() => onAddToPlanner(course)}>+ Add to Planner</button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-content">
        <div className="grid-2 equal-rows">
          {/* Professors to avoid */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>Any professors you’d prefer to avoid?</h3>
            </div>
            <div className="chips-input">
              <div className="typeahead">
                <input
                  ref={inputRef}
                  type="text"
                  value={profQuery}
                  onChange={(e) => {
                    setProfQuery(e.target.value)
                    setShowProfPopover(true)
                  }}
                  onKeyDown={handleProfKeyDown}
                  onFocus={() => setShowProfPopover(true)}
                  placeholder={avoidProfessors.length === 0 ? 'Type a name (e.g., Jane Doe) and press Enter…' : 'Type to search…'}
                  disabled={avoidProfessors.length >= 8}
                />
                {avoidProfessors.length >= 8 && (
                  <div className="hint">Limit reached (8).</div>
                )}
                {showProfPopover && profQuery && filteredProfessors.length > 0 && (
                  <div className="popover">
                    {filteredProfessors.map((p) => (
                      <div key={p} className="popover-item" onMouseDown={() => addProfessorChip(p)}>
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="chips-row">
                {avoidProfessors.map((name) => (
                  <span key={name} className="chip">
                    {name}
                    <button aria-label={`Remove ${name}`} className="chip-x" onClick={() => removeProfessorChip(name)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Time blocks that don’t work */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>Time blocks that don’t work</h3>
              <p className="muted">Pick all that apply.</p>
            </div>
            <div className="pill-grid">
              {PILL_OPTIONS.map((opt) => {
                const selected = blockedSlots.has(opt.value)
                return (
                  <button
                    key={opt.value}
                    className={`pill ${selected ? 'pill-selected' : 'pill-outline'}`}
                    onClick={() => togglePill(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Workload difficulty */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>How intense should next semester be?</h3>
            </div>
            <div className="segmented">
              {WORKLOAD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`segment ${workload === opt.value ? 'segment-selected' : ''}`}
                  onClick={() => setWorkload(opt.value)}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: '6px' }}>{workloadHelper}</p>
          </section>

          {/* Week pattern preference */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>
                Preferred weekly rhythm
                <span className="info-tip" title="We’ll prioritize section meeting patterns that match this preference."> ⓘ</span>
              </h3>
              <p className="muted">Pick which days carry more of your load.</p>
            </div>
            <div className="segmented">
              {WEEK_PATTERN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`segment ${weekPattern === opt.value ? 'segment-selected' : ''}`}
                  onClick={() => setWeekPattern(opt.value)}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: '6px' }}>{weekPatternHelper}</p>
          </section>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="card-actions">
        <button className="button ghost" type="button" onClick={handleReset} disabled={loading}>Reset</button>
        <button
          className="button primary"
          type="button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Get Course Recommendations'}
        </button>
      </div>
    </div>
  )
}


