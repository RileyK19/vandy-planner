import React, { useMemo, useRef, useState } from 'react'
import { getCourseRecommendations } from './api.jsx'

const PILL_OPTIONS = [
  { label: 'Early Morning (8:00–10:00 AM)', value: 'early_morning' },
  { label: 'Late Morning (10:00–12:00 PM)', value: 'late_morning' },
  { label: 'Lunch (12:00–2:00 PM)', value: 'lunch' },
  { label: 'Early Afternoon (2:00–4:00 PM)', value: 'early_afternoon' },
  { label: 'Late Afternoon (4:00–6:00 PM)', value: 'late_afternoon' },
  { label: 'Evening (6:00–8:00 PM)', value: 'evening' },
]

const WORKLOAD_OPTIONS = [
  { label: 'Challenging', value: 'challenging', helper: 'Lean into demanding courses (17+ credits/sem).' },
  { label: 'Balanced', value: 'balanced', helper: 'Standard load (~15 credits/sem).' },
  { label: 'Easier', value: 'easier', helper: 'Lighter load (~13 credits/sem).' },
]

const WEEK_PATTERN_OPTIONS = [
  { label: 'Heavier MWF', value: 'heavier_mwf', helper: 'Concentrate classes on Mon/Wed/Fri.' },
  { label: 'Balanced', value: 'balanced_days', helper: 'Spread evenly across the week.' },
  { label: 'Heavier TR', value: 'heavier_tr', helper: 'Concentrate classes on Tue/Thu.' },
]

