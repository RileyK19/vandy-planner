import * as yes from '@vanderbilt/yes-api';

async function testAPIFaster() {
  try {    
    console.log('Fetching terms...');
    const terms = await yes.getTerms();
    console.log('Terms:', terms.map(t => t.title));

    // Pick latest term
    const latestTerm = terms[0];
    console.log('Latest term:', latestTerm.title);

    // Search for specific courses instead of getting ALL sections (fast)
    console.log('Searching for CS2201 sections specifically...');
    const cs2201Sections = await yes.searchSections("CS 2201", latestTerm);
    
    if (cs2201Sections.length === 0) {
      console.log('No CS2201 sections found.');
    } else {
      console.log(`Found ${cs2201Sections.length} CS2201 sections:`);
      cs2201Sections.forEach((section, index) => {
        console.log(`Section ${index + 1}:`, {
          id: section.id,
          abbreviation: section.course?.abbreviation || 'Unknown',
          name: section.course?.name || 'Unknown', 
          subject: section.course?.subject || 'Unknown',
          number: section.number,
          type: section.type,
          schedule: section.schedule,
          instructors: section.instructors || ['TBD'], 
          hours: section.hours
        });
      });
    }

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Streaming to see progress while it's working
async function testAPIWithProgress() {
  try {    
    console.log('Fetching terms...');
    const terms = await yes.getTerms();
    const latestTerm = terms[0];
    console.log('Latest term:', latestTerm.title);

    console.log('Fetching all sections with progress updates...');
    let sectionCount = 0;
    let cs2201Count = 0;
    
    const sections = await yes.getAllSections(
      latestTerm, 
      false, 
      (section, timeElapsed) => {
        sectionCount++;
        if (section.course?.abbreviation === 'CS 2201') {
          cs2201Count++;
          console.log(`Found CS2201 section #${cs2201Count}: ${section.course.name}`);
        }
        
        // Progress update every 100 sections
        if (sectionCount % 100 === 0) {
          console.log(`Progress: ${sectionCount} sections processed, ${timeElapsed}ms elapsed`);
        }
      }
    );

    console.log(`\nCompleted! Total sections: ${sections.length}`);
    const finalCS2201 = sections.filter(s => s.course?.abbreviation === 'CS 2201');
    console.log(`Total CS2201 sections found: ${finalCS2201.length}`);

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Run both - fast one first, then streaming
async function runBothTests() {
  console.log('=== Running faster search version first ===');
  await testAPIFaster();
  
  console.log('\n=== Now running streaming version with progress updates ===');
  await testAPIWithProgress();
}

runBothTests();