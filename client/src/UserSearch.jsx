import React, { useState } from 'react';
import { searchUsers, getUserPublicProfile } from './api.jsx';
import PlannerCalendar from './PlannerCalendar.jsx';
import './index.css';
import './colors.css';

function UserSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);
    setSelectedUser(null);

    try {
      const results = await searchUsers({ query: searchQuery });
      setSearchResults(results);
      
      if (results.length === 0) {
        setError('No users found');
      }
    } catch (err) {
      setError(err.message || 'Failed to search users');
    } finally {
      setLoading(false);
    }
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

          <div className="search-bar" style={{ 
            maxWidth: '800px', 
            margin: '0 auto 40px',
            display: 'flex',
            gap: '12px',
            alignItems: 'stretch'
          }}>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="search-input"
              style={{
                flex: 1,
                padding: '14px 20px',
                fontSize: '16px',
                border: '2px solid var(--border-medium)',
                borderRadius: '10px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-medium)'}
            />
            <button 
              onClick={handleSearch}
              className="search-button"
              disabled={loading || searchQuery.trim().length < 2}
              style={{
                padding: '0 28px',
                fontSize: '16px',
                fontWeight: '500',
                backgroundColor: loading || searchQuery.trim().length < 2 ? 'var(--gray-300)' : 'var(--primary)',
                color: 'var(--white)',
                border: 'none',
                borderRadius: '10px',
                cursor: loading || searchQuery.trim().length < 2 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!loading && searchQuery.trim().length >= 2) {
                  e.target.style.backgroundColor = 'var(--primary-hover)';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = loading || searchQuery.trim().length < 2 ? 'var(--gray-300)' : 'var(--primary)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              {loading ? '🔄 Searching...' : '🔍 Search'}
            </button>
          </div>

          {error && (
            <div style={{
              maxWidth: '600px',
              margin: '0 auto 30px',
              padding: '16px 20px',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error)',
              borderRadius: '10px',
              border: '1px solid var(--error-light)',
              textAlign: 'center',
              fontSize: '15px'
            }}>
              {error}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="results-section" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600',
                marginBottom: '20px',
                color: 'var(--text-primary)'
              }}>
                Search Results ({searchResults.length})
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
                              {user.dorm}
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
          )}
        </>
      ) : (
        <>
          <div style={{ marginBottom: '30px' }}>
            <button
              onClick={handleBack}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--primary)',
                color: 'var(--white)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'var(--primary-hover)';
                e.target.style.transform = 'translateX(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'var(--primary)';
                e.target.style.transform = 'translateX(0)';
              }}
            >
              ← Back to Search
            </button>
          </div>

          <div className="search-header" style={{
            padding: '30px',
            backgroundColor: 'var(--background-secondary)',
            borderRadius: '16px',
            border: '2px solid var(--border-light)',
            marginBottom: '30px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: 'var(--white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: 'bold',
                flexShrink: 0
              }}>
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '600' }}>
                  {selectedUser.name}
                </h1>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '16px' }}>
                  {selectedUser.email}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '8px 16px',
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                📚 {selectedUser.major}
              </span>
              <span style={{
                padding: '8px 16px',
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🎓 {selectedUser.year}
              </span>
              {selectedUser.dorm && (
                <span style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--white)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  🏠 {selectedUser.dorm}
                </span>
              )}
            </div>
          </div>

          <div>
            <h2 style={{ 
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              📅 {selectedUser.semesterPlan.semesterName || 'Semester Plan'}
              <span style={{
                fontSize: '15px',
                color: 'var(--text-secondary)',
                fontWeight: 'normal',
                padding: '4px 10px',
                backgroundColor: 'var(--gray-100)',
                borderRadius: '6px'
              }}>
                {selectedUser.semesterPlan.classes?.length || 0} classes
              </span>
            </h2>

            {selectedUser.semesterPlan.classes && selectedUser.semesterPlan.classes.length > 0 ? (
              <>
                <div style={{
                  marginBottom: '30px',
                  padding: '20px',
                  backgroundColor: 'var(--background-secondary)',
                  borderRadius: '12px',
                  border: '2px solid var(--border-light)'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Classes</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedUser.semesterPlan.classes.map((cls, index) => (
                      <div key={index} style={{
                        padding: '16px',
                        backgroundColor: 'var(--white)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-light)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{ fontSize: '15px' }}>
                          <strong style={{ color: 'var(--primary)' }}>{cls.code}</strong>
                          <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>•</span>
                          <span>{cls.name}</span>
                        </div>
                        {cls.professors && cls.professors.length > 0 && (
                          <div style={{ 
                            color: 'var(--text-secondary)', 
                            marginTop: '6px',
                            fontSize: '14px'
                          }}>
                            👤 {cls.professors.join(', ')}
                          </div>
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
                padding: '60px 40px',
                textAlign: 'center',
                backgroundColor: 'var(--background-secondary)',
                borderRadius: '12px',
                border: '2px dashed var(--border-medium)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                <p style={{ fontSize: '18px', color: 'var(--text-secondary)', margin: 0 }}>
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