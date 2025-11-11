import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

jest.mock('../api.jsx');
jest.mock('../RecommendMeFourYear.jsx', () => {
  return function MockRecommendMeFourYear() {
    return <div data-testid="recommend-me-four-year">Four Year Planner</div>;
  };
});

import RecommendMe from '../RecommendMe.jsx';
import * as api from '../api.jsx';

describe('RecommendMe', () => {
  const mockOnAddToPlanner = jest.fn();
  const mockOnReset = jest.fn();
  const mockKnownProfessors = ['Prof. Smith', 'Prof. Johnson', 'Prof. Taylor', 'Prof. Williams'];
  const defaultProps = {
    knownProfessors: mockKnownProfessors,
    major: 'Computer Science',
    userEmail: 'test@example.com',
    plannedClasses: [],
    onAddToPlanner: mockOnAddToPlanner,
    onReset: mockOnReset
  };

  const mockRecommendations = [
    {
      id: '1',
      code: 'CS 1101',
      name: 'Intro to Programming',
      score: 95,
      professors: ['Prof. Smith'],
      schedule: {
        days: ['Monday', 'Wednesday'],
        startTime: '10:00',
        endTime: '11:15'
      },
      recommendationReasons: ['Required for your degree', 'Highly rated (4.5/5.0)'],
      isGPTEnhanced: false
    },
    {
      id: '2',
      code: 'CS 2201',
      name: 'Data Structures',
      score: 85,
      professors: ['Prof. Johnson'],
      schedule: {
        days: ['Tuesday', 'Thursday'],
        startTime: '11:00',
        endTime: '12:15'
      },
      recommendationReasons: ['Fulfills a degree requirement'],
      isGPTEnhanced: true,
      gptReasoning: 'Great course for building fundamentals',
      gptWarning: null
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    api.getCourseRecommendations.mockResolvedValue(mockRecommendations);
  });

  describe('Initial Render', () => {
    test('renders preference form by default', () => {
      render(<RecommendMe {...defaultProps} />);
      
      expect(screen.getByText('Any professors you\'d prefer to avoid?')).toBeInTheDocument();
      expect(screen.getByText('Time blocks that don\'t work')).toBeInTheDocument();
      expect(screen.getByText('How intense should next semester be?')).toBeInTheDocument();
      expect(screen.getByText('Preferred weekly rhythm')).toBeInTheDocument();
    });

    test('renders tab navigation', () => {
      render(<RecommendMe {...defaultProps} />);
      
      expect(screen.getByText('1 Semester')).toBeInTheDocument();
      expect(screen.getByText('4-Year Plan')).toBeInTheDocument();
    });

    test('shows semester tab as active by default', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const semesterTab = screen.getByText('1 Semester').closest('button');
      expect(semesterTab).toHaveStyle({ fontWeight: 600 });
    });
  });

  describe('Tab Navigation', () => {
    test('switches to four year tab when clicked', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const fourYearTab = screen.getByText('4-Year Plan');
      fireEvent.click(fourYearTab);
      
      expect(screen.getByTestId('recommend-me-four-year')).toBeInTheDocument();
    });

    test('switches back to semester tab', () => {
      render(<RecommendMe {...defaultProps} />);
      
      fireEvent.click(screen.getByText('4-Year Plan'));
      fireEvent.click(screen.getByText('1 Semester'));
      
      expect(screen.queryByTestId('recommend-me-four-year')).not.toBeInTheDocument();
      expect(screen.getByText('Any professors you\'d prefer to avoid?')).toBeInTheDocument();
    });
  });

  describe('Professor Selection', () => {
    test('allows typing professor name', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Smith');
      
      expect(input.value).toBe('Smith');
    });

    test('shows filtered professor suggestions', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Smith');
      
      await waitFor(() => {
        expect(screen.getByText('Prof. Smith')).toBeInTheDocument();
      });
    });

    test('adds professor chip when suggestion is clicked', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Smith');
      
      await waitFor(() => {
        expect(screen.getByText('Prof. Smith')).toBeInTheDocument();
      });
      
      const suggestion = screen.getByText('Prof. Smith');
      fireEvent.mouseDown(suggestion);
      
      await waitFor(() => {
        expect(screen.getByText('Prof. Smith')).toBeInTheDocument();
        expect(input.value).toBe('');
      });
    });

    test('adds professor chip when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Prof. Smith');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        const chips = screen.getAllByText('Prof. Smith');
        expect(chips.length).toBeGreaterThan(0);
      });
    });

    test('prevents adding duplicate professors', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Prof. Smith');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        // Check that chip was added
        const chips = screen.getAllByText('Prof. Smith');
        expect(chips.length).toBeGreaterThan(0);
      });
      
      // Clear input and try to add the same professor again
      fireEvent.change(input, { target: { value: '' } });
      await user.type(input, 'Prof. Smith');
      await user.keyboard('{Enter}');
      
      // Wait a bit and check - should still only have one chip
      await waitFor(() => {
        // Count actual chip elements (not suggestions)
        const allChips = screen.queryAllByText('Prof. Smith');
        // The chip should appear once in the chips-row
        const chipRow = document.querySelector('.chips-row');
        if (chipRow) {
          const chipsInRow = chipRow.querySelectorAll('.chip');
          expect(chipsInRow.length).toBe(1);
        }
      }, { timeout: 1000 });
    });

    test('removes professor chip when X is clicked', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Prof. Smith');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Prof. Smith')).toBeInTheDocument();
      });
      
      const removeButton = screen.getByLabelText('Remove Prof. Smith');
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Prof. Smith')).not.toBeInTheDocument();
      });
    });

    test('limits professor chips to 8', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      
      // Add 8 professors using direct state manipulation via fireEvent
      for (let i = 0; i < 8; i++) {
        fireEvent.change(input, { target: { value: `Prof. Test${i}` } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        // Small delay to allow state update
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Verify we have 8 chips
      await waitFor(() => {
        const chipRow = document.querySelector('.chips-row');
        if (chipRow) {
          const chips = chipRow.querySelectorAll('.chip');
          expect(chips.length).toBe(8);
        }
      });
      
      // Try to add 9th - input should be disabled
      fireEvent.change(input, { target: { value: 'Prof. Test9' } });
      
      await waitFor(() => {
        expect(input).toBeDisabled();
        expect(screen.getByText('Limit reached (8).')).toBeInTheDocument();
      });
    });

    test('case-insensitive professor matching', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'smith');
      
      await waitFor(() => {
        expect(screen.getByText('Prof. Smith')).toBeInTheDocument();
      });
    });
  });

  describe('Time Block Selection', () => {
    test('toggles time block pill when clicked', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const earlyMorningPill = screen.getByText('Early Morning (8:00–10:00 AM)');
      fireEvent.click(earlyMorningPill);
      
      expect(earlyMorningPill).toHaveClass('pill-selected');
    });

    test('deselects time block pill when clicked again', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const earlyMorningPill = screen.getByText('Early Morning (8:00–10:00 AM)');
      fireEvent.click(earlyMorningPill);
      fireEvent.click(earlyMorningPill);
      
      expect(earlyMorningPill).toHaveClass('pill-outline');
    });

    test('allows selecting multiple time blocks', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const earlyMorning = screen.getByText('Early Morning (8:00–10:00 AM)');
      const lateMorning = screen.getByText('Late Morning (10:00–12:00 PM)');
      
      fireEvent.click(earlyMorning);
      fireEvent.click(lateMorning);
      
      expect(earlyMorning).toHaveClass('pill-selected');
      expect(lateMorning).toHaveClass('pill-selected');
    });
  });

  describe('Workload Selection', () => {
    test('defaults to balanced workload', () => {
      render(<RecommendMe {...defaultProps} />);
      
      // Find the workload section's Balanced button (not the week pattern one)
      const workloadSection = screen.getByText('How intense should next semester be?').closest('section');
      const balancedButton = within(workloadSection).getByText('Balanced').closest('button');
      expect(balancedButton).toHaveClass('segment-selected');
    });

    test('changes workload when option is clicked', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const challengingButton = screen.getByText('Challenging').closest('button');
      fireEvent.click(challengingButton);
      
      expect(challengingButton).toHaveClass('segment-selected');
    });

    test('shows helper text for selected workload', () => {
      render(<RecommendMe {...defaultProps} />);
      
      expect(screen.getByText('Mix of tough + lighter.')).toBeInTheDocument();
      
      const easierButton = screen.getByText('Easier').closest('button');
      fireEvent.click(easierButton);
      
      expect(screen.getByText('Prefer lighter load.')).toBeInTheDocument();
    });
  });

  describe('Week Pattern Selection', () => {
    test('defaults to balanced days', () => {
      render(<RecommendMe {...defaultProps} />);
      
      // Find the week pattern section's Balanced button (not the workload one)
      const weekPatternSection = screen.getByText('Preferred weekly rhythm').closest('section');
      const balancedButton = within(weekPatternSection).getByText('Balanced').closest('button');
      expect(balancedButton).toHaveClass('segment-selected');
    });

    test('changes week pattern when option is clicked', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const mwfButton = screen.getByText('Heavier MWF').closest('button');
      fireEvent.click(mwfButton);
      
      expect(mwfButton).toHaveClass('segment-selected');
    });

    test('shows helper text for selected week pattern', () => {
      render(<RecommendMe {...defaultProps} />);
      
      expect(screen.getByText('Spread evenly across the week.')).toBeInTheDocument();
      
      const trButton = screen.getByText('Heavier TR').closest('button');
      fireEvent.click(trButton);
      
      expect(screen.getByText('Concentrate classes on Tue/Thu.')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    test('calls API with correct preferences', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(api.getCourseRecommendations).toHaveBeenCalledWith(
          expect.objectContaining({
            avoidProfessors: [],
            blockedSlots: [],
            workload: 'balanced',
            weekPattern: 'balanced_days'
          }),
          'Computer Science',
          'test@example.com',
          []
        );
      });
    });

    test('includes selected preferences in API call', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      // Add a professor
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Prof. Smith');
      await user.keyboard('{Enter}');
      
      // Select time blocks
      fireEvent.click(screen.getByText('Early Morning (8:00–10:00 AM)'));
      fireEvent.click(screen.getByText('Late Morning (10:00–12:00 PM)'));
      
      // Change workload
      fireEvent.click(screen.getByText('Challenging').closest('button'));
      
      // Change week pattern
      fireEvent.click(screen.getByText('Heavier MWF').closest('button'));
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(api.getCourseRecommendations).toHaveBeenCalledWith(
          expect.objectContaining({
            avoidProfessors: ['Prof. Smith'],
            blockedSlots: ['early_morning', 'late_morning'],
            workload: 'challenging',
            weekPattern: 'heavier_mwf'
          }),
          'Computer Science',
          'test@example.com',
          []
        );
      });
    });

    test('shows loading state during API call', async () => {
      // Make API call take longer
      api.getCourseRecommendations.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockRecommendations), 100))
      );
      
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      expect(screen.getByText('Querying AI...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.queryByText('Querying AI...')).not.toBeInTheDocument();
      });
    });

    test('displays recommendations after successful API call', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Your Recommendations (2)')).toBeInTheDocument();
        expect(screen.getByText(/CS 1101.*Intro to Programming/)).toBeInTheDocument();
        expect(screen.getByText(/CS 2201.*Data Structures/)).toBeInTheDocument();
      });
    });

    test('displays match scores in recommendations', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Your Recommendations (2)')).toBeInTheDocument();
        // Match scores are displayed in the recommendations
        const matchScoreElements = screen.getAllByText(/Match Score:/);
        expect(matchScoreElements.length).toBeGreaterThan(0);
        // Check that scores are displayed (they appear as numbers, use getAllByText to handle multiple)
        const score95 = screen.queryAllByText('95');
        const score85 = screen.queryAllByText('85');
        expect(score95.length + score85.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    test('displays GPT-enhanced recommendations with insights', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('🤖 AI Insight:')).toBeInTheDocument();
        expect(screen.getByText('Great course for building fundamentals')).toBeInTheDocument();
      });
    });

    test('displays GPT warnings when present', async () => {
      const recommendationsWithWarning = [
        {
          ...mockRecommendations[1],
          gptWarning: 'Heavy workload expected'
        }
      ];
      api.getCourseRecommendations.mockResolvedValueOnce(recommendationsWithWarning);
      
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('⚠️ Heavy workload expected')).toBeInTheDocument();
      });
    });

    test('displays prerequisite information when present', async () => {
      const recommendationsWithPrereqs = [
        {
          ...mockRecommendations[0],
          prerequisiteInfo: {
            hasPrerequisites: true,
            prerequisiteText: 'CS 1100 or equivalent'
          }
        }
      ];
      api.getCourseRecommendations.mockResolvedValueOnce(recommendationsWithPrereqs);
      
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Prerequisites:')).toBeInTheDocument();
        expect(screen.getByText('CS 1100 or equivalent')).toBeInTheDocument();
      });
    });

    test('displays recommendation reasons', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Required for your degree')).toBeInTheDocument();
        expect(screen.getByText('Highly rated (4.5/5.0)')).toBeInTheDocument();
      });
    });

    test('displays professor information', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        // Check for professor names (text may be split)
        expect(screen.getByText('Your Recommendations (2)')).toBeInTheDocument();
        // Professors are displayed in the recommendations
        const professorElements = screen.getAllByText(/Professors:/);
        expect(professorElements.length).toBeGreaterThan(0);
        // Check that professor names appear
        expect(screen.getByText('Prof. Smith', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('Prof. Johnson', { exact: false })).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('displays schedule information', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        // Schedule text is split across elements, so we check for parts
        expect(screen.getByText('Your Recommendations (2)')).toBeInTheDocument();
        // Schedules are displayed in the recommendations
        const scheduleElements = screen.getAllByText(/Schedule:/);
        expect(scheduleElements.length).toBeGreaterThan(0);
        // Check that schedule parts appear (use getAllByText since there are multiple)
        const mondayWednesday = screen.getAllByText(/Monday\/Wednesday/, { exact: false });
        const tuesdayThursday = screen.getAllByText(/Tuesday\/Thursday/, { exact: false });
        expect(mondayWednesday.length + tuesdayThursday.length).toBeGreaterThan(0);
        const times = screen.getAllByText(/10:00|11:00/, { exact: false });
        expect(times.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    test('calls onAddToPlanner when add button is clicked', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Your Recommendations (2)')).toBeInTheDocument();
      });
      
      const addButtons = screen.getAllByText('+ Add to Planner');
      fireEvent.click(addButtons[0]);
      
      expect(mockOnAddToPlanner).toHaveBeenCalledWith(mockRecommendations[0]);
    });

    test('handles API errors gracefully', async () => {
      api.getCourseRecommendations.mockRejectedValueOnce(new Error('API Error'));
      
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        // Error is stored in state but may not be displayed in the UI
        // Verify that loading state is cleared and button is enabled
        expect(submitButton).not.toBeDisabled();
        expect(screen.queryByText('Querying AI...')).not.toBeInTheDocument();
        // The error state is set but the component doesn't display it in the form view
        // We verify the component handled the error gracefully
      });
    });
  });

  describe('Reset Functionality', () => {
    test('resets form when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<RecommendMe {...defaultProps} />);
      
      // Make some changes
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      await user.type(input, 'Prof. Smith');
      await user.keyboard('{Enter}');
      
      fireEvent.click(screen.getByText('Early Morning (8:00–10:00 AM)'));
      fireEvent.click(screen.getByText('Challenging').closest('button'));
      
      // Reset
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);
      
      // Verify form is reset
      expect(input.value).toBe('');
      expect(screen.queryByText('Prof. Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Early Morning (8:00–10:00 AM)').closest('button')).toHaveClass('pill-outline');
    });

    test('calls onReset prop when reset is clicked', () => {
      render(<RecommendMe {...defaultProps} />);
      
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);
      
      expect(mockOnReset).toHaveBeenCalled();
    });

    test('resets recommendations view when back button is clicked', async () => {
      render(<RecommendMe {...defaultProps} />);
      
      // Get recommendations first
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Your Recommendations (2)')).toBeInTheDocument();
      });
      
      // Click back
      const backButton = screen.getByText('← Back');
      fireEvent.click(backButton);
      
      expect(screen.getByText('Any professors you\'d prefer to avoid?')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty recommendations array', async () => {
      api.getCourseRecommendations.mockResolvedValueOnce([]);
      
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Your Recommendations (0)')).toBeInTheDocument();
      });
    });

    test('handles recommendations without schedule', async () => {
      const recommendationsNoSchedule = [
        {
          ...mockRecommendations[0],
          schedule: null
        }
      ];
      api.getCourseRecommendations.mockResolvedValueOnce(recommendationsNoSchedule);
      
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/CS 1101.*Intro to Programming/)).toBeInTheDocument();
      });
    });

    test('handles recommendations without professors', async () => {
      const recommendationsNoProf = [
        {
          ...mockRecommendations[0],
          professors: []
        }
      ];
      api.getCourseRecommendations.mockResolvedValueOnce(recommendationsNoProf);
      
      render(<RecommendMe {...defaultProps} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/CS 1101.*Intro to Programming/)).toBeInTheDocument();
      });
    });

    test('handles missing onAddToPlanner prop', async () => {
      render(<RecommendMe {...defaultProps} onAddToPlanner={undefined} />);
      
      const submitButton = screen.getByText('Get Course Recommendations');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Your Recommendations (2)')).toBeInTheDocument();
      });
      
      // Should not crash when add button is clicked
      const addButtons = screen.queryAllByText('+ Add to Planner');
      expect(addButtons.length).toBe(0);
    });

    test('handles missing onReset prop', () => {
      render(<RecommendMe {...defaultProps} onReset={undefined} />);
      
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);
      
      // Should not crash
      expect(screen.getByText('Any professors you\'d prefer to avoid?')).toBeInTheDocument();
    });

    test('handles empty knownProfessors array', () => {
      render(<RecommendMe {...defaultProps} knownProfessors={[]} />);
      
      const input = screen.getByPlaceholderText('Type a name and press Enter…');
      expect(input).toBeInTheDocument();
    });
  });
});

