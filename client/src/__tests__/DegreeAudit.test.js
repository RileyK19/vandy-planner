import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../api.jsx');

import DegreeAudit from '../DegreeAudit.jsx';
import * as api from '../api.jsx';

const mockDegreeData = {
  major: 'Computer Science',
  catalogYear: '2025',
  categories: [
    {
      name: 'Core Requirements',
      requiredHours: 6,
      description: 'Core CS classes.',
      availableClasses: [
        { code: 'CS 1101', hours: 3, required: true },
        { code: 'CS 2201', hours: 3, required: true }
      ],
      minCourses: null,
      moreClassesAvailable: false
    },
    {
      name: 'Open Electives',
      requiredHours: 3,
      description: 'Any approved elective course.',
      availableClasses: [],
      minCourses: 1,
      moreClassesAvailable: true
    }
  ]
};

describe('DegreeAudit', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('renders degree audit data after loading', async () => {
    api.fetchDegreeRequirements.mockResolvedValue(mockDegreeData);
    api.fetchUserTakenCourses.mockResolvedValue([{ courseCode: 'CS 1101', hours: 3 }]);

    render(
      <DegreeAudit
        plannedClasses={[{ code: 'CS 2201', name: 'Data Structures', hours: 3 }]}
        major="Computer Science"
        userEmail="student@example.com"
        semesterPlans={{}}
      />
    );

    expect(screen.getByText('Loading your degree requirements...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Degree Audit')).toBeInTheDocument();
    });

    expect(screen.getByText('Core Requirements')).toBeInTheDocument();
    expect(screen.getByText('Open Electives')).toBeInTheDocument();
    expect(screen.getByText('Overall Progress')).toBeInTheDocument();
  });

  test('shows fallback when degree requirements are unavailable', async () => {
    api.fetchDegreeRequirements.mockResolvedValue(null);
    api.fetchUserTakenCourses.mockResolvedValue([]);

    render(
      <DegreeAudit
        plannedClasses={[]}
        major="Mathematics"
        userEmail="student@example.com"
        semesterPlans={{}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Degree Requirements Not Available')).toBeInTheDocument();
    });

    expect(screen.getByText((content) => content.includes('Degree requirements for'))).toBeInTheDocument();
    expect(screen.getByText('Mathematics', { selector: 'strong' })).toBeInTheDocument();
  });

  test('handles fetch errors by showing fallback message', async () => {
    api.fetchDegreeRequirements.mockRejectedValue(new Error('Network error'));
    api.fetchUserTakenCourses.mockResolvedValue([]);

    render(
      <DegreeAudit
        plannedClasses={[]}
        major="Computer Science"
        userEmail="student@example.com"
        semesterPlans={{}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Degree Requirements Not Available')).toBeInTheDocument();
    });
  });
});
