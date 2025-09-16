/*

NOTE: DON'T run this script yet until we hook it up to mongo correctly 
(database, cluster names etc)

*/


// Populates database with all CS courses 

import * as yes from '@vanderbilt/yes-api';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function getAllCSCourses() {
  const client = new MongoClient(process.env.MONGO_URI);
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB successfully!');
    
    const db = client.db('vanderbilt_courses'); // You can change this database name
    const collection = db.collection('cs_sections');
    
    // Get terms
    console.log('Fetching available terms...');
    const terms = await yes.getTerms();
    console.log('Available terms:', terms.slice(0, 5).map(t => t.title)); // Show first 5
    
    // Choose which terms to process
    const termsToProcess = terms.slice(0, 4); // 2025 Fall, 2025-26 Year, 2025 Summer, 2025 Spring
    
    console.log('Processing terms:', termsToProcess.map(t => t.title));
    
    let totalSections = 0;
    let totalCSComponents = 0;
    
    for (const term of termsToProcess) {
      console.log(`\n=== Processing ${term.title} ===`);
      
      try {
        // Search for all CS courses
        console.log('Searching for CS courses...');
        const csSections = await yes.searchSections("Computer Science", term);
        console.log(`Found ${csSections.length} CS sections for ${term.title}`);
        
        if (csSections.length > 0) {
          // Filter for actual CS courses (subject = "CS")
          const actualCSCourses = csSections.filter(section => 
            section.course?.subject === 'CS'
          );
          
          console.log(`Filtered to ${actualCSCourses.length} actual CS courses`);
          
          // Transform data for MongoDB storage
          const coursesToInsert = actualCSCourses.map(section => ({
            // Course identification
            sectionId: section.id,
            termId: section.term,
            termTitle: term.title,
            
            // Course info
            subject: section.course.subject,
            abbreviation: section.course.abbreviation,
            courseName: section.course.name,
            
            // Section info
            sectionNumber: section.number,
            sectionType: section.type,
            schedule: section.schedule,
            instructors: section.instructors || [],
            hours: section.hours,
            
            // Metadata
            lastUpdated: new Date(),
            dataSource: 'vanderbilt-yes-api'
          }));
          
          if (coursesToInsert.length > 0) {
            // Insert into MongoDB (replace existing data for this term)
            console.log(`Inserting ${coursesToInsert.length} sections into MongoDB...`);
            
            // Delete existing data for this term to avoid duplicates
            const deleteResult = await collection.deleteMany({ 
              termId: section.term,
              subject: 'CS' 
            });
            console.log(`Deleted ${deleteResult.deletedCount} existing records for ${term.title}`);
            
            // Insert new data
            const insertResult = await collection.insertMany(coursesToInsert);
            console.log(`Successfully inserted ${insertResult.insertedCount} CS sections for ${term.title}`);
            
            totalSections += insertResult.insertedCount;
            totalCSComponents += coursesToInsert.length;
          }
        }
        
        // Small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (termError) {
        console.error(`Error processing term ${term.title}:`, termError.message);
        continue; // Skip this term and continue with the next
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total CS sections processed: ${totalSections}`);
    
    // Show some sample data
    console.log('\n=== Sample of inserted data ===');
    const sampleDocs = await collection.find({ subject: 'CS' }).limit(3).toArray();
    sampleDocs.forEach((doc, index) => {
      console.log(`Sample ${index + 1}:`, {
        term: doc.termTitle,
        course: doc.abbreviation,
        name: doc.courseName,
        section: doc.sectionNumber,
        type: doc.sectionType,
        instructors: doc.instructors
      });
    });
    
    // Show unique courses
    console.log('\n=== Unique CS Courses Found ===');
    const uniqueCourses = await collection.distinct('abbreviation', { subject: 'CS' });
    console.log(`Found ${uniqueCourses.length} unique CS courses:`);
    uniqueCourses.sort().forEach(course => console.log(`  ${course}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close MongoDB connection
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

// Run the script
console.log('Starting CS courses data collection...');
getAllCSCourses().then(() => {
  console.log('Script completed!');
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});