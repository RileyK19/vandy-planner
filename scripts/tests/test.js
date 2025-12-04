// print-raw-class.js

import * as yes from '@vanderbilt/yes-api';

async function printOneRawCSClass() {
  console.log('Fetching available terms...');
  const terms = await yes.getTerms();

  // Pick the first available term (e.g., '2025 Fall')
  const term = terms[0];
  console.log(`Using term: ${term.title} (${term.id})`);

  console.log('Searching for CS sections...');
  const csSections = await yes.searchSections("Computer Science", term);

  if (csSections.length === 0) {
    console.log('No CS sections found.');
    return;
  }

  // Print the raw structure of the first CS section
  console.log('\n=== Raw CS Section (1st result) ===\n');
  console.dir(csSections[0], { depth: null, colors: true });
}

printOneRawCSClass().catch(error => {
  console.error('Error:', error);
});