export default function RecommendMeFourYear({ 
  knownProfessors = [],
  major = 'Computer Science',
  userEmail = null,
  plannedClasses = [],
  userYear = 'Freshman',
  onAddToPlanner,
  onBack
}) {
  const [avoidProfessors, setAvoidProfessors] = useState([])
  const [profQuery, setProfQuery] = useState('')
  const [showProfPopover, setShowProfPopover] = useState(false)
  const inputRef = useRef(null)

  const [blockedSlots, setBlockedSlots] = useState(new Set())
  const [workload, setWorkload] = useState('balanced')
  const [weekPattern, setWeekPattern] = useState('balanced_days')

  const [loading, setLoading] = useState(false)
  const [fourYearPlan, setFourYearPlan] = useState(null)
  const [error, setError] = useState(null)

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
    setFourYearPlan(null)
    setError(null)
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    
    try {
      const payload = {
        avoidProfessors,
        blockedSlots: Array.from(blockedSlots),
        workload,
        weekPattern,
        planType: 'four_year', // Signal to API that we want 4-year plan
        currentYear: userYear,
        startSemester: 'Fall',
        startYear: 2025
      }
      
      console.log('🎓 Requesting 4-year plan with payload:', payload)
      
      // Call getCourseRecommendations which will route to 4-year planner
      const plan = await getCourseRecommendations(payload, major, userEmail, plannedClasses)
      
      console.log('✅ Received 4-year plan:', plan)
      
      // Validate response structure
      if (!plan || !plan.semesters || !Array.isArray(plan.semesters)) {
        throw new Error('Invalid response from server: expected plan with semesters array')
      }
      
      setFourYearPlan(plan)
    } catch (err) {
      console.error('❌ Error generating 4-year plan:', err)
      setError(err.message || 'Failed to generate plan')
    } finally {
      setLoading(false)
    }
  }

  const workloadHelper = WORKLOAD_OPTIONS.find((w) => w.value === workload)?.helper
  const weekPatternHelper = WEEK_PATTERN_OPTIONS.find((w) => w.value === weekPattern)?.helper

  // Show generated plan
  if (fourYearPlan && fourYearPlan.semesters) {
    return (
      <div style={{ padding: '20px' }}>
        <button 
          onClick={() => setFourYearPlan(null)} 
          style={{ 
            marginBottom: '20px',
            padding: '8px 16px',
            cursor: 'pointer',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          ← Back to Preferences
        </button>
        
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '8px' }}>Your 4-Year Plan</h2>
          <p style={{ color: '#666', fontSize: '14px' }}>
            {fourYearPlan.totalCredits || 0} total credits across {fourYearPlan.semesters.length} semesters
          </p>
        </div>
        
        {/* GPT Overall Analysis */}
        {fourYearPlan.gptAnalysis && (
          <div style={{
            backgroundColor: '#f0f7ff',
            border: '2px solid #0066cc',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
              🤖 AI Analysis
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <strong>Overall Assessment:</strong>
              <p style={{ margin: '8px 0' }}>{fourYearPlan.gptAnalysis.overallAssessment}</p>
            </div>

            {fourYearPlan.gptAnalysis.strengths && fourYearPlan.gptAnalysis.strengths.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ color: '#0a8754' }}>✓ Strengths:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>
                  {fourYearPlan.gptAnalysis.strengths.map((s, i) => (
                    <li key={i} style={{ color: '#0a8754' }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {fourYearPlan.gptAnalysis.concerns && fourYearPlan.gptAnalysis.concerns.length > 0 && (
              <div>
                <strong style={{ color: '#856404' }}>⚠ Concerns:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>
                  {fourYearPlan.gptAnalysis.concerns.map((c, i) => (
                    <li key={i} style={{ color: '#856404' }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#fee', 
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#c33'
          }}>
            ⚠️ {error}
          </div>
        )}
        
        <div style={{ display: 'grid', gap: '24px' }}>
          {fourYearPlan.semesters.map((semester, idx) => (
            <div key={idx} style={{ 
              border: '2px solid #ddd', 
              padding: '20px', 
              borderRadius: '12px',
              backgroundColor: semester.courses.length === 0 ? '#f5f5f5' : (idx % 2 === 0 ? '#fafafa' : '#fff')
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                  {semester.name || `Semester ${idx + 1}`}
                  <span style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    fontWeight: 400,
                    marginLeft: '12px',
                    backgroundColor: '#e0e0e0',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    {semester.yearLabel || `Year ${semester.year}`}
                  </span>
                </h3>
                <span style={{ 
                  fontSize: '14px', 
                  color: '#666',
                  fontWeight: 500
                }}>
                  {semester.credits || 0} credits
                </span>
              </div>

              {/* GPT Semester Insight */}
              {semester.gptInsight && (
                <div style={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>💡 AI Insight:</strong> {semester.gptInsight.assessment}
                  </div>
                  {semester.gptInsight.recommendation && (
                    <div style={{ marginBottom: '8px', color: '#0066cc' }}>
                      <strong>Recommendation:</strong> {semester.gptInsight.recommendation}
                    </div>
                  )}
                  {semester.gptInsight.warning && (
                    <div style={{ color: '#856404' }}>
                      <strong>⚠️ Warning:</strong> {semester.gptInsight.warning}
                    </div>
                  )}
                </div>
              )}
              
              {semester.courses && semester.courses.length > 0 ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {semester.courses.map((course, courseIdx) => (
                    <div key={courseIdx} style={{ 
                      padding: '12px', 
                      backgroundColor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      transition: 'box-shadow 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                            {course.code} - {course.name}
                          </div>
                          
                          {course.professors && course.professors.length > 0 && (
                            <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
                              👤 {course.professors.join(', ')}
                            </div>
                          )}
                          
                          {course.schedule && course.schedule.days && (
                            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                              📅 {course.schedule.days.join('/')} • {course.schedule.startTime}-{course.schedule.endTime}
                            </div>
                          )}
                          
                          {course.prerequisiteInfo?.hasPrerequisites && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#856404',
                              marginTop: '8px',
                              padding: '6px 10px',
                              backgroundColor: '#fff3cd',
                              borderRadius: '4px',
                              display: 'inline-block'
                            }}>
                              📚 Prerequisites: {course.prerequisiteInfo.prerequisiteText}
                            </div>
                          )}

                          {/* Show GPT reasoning if available */}
                          {course.gptReasoning && (
                            <div style={{
                              fontSize: '12px',
                              color: '#0066cc',
                              marginTop: '8px',
                              fontStyle: 'italic'
                            }}>
                              💡 {course.gptReasoning}
                            </div>
                          )}
                        </div>
                        
                        {onAddToPlanner && (
                          <button 
                            onClick={() => onAddToPlanner(course)}
                            style={{ 
                              marginLeft: '12px', 
                              fontSize: '12px',
                              padding: '6px 12px',
                              whiteSpace: 'nowrap',
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#999',
                  fontStyle: 'italic'
                }}>
                  No courses scheduled for this semester
                </div>
              )}
            </div>
          ))}
        </div>

        {fourYearPlan.summary && (
          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            backgroundColor: '#f0f7ff',
            borderRadius: '8px'
          }}>
            <h4 style={{ marginBottom: '8px' }}>Plan Summary</h4>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Total Courses: {fourYearPlan.summary.totalCourses} • 
              Total Credits: {fourYearPlan.summary.totalCredits}
            </p>
          </div>
        )}
      </div>
    )
  }

  // Preferences form
  return (
    <div className="card">
      <div className="card-content">
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '8px' }}>Generate Your 4-Year Plan</h2>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Set your preferences and we'll create an optimized 8-semester course plan for your {userYear} year
          </p>
        </div>

        {error && (
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#fee', 
            borderRadius: '6px',
            marginBottom: '20px',
            color: '#c33'
          }}>
            ⚠️ {error}
          </div>
        )}

        <div className="grid-2 equal-rows">
          {/* Professors to avoid */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>Any professors you'd prefer to avoid?</h3>
              <p className="muted">These will be excluded from all semesters</p>
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
                  placeholder={avoidProfessors.length === 0 ? 'Type a name and press Enter…' : 'Type to search…'}
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

          {/* Time blocks */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>Time blocks that don't work</h3>
              <p className="muted">We'll avoid these times across all semesters</p>
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

          {/* Workload */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>Overall workload intensity</h3>
              <p className="muted">This affects credit hours per semester</p>
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

          {/* Week pattern */}
          <section className="section-group">
            <div className="section-title-row">
              <h3>Preferred weekly rhythm</h3>
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

      {/* Actions */}
      <div className="card-actions">
        <button 
          className="button ghost" 
          type="button" 
          onClick={handleReset} 
          disabled={loading}
        >
          Reset
        </button>
        <button
          className="button primary"
          type="button"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? 'Generating Plan...' : 'Generate 4-Year Plan'}
        </button>
      </div>
    </div>
  )
}