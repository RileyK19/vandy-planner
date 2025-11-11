import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../api.jsx');

import PlannerCalendar from '../PlannerCalendar.jsx';
import * as api from '../api.jsx';

describe('PlannerCalendar', () => {
  const sampleClass = {
    id: '1',
    code: 'CS 1101',
    name: 'Intro to Programming',
    hours: 3,
    schedule: {
      days: ['Monday', 'Wednesday'],
      startTime: '09:00',
      endTime: '10:15'
    },
    professors: ['Prof. Smith']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('displays message when no classes are planned', () => {
    render(
      <PlannerCalendar
        plannedClasses={[]}
        onRemoveClass={jest.fn()}
        onSavePlan={jest.fn()}
      />
    );

    expect(screen.getByText('No classes planned yet. Add some from the search!')).toBeInTheDocument();
  });

  test('renders planned classes and handles removal', () => {
    const onRemoveClass = jest.fn();

    render(
      <PlannerCalendar
        plannedClasses={[sampleClass]}
        onRemoveClass={onRemoveClass}
        onSavePlan={jest.fn()}
      />
    );

    expect(screen.getByText('My Planner - 3 Credit Hours')).toBeInTheDocument();
    expect(screen.getByText('Planned Classes:')).toBeInTheDocument();
    expect(screen.getByText(/Intro to Programming/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove'));
    expect(onRemoveClass).toHaveBeenCalledWith('1');
  });

  test('submits planner and shows success message', async () => {
    api.saveSemesterPlanner.mockResolvedValueOnce({});

    render(
      <PlannerCalendar
        plannedClasses={[sampleClass]}
        onRemoveClass={jest.fn()}
        onSavePlan={jest.fn()}
      />
    );

    // Clear any auto-save calls before manual submission
    jest.runOnlyPendingTimers();
    api.saveSemesterPlanner.mockClear();

    fireEvent.click(screen.getByText('💾 Submit Plan to Database'));

    await waitFor(() => {
      expect(api.saveSemesterPlanner).toHaveBeenCalledWith('Fall 2025', [sampleClass]);
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Plan saved successfully!')).toBeInTheDocument();
    });
  });

  test('shows error message when submission fails', async () => {
    api.saveSemesterPlanner.mockRejectedValue(new Error('Network error'));

    render(
      <PlannerCalendar
        plannedClasses={[sampleClass]}
        onRemoveClass={jest.fn()}
        onSavePlan={jest.fn()}
      />
    );

    jest.runOnlyPendingTimers();
    api.saveSemesterPlanner.mockClear();
    api.saveSemesterPlanner.mockRejectedValue(new Error('Network error'));

    fireEvent.click(screen.getByText('💾 Submit Plan to Database'));

    await waitFor(() => {
      expect(api.saveSemesterPlanner).toHaveBeenCalledWith('Fall 2025', [sampleClass]);
    });

    expect(await screen.findByText('❌ Failed to save plan')).toBeInTheDocument();
  });

  test('auto-saves planner when classes change', async () => {
    api.saveSemesterPlanner.mockResolvedValue({});

    const { rerender } = render(
      <PlannerCalendar
        plannedClasses={[]}
        onRemoveClass={jest.fn()}
        onSavePlan={jest.fn()}
      />
    );

    rerender(
      <PlannerCalendar
        plannedClasses={[sampleClass]}
        onRemoveClass={jest.fn()}
        onSavePlan={jest.fn()}
      />
    );

    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(api.saveSemesterPlanner).toHaveBeenCalledWith('Fall 2025', [sampleClass]);
    });
  });

  test('renders course blocks with correct positioning', () => {
    const classWithAMPM = {
      ...sampleClass,
      id: '2',
      schedule: {
        days: ['Tuesday'],
        startTime: '9:30AM',
        endTime: '11:00AM'
      }
    };

    render(
      <PlannerCalendar
        plannedClasses={[classWithAMPM]}
        onRemoveClass={jest.fn()}
        onSavePlan={jest.fn()}
      />
    );

    const dayColumn = screen.getByText('Tuesday').parentElement?.parentElement;
    const block = dayColumn?.querySelector('[title^="CS 1101"]');

    expect(block).toBeInTheDocument();
    const style = block && window.getComputedStyle(block);
    expect(style?.top).toBe('90px');
    expect(style?.height).toBe('90px');
  });
});
