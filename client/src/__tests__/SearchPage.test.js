import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../api.jsx');

import SearchPage from '../SearchPage.jsx';
import * as api from '../api.jsx';

const mockDegreeRequirements = {
  major: 'Computer Science',
  categories: [
    {
      name: 'Core Requirements',
      requiredHours: 6,
      description: 'Core courses',
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
      description: 'Electives',
      availableClasses: [],
      minCourses: 1,
      moreClassesAvailable: true
    }
  ]
};

describe('SearchPage', () => {
  const baseClasses = [
    {
      id: '1',
      code: 'CS 1101',
      name: 'Intro to Programming',
      subject: 'Computer Science',
      hours: 3,
      professors: ['Prof. Smith'],
      term: 'Fall 2024',
      schedule: {
        days: ['Monday', 'Wednesday'],
        startTime: '09:00',
        endTime: '10:15'
      }
    },
    {
      id: '2',
      code: 'MATH 1300',
      name: 'Calculus I',
      subject: 'Mathematics',
      hours: 4,
      professors: ['Prof. Taylor'],
      term: 'Fall 2024',
      schedule: {
        days: ['Tuesday', 'Thursday'],
        startTime: '11:00',
        endTime: '12:15'
      }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    api.fetchDegreeRequirements.mockResolvedValue(mockDegreeRequirements);
    api.getClassAverageRatings.mockReturnValue({ hasData: false });
    api.formatRating.mockReturnValue({ value: 'N/A', color: '#000' });
  });

  test('renders class list and allows adding to planner', async () => {
    const onAddToPlanner = jest.fn();

    render(
      <SearchPage
        allClasses={baseClasses}
        plannedClasses={[]}
        onAddToPlanner={onAddToPlanner}
        usingMockData={false}
        onRefreshData={jest.fn()}
        semesterPlans={{}}
        onAddToSemester={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(api.fetchDegreeRequirements).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByText('+ Add')[0]);

    expect(onAddToPlanner).toHaveBeenCalledWith(baseClasses[0]);
  });

  test('shows conflict indicator for overlapping classes', async () => {
    render(
      <SearchPage
        allClasses={baseClasses}
        plannedClasses={[{
          id: 'planned-1',
          code: 'CS 2100',
          name: 'Algorithms',
          schedule: {
            days: ['Monday', 'Wednesday'],
            startTime: '09:30',
            endTime: '10:45'
          }
        }]}
        onAddToPlanner={jest.fn()}
        usingMockData={false}
        onRefreshData={jest.fn()}
        semesterPlans={{}}
        onAddToSemester={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(api.fetchDegreeRequirements).toHaveBeenCalled();
    });

    expect(screen.getAllByText('⚠️').length).toBeGreaterThan(0);
  });

  test('filters classes by degree category', async () => {
    render(
      <SearchPage
        allClasses={baseClasses}
        plannedClasses={[]}
        onAddToPlanner={jest.fn()}
        usingMockData={false}
        onRefreshData={jest.fn()}
        semesterPlans={{}}
        onAddToSemester={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(api.fetchDegreeRequirements).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    await waitFor(() => {
      expect(screen.getByText('Degree Category')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Core Requirements'));
    fireEvent.click(screen.getByText('Apply Filters'));

    await waitFor(() => {
      expect(
        screen.getByText((content) => content.includes('Intro to Programming'))
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText((content) => content.includes('Calculus I'))
    ).not.toBeInTheDocument();
  });
});
