import React, { createContext, useContext, useState, useEffect } from 'react';

const RecommendationsContext = createContext();

export function RecommendationsProvider({ children }) {
  // Check if this is a fresh page load (not a navigation within the app)
  const isPageReload = !sessionStorage.getItem('appLoaded');
  
  const [recommendations, setRecommendations] = useState(() => {
    // Clear on page reload, keep on navigation
    if (isPageReload) {
      sessionStorage.removeItem('courseRecommendations');
      sessionStorage.removeItem('recommendationMetadata');
      return null;
    }
    
    // Load from sessionStorage on navigation within app
    const saved = sessionStorage.getItem('courseRecommendations');
    return saved ? JSON.parse(saved) : null;
  });

  const [recommendationMetadata, setRecommendationMetadata] = useState(() => {
    if (isPageReload) {
      return null;
    }
    const saved = sessionStorage.getItem('recommendationMetadata');
    return saved ? JSON.parse(saved) : null;
  });

  // Mark that app has loaded (prevents clearing on navigation)
  useEffect(() => {
    sessionStorage.setItem('appLoaded', 'true');
    
    // Clear the flag when user actually closes the tab/browser
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('appLoaded');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Save to sessionStorage whenever recommendations change
  useEffect(() => {
    if (recommendations) {
      sessionStorage.setItem('courseRecommendations', JSON.stringify(recommendations));
    } else {
      sessionStorage.removeItem('courseRecommendations');
    }
  }, [recommendations]);

  useEffect(() => {
    if (recommendationMetadata) {
      sessionStorage.setItem('recommendationMetadata', JSON.stringify(recommendationMetadata));
    } else {
      sessionStorage.removeItem('recommendationMetadata');
    }
  }, [recommendationMetadata]);

  const saveRecommendations = (recs, metadata = {}) => {
    // Validate that recs is an array
    if (!Array.isArray(recs)) {
      console.error('saveRecommendations called with non-array:', recs);
      return;
    }
    
    setRecommendations(recs);
    setRecommendationMetadata({
      ...metadata,
      timestamp: Date.now()
    });
  };

  const clearRecommendations = () => {
    setRecommendations(null);
    setRecommendationMetadata(null);
    sessionStorage.removeItem('courseRecommendations');
    sessionStorage.removeItem('recommendationMetadata');
  };

  return (
    <RecommendationsContext.Provider
      value={{
        recommendations,
        recommendationMetadata,
        saveRecommendations,
        clearRecommendations
      }}
    >
      {children}
    </RecommendationsContext.Provider>
  );
}

export function useRecommendations() {
  const context = useContext(RecommendationsContext);
  if (!context) {
    throw new Error('useRecommendations must be used within RecommendationsProvider');
  }
  return context;
}