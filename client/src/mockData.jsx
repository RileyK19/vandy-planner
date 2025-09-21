// mockData.js - Mock data for testing when database isn't available

export const mockClasses = [
    {
      id: 1,
      code: 'CS1101',
      name: 'Intro to Computer Science',
      active: true,
      subject: 'CS',
      professors: ['Rui Bai'],
      term: 'Fall 2025',
      sectionNumber: '001',
      schedule: {
        days: ['Monday', 'Wednesday', 'Friday'],
        startTime: '09:00',
        endTime: '10:15',
        location: 'FGH 134'
      },
      hours: 3
    },
    {
      id: 2,
      code: 'CS2201',
      name: 'Data Structures and Program Design',
      active: true,
      subject: 'CS',
      professors: ['Gerald Roth'],
      term: 'Spring 2025',
      sectionNumber: '001',
      schedule: {
        days: ['Tuesday', 'Thursday'],
        startTime: '11:00',
        endTime: '12:15',
        location: 'FGH 258'
      },
      hours: 3
    },
    {
      id: 4,
      code: 'CS4287',
      name: 'Principles of Cloud Computing',
      active: true,
      subject: 'CS',
      professors: ['Vikash Singh'],
      term: 'Fall 2025',
      sectionNumber: '001',
      schedule: {
        days: ['Monday', 'Wednesday'],
        startTime: '14:30',
        endTime: '15:45',
        location: 'FGH 140'
      },
      hours: 3
    },
    {
      id: 5,
      code: 'CS4278',
      name: 'Principles of Software Engineering',
      active: false,
      subject: 'CS',
      professors: ['Vikash Singh', 'Darren Pulsipher'],
      term: 'Spring 2025',
      sectionNumber: '001',
      schedule: {
        days: ['Tuesday', 'Thursday'],
        startTime: '13:00',
        endTime: '14:15',
        location: 'FGH 286'
      },
      hours: 3
    },
  ]