import React, { useState, useEffect } from 'react';
import { 
  searchUsers, 
  getUserPublicProfile, 
  getUserProfile,
  adminDeleteUser,
  adminToggleSuperUser
} from './api.jsx';
import PlannerCalendar from './PlannerCalendar.jsx';
import './index.css';
import './colors.css';

function UserSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSuperUser, setIsSuperUser] = useState(false);

  // Filter states
  const [yearFilter, setYearFilter] = useState('');
  const [majorFilter, setMajorFilter] = useState('');
  const [dormFilter, setDormFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Check if current user is superuser
  useEffect(() => {
    checkSuperUserStatus();
  }, []);

  useEffect(() => {
    loadUsers();
  }, []);

  const checkSuperUserStatus = async () => {
    try {
      const profile = await getUserProfile();
      setIsSuperUser(profile.isSuperUser === true);
    } catch (err) {
      console.error("Unable to load profile", err);
    }
  };

  const loadUsers = async (filters = {}) => {
    setLoading(true);
    setError('');

    try {
      const results = await searchUsers(filters);
      setSearchResults(results);

      if (results.length === 0) {
        setError('No users found');
      }
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const filters = {};
    if (searchQuery.trim().length >= 2) filters.query = searchQuery;
    if (yearFilter) filters.year = yearFilter;
    if (majorFilter) filters.major = majorFilter;
    if (dormFilter) filters.dorm = dormFilter;
    loadUsers(filters);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setYearFilter('');
    setMajorFilter('');
    setDormFilter('');
    loadUsers();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSelectUser = async (user) => {
    setLoading(true);
    try {
      const publicProfile = await getUserPublicProfile(user._id);
      setSelectedUser(publicProfile);
    } catch (err) {
      setError(err.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedUser(null);
  };

  const handleSetShowFilters = () => {
    setShowFilters(!showFilters);
  };

  // --- ADMIN FUNCTIONS ---
  const handleDeleteUser = async (userId, userName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${userName}? This cannot be undone.`)) return;

    try {
      await adminDeleteUser(userId);
      setSearchResults(prev => prev.filter(u => u._id !== userId));
      if (selectedUser && selectedUser._id === userId) setSelectedUser(null);
      alert(`Deleted ${userName}`);
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleToggleSuperUser = async (userId, userName, currentStatus, e) => {
    e.stopPropagation();
    const action = currentStatus ? "remove admin access from" : "grant admin access to";

    if (!window.confirm(`Are you sure you want to ${action} ${userName}?`)) return;

    try {
      await adminToggleSuperUser(userId, !currentStatus);
      setSearchResults(prev => prev.map(u =>
        u._id === userId ? { ...u, isSuperUser: !currentStatus } : u
      ));
      if (selectedUser && selectedUser._id === userId)
        setSelectedUser(prev => ({ ...prev, isSuperUser: !currentStatus }));
      alert(`Successfully updated ${userName}`);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  };

  // --- RENDER ---
  return (
    <div className="search-page">
      {!selectedUser ? (
        <>
          <div className="search-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: '600' }}>
              Find Students
              {isSuperUser && (
                <span style={{
                  marginLeft: '12px',
                  fontSize: '16px',
                  padding: '4px 12px',
                  backgroundColor: 'var(--warning)',
                  color: 'var(--white)',
                  borderRadius: '6px'
                }}>
                  Admin Mode
                </span>
              )}
            </h1>
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '16px',
              margin: 0,
              maxWidth: '500px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              Search for other students and explore their semester schedules
            </p>
          </div>

          {/* SEARCH + FILTER BOX (unchanged styling from FIRST) */}
          <div style={{
            maxWidth: '900px',
            margin: '0 auto 30px',
            padding: '20px',
            backgroundColor: 'var(--white)',
            borderRadius: '12px',
            border: '2px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div className="search-bar" style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="search-input"
              />
              <button 
                onClick={handleSearch}
                className="search-button"
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--primary)',
                  color: 'var(--white)',
                  borderRadius: '6px'
                }}
              >
                {loading ? '🔄' : '🔍'} Search
              </button>

              <button 
                onClick={handleSetShowFilters}
                className="filter-button"
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--gray-100)',
                  borderRadius: '6px',
                  marginLeft: '10px'
                }}
              >
                {showFilters ? 'Hide filters' : 'Show filters'}
              </button>
            </div>

            {showFilters && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px',
                  marginBottom: '15px'
                }}>
                  {/* Filters exactly as FIRST file */}
                  <div>
                    <label>Class Year</label>
                    <select value={yearFilter} onChange={(e)=>setYearFilter(e.target.value)}>
                      <option value="">All Years</option>
                      <option value="Freshman">Freshman</option>
                      <option value="Sophomore">Sophomore</option>
                      <option value="Junior">Junior</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>

                  <div>
                    <label>Major</label>
                    <input type="text" value={majorFilter} onChange={(e)=>setMajorFilter(e.target.value)} />
                  </div>

                  <div>
                    <label>Dorm</label>
                    <input type="text" value={dormFilter} onChange={(e)=>setDormFilter(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button onClick={handleClearFilters} style={{ backgroundColor: 'var(--gray-100)' }}>
                    Clear Filters
                  </button>
                  <button onClick={handleSearch} style={{ backgroundColor: 'var(--primary)', color:'white' }}>
                    Apply Filters
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ERROR */}
          {error && (
            <div style={{
              padding: '15px',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error)',
              borderRadius: '8px',
              marginBottom: '20px',
              maxWidth: '900px',
              margin: '0 auto 20px'
            }}>
              {error}
            </div>
          )}

          {/* RESULTS */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>🔄 Loading users...</p>
            </div>
          ) : (
            searchResults.length > 0 && (
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>
                  Students ({searchResults.length})
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {searchResults.map((user) => (
                    <div
                      key={user._id}
                      className="user-card"
                      onClick={() => handleSelectUser(user)}
                      style={{
                        padding: '24px',
                        border: '2px solid var(--border-medium)',
                        borderRadius: '12px',
                        backgroundColor: 'white',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: '0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '26px',
                          fontWeight: 'bold'
                        }}>
                          {user.name.charAt(0)}
                        </div>

                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: 0 }}>{user.name}</h3>
                          <p style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>{user.email}</p>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <span className="tag">{user.major}</span>
                            <span className="tag">{user.year}</span>
                            {user.dorm && <span className="tag">🏠 {user.dorm}</span>}
                            {user.isSuperUser && (
                              <span style={{
                                padding: '4px 8px',
                                backgroundColor: 'var(--warning)',
                                color: 'white',
                                borderRadius: '6px',
                                fontSize: '11px'
                              }}>ADMIN</span>
                            )}
                          </div>
                        </div>

                        {/* ADMIN ACTIONS */}
                        {isSuperUser ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                            <button
                              onClick={(e) => handleToggleSuperUser(user._id, user.name, user.isSuperUser, e)}
                              style={{
                                padding:'6px 10px',
                                backgroundColor: user.isSuperUser ? 'var(--gray-400)' : 'var(--info)',
                                color:'white',
                                borderRadius:'6px',
                                fontSize:'12px'
                              }}
                            >
                              {user.isSuperUser ? "Remove Admin" : "Make Admin"}
                            </button>

                            <button
                              onClick={(e) => handleDeleteUser(user._id, user.name, e)}
                              style={{
                                padding:'6px 10px',
                                backgroundColor:'var(--error)',
                                color:'white',
                                borderRadius:'6px',
                                fontSize:'12px'
                              }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '28px', color: 'var(--primary)' }}>→</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )
          )}
        </>
      ) : (
        /* USER PROFILE PAGE (unchanged from FIRST) */
        <>
          <button onClick={handleBack} style={{
            padding:'10px 20px',
            backgroundColor:'var(--primary)',
            color:'white',
            borderRadius:'6px',
            marginBottom:'20px'
          }}>
            ← Back to Search
          </button>

          <div className="search-header">
            <div style={{ display:'flex', alignItems:'center', gap:'15px' }}>
              <div style={{
                width:'60px', height:'60px',
                borderRadius:'50%', backgroundColor:'var(--primary)',
                color:'white', display:'flex', justifyContent:'center', alignItems:'center'
              }}>
                {selectedUser.name.charAt(0)}
              </div>
              <div>
                <h1>{selectedUser.name}</h1>
                <p>{selectedUser.email}</p>
              </div>
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <span className="tag">📚 {selectedUser.major}</span>
              <span className="tag">🎓 {selectedUser.year}</span>
              {selectedUser.dorm && <span className="tag">🏠 {selectedUser.dorm}</span>}
              {selectedUser.isSuperUser && (
                <span className="tag" style={{ background:'var(--warning)', color:'white' }}>
                  ADMIN
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop:'30px' }}>
            <h2>
              📅 {selectedUser.semesterPlan.semesterName}
              <span style={{ fontSize:'14px', color:'gray', marginLeft:'8px' }}>
                ({selectedUser.semesterPlan.classes?.length || 0} classes)
              </span>
            </h2>

            {selectedUser.semesterPlan.classes?.length > 0 ? (
              <>
                <div style={{ marginBottom:'20px' }}>
                  <h3>Classes:</h3>
                  {selectedUser.semesterPlan.classes.map((cls, i) => (
                    <div key={i} style={{
                      padding:'10px',
                      background:'white',
                      border:'1px solid var(--border-light)',
                      borderRadius:'6px',
                      marginBottom:'8px'
                    }}>
                      <strong>{cls.code}</strong> - {cls.name}
                    </div>
                  ))}
                </div>

                <PlannerCalendar
                  readOnly={true}
                  plannedClasses={selectedUser.semesterPlan.classes}
                />
              </>
            ) : (
              <p style={{ color:'gray', marginTop:'20px' }}>
                This user hasn't planned any classes yet.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default UserSearch;
