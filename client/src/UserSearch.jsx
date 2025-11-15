import React, { useState, useEffect } from 'react';
import { searchUsers, getUserPublicProfile } from './api.jsx';
import PlannerCalendar from './PlannerCalendar.jsx';
import './index.css';
import './colors.css';

function UserSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [yearFilter, setYearFilter] = useState('');
  const [majorFilter, setMajorFilter] = useState('');
  const [dormFilter, setDormFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Load all users on mount
  useEffect(() => {
    loadUsers();
  }, []);

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
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectUser = async (user) => {
    setLoading(true);
    setError('');

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
  }

  // Get unique values for dropdowns
  const uniqueYears = [...new Set(searchResults.map(u => u.year).filter(Boolean))];
  const uniqueMajors = [...new Set(searchResults.map(u => u.major).filter(Boolean))];
  const uniqueDorms = [...new Set(searchResults.map(u => u.dorm).filter(Boolean))];

  return (
    <div className="search-page">
      {!selectedUser ? (
        <>
          <div className="search-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: '600' }}>Find Students</h1>
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

          {/* Search and Filter Section */}
          <div style={{ 
            maxWidth: '900px', 
            margin: '0 auto 30px',
            padding: '20px',
            backgroundColor: 'var(--white)',
            borderRadius: '12px',
            border: '2px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Search Bar */}
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
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
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
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginLeft: '10px'
                }}
              >
                {showFilters ? 'Hide filters' : 'Show filters'}
              </button>
            </div>
            {/* Filters */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: showFilters ? '15px' : '0px'
            }}>
              {showFilters && (
                <div>
                    <div>
                        <label style={{ 
                        display: 'block', 
                        marginBottom: '6px', 
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'var(--text-secondary)'
                        }}>
                        Class Year
                        </label>
                        <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-medium)',
                            fontSize: '14px',
                            backgroundColor: 'var(--white)'
                        }}
                        >
                        <option value="">All Years</option>
                        <option value="Freshman">Freshman</option>
                        <option value="Sophomore">Sophomore</option>
                        <option value="Junior">Junior</option>
                        <option value="Senior">Senior</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ 
                        display: 'block', 
                        marginBottom: '6px', 
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'var(--text-secondary)'
                        }}>
                        Major
                        </label>
                        <input
                        type="text"
                        placeholder="Filter by major..."
                        value={majorFilter}
                        onChange={(e) => setMajorFilter(e.target.value)}
                        onKeyPress={handleKeyPress}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-medium)',
                            fontSize: '14px'
                        }}
                        />
                    </div>

                    <div>
                        <label style={{ 
                        display: 'block', 
                        marginBottom: '6px', 
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'var(--text-secondary)'
                        }}>
                        Dorm
                        </label>
                        <input
                        type="text"
                        placeholder="Filter by dorm..."
                        value={dormFilter}
                        onChange={(e) => setDormFilter(e.target.value)}
                        onKeyPress={handleKeyPress}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-medium)',
                            fontSize: '14px'
                        }}
                        />
                    </div>
                </div>
              )}
            </div>

            {/* Filter Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {showFilters && (
                <div>
                    <button
                        onClick={handleClearFilters}
                        style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--gray-100)',
                        color: 'var(--text-primary)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                        }}
                    >
                        Clear Filters
                    </button>
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--white)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                        }}
                    >
                        Apply Filters
                    </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{
              padding: '15px',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error)',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'center',
              maxWidth: '900px',
              margin: '0 auto 20px'
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                🔄 Loading users...
              </p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="results-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600',
                marginBottom: '20px',
                color: 'var(--text-primary)'
              }}>
                Students ({searchResults.length})
              </h2>
              <div className="user-results" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {searchResults.map((user) => (
                  <div 
                    key={user._id} 
                    className="user-card"
                    onClick={() => handleSelectUser(user)}
                    style={{
                      padding: '24px',
                      border: '2px solid var(--border-medium)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: 'var(--white)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-medium)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                        color: 'var(--white)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '26px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '19px', fontWeight: '600' }}>
                          {user.name}
                        </h3>
                        <p style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                          {user.email}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--gray-100)',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}>
                            {user.major}
                          </span>
                          <span style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--gray-100)',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500'
                          }}>
                            {user.year}
                          </span>
                          {user.dorm && (
                            <span style={{
                              padding: '6px 12px',
                              backgroundColor: 'var(--gray-100)',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '500'
                            }}>
                              🏠 {user.dorm}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '28px', color: 'var(--primary)', flexShrink: 0 }}>
                        →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={handleBack}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--primary)',
                color: 'var(--white)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ← Back to Search
            </button>
          </div>

          <div className="search-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: 'var(--white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 'bold'
              }}>
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 style={{ margin: 0 }}>{selectedUser.name}</h1>
                <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>{selectedUser.email}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              <span style={{
                padding: '6px 12px',
                backgroundColor: 'var(--gray-100)',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                📚 {selectedUser.major}
              </span>
              <span style={{
                padding: '6px 12px',
                backgroundColor: 'var(--gray-100)',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                🎓 {selectedUser.year}
              </span>
              {selectedUser.dorm && (
                <span style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--gray-100)',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}>
                  🏠 {selectedUser.dorm}
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <h2 style={{ 
              fontSize: '24px', 
              marginBottom: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              📅 {selectedUser.semesterPlan.semesterName || 'Semester Plan'}
              <span style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                fontWeight: 'normal'
              }}>
                ({selectedUser.semesterPlan.classes?.length || 0} classes)
              </span>
            </h2>

            {selectedUser.semesterPlan.classes && selectedUser.semesterPlan.classes.length > 0 ? (
              <>
                <div style={{
                  marginBottom: '20px',
                  padding: '15px',
                  backgroundColor: 'var(--background-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium)'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Classes:</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedUser.semesterPlan.classes.map((cls, index) => (
                      <div key={index} style={{
                        padding: '10px',
                        backgroundColor: 'var(--white)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-light)'
                      }}>
                        <strong>{cls.code}</strong> - {cls.name}
                        {cls.professors && cls.professors.length > 0 && (
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '10px' }}>
                            ({cls.professors.join(', ')})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <PlannerCalendar 
                  plannedClasses={selectedUser.semesterPlan.classes}
                  onRemoveClass={null}
                  readOnly={true}
                />
              </>
            ) : (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                backgroundColor: 'var(--background-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-medium)'
              }}>
                <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                  This user hasn't planned any classes yet
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default UserSearch;