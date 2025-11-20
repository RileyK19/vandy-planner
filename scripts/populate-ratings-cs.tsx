/*
Simplified RMP data collector - only stores course-instructor pairs with averages
Stores in separate cluster to avoid cluttering existing data

Install: npm install rate-my-professor-api-ts mongodb dotenv
*/

import { RateMyProfessor } from "rate-my-professor-api-ts";
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

interface CSSection {
  sectionId: string;
  abbreviation: string;
  courseName: string;
  instructors: string[];
  termTitle: string;
}

interface CourseInstructorPair {
  courseId: string;        // e.g., "CS 1101"
  courseName: string;
  instructorName: string;
}

interface RMPAverage {
  courseId: string;        // e.g., "CS 1101" 
  courseName: string;
  instructorName: string;
  averageQuality: number | null;    // 1-5 scale
  averageDifficulty: number | null; // 1-5 scale
  lastUpdated: Date;
}

class SimpleRMPCollector {
  private sourceClient: MongoClient;
  private targetClient: MongoClient;
  private rmp: RateMyProfessor;

  constructor(sourceMongoUri: string, targetMongoUri: string) {
    this.sourceClient = new MongoClient(sourceMongoUri);
    this.targetClient = new MongoClient(targetMongoUri);
    this.rmp = new RateMyProfessor("Vanderbilt University");
  }

  async connect() {
    console.log('Connecting to databases...');
    await this.sourceClient.connect();
    await this.targetClient.connect();
    console.log('Connected successfully!');
  }

  async disconnect() {
    await this.sourceClient.close();
    await this.targetClient.close();
    console.log('Database connections closed.');
  }

  async getCSCourseInstructorPairs(): Promise<CourseInstructorPair[]> {
    const db = this.sourceClient.db('vanderbilt_courses');
    const collection = db.collection<CSSection>('cs_sections');

    console.log('Fetching CS courses from source database...');
    const csSections = await collection.find({ subject: 'CS' }).toArray();
    console.log(`Found ${csSections.length} CS sections`);

    const pairMap = new Map<string, CourseInstructorPair>();

    for (const section of csSections) {
      if (!section.instructors || section.instructors.length === 0) continue;

      for (const instructor of section.instructors) {
        const cleanName = this.cleanInstructorName(instructor);
        if (!cleanName) continue;

        const key = `${section.abbreviation}|${cleanName}`;
        
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            courseId: section.abbreviation,
            courseName: section.courseName,
            instructorName: cleanName
          });
        }
      }
    }

    const pairs = Array.from(pairMap.values());
    console.log(`Found ${pairs.length} unique course-instructor pairs`);
    return pairs;
  }

  private cleanInstructorName(name: string): string | null {
    let cleaned = name.trim()
      .replace(/^(Dr\.?|Prof\.?|Professor)\s+/i, '')
      .replace(/,?\s+(Ph\.?D\.?|M\.?D\.?|Jr\.?|Sr\.?|III?|IV)$/i, '')
      .trim();

    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        cleaned = `${parts[1]} ${parts[0]}`;
      }
    }

    const nameParts = cleaned.split(' ').filter(p => p.length > 0);
    if (nameParts.length < 2) return null;

    return `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
  }

  async getRMPAverages(instructorName: string): Promise<{quality: number | null, difficulty: number | null}> {
    try {
      console.log(`  Fetching: ${instructorName}`);
      
      this.rmp.set_professor_name(instructorName);
      const professorInfo = await this.rmp.get_professor_info();
      
      await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limiting
      
      if (professorInfo && (professorInfo.avgRating || professorInfo.rating)) {
        const quality = parseFloat(professorInfo.avgRating || professorInfo.rating || '0') || null;
        const difficulty = parseFloat(professorInfo.avgDifficulty || professorInfo.difficulty || '0') || null;
        
        console.log(`    ✅ Quality: ${quality}, Difficulty: ${difficulty}`);
        return { quality, difficulty };
      } else {
        console.log(`    ❌ No data found`);
        return { quality: null, difficulty: null };
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      return { quality: null, difficulty: null };
    }
  }

  async collectAndStore(pairs: CourseInstructorPair[]) {
    const averages: RMPAverage[] = [];
    
    console.log(`\n=== Processing ${pairs.length} pairs ===`);

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      console.log(`\n[${i + 1}/${pairs.length}] ${pair.courseId} - ${pair.instructorName}`);

      const { quality, difficulty } = await this.getRMPAverages(pair.instructorName);

      averages.push({
        courseId: pair.courseId,
        courseName: pair.courseName,
        instructorName: pair.instructorName,
        averageQuality: quality,
        averageDifficulty: difficulty,
        lastUpdated: new Date()
      });

      if ((i + 1) % 10 === 0) {
        console.log(`\n📊 Progress: ${i + 1}/${pairs.length}`);
      }
    }

    // Save to target database
    await this.saveAverages(averages);
    return averages;
  }

  async saveAverages(averages: RMPAverage[]) {
    const db = this.targetClient.db('rmp_data');  // Separate cluster/database
    const collection = db.collection('course_instructor_averages');

    console.log(`\n=== Saving to separate cluster ===`);

    // Clear existing data
    const deleteResult = await collection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing records`);

    // Insert new data
    const insertResult = await collection.insertMany(averages);
    console.log(`✅ Inserted ${insertResult.insertedCount} averages`);

    // Create indexes
    await collection.createIndex({ courseId: 1, instructorName: 1 });
    console.log('📊 Created indexes');

    // Show statistics
    const withData = averages.filter(a => a.averageQuality !== null || a.averageDifficulty !== null);
    const avgQuality = withData.length > 0 ? 
      withData.filter(a => a.averageQuality !== null)
        .reduce((sum, a) => sum + a.averageQuality!, 0) / withData.filter(a => a.averageQuality !== null).length 
      : 0;

    console.log('\n=== Results ===');
    console.log(`Total pairs: ${averages.length}`);
    console.log(`With RMP data: ${withData.length}`);
    console.log(`Average quality rating: ${avgQuality.toFixed(2)}`);

    // Show sample data
    console.log('\n=== Sample Records ===');
    const samples = averages.filter(a => a.averageQuality !== null).slice(0, 3);
    samples.forEach((record, i) => {
      console.log(`${i + 1}. ${record.courseId} - ${record.instructorName}`);
      console.log(`   Quality: ${record.averageQuality}, Difficulty: ${record.averageDifficulty}`);
    });
  }
}

async function main() {
  const sourceUri = process.env.MONGO_URI;
  const targetUri = process.env.RMP_MONGO_URI || process.env.MONGO_URI; // Use separate URI if provided
  
  if (!sourceUri) {
    console.error('❌ MONGO_URI environment variable required');
    process.exit(1);
  }

  console.log('🎓 Simple RMP Course-Instructor Averages Collector');
  console.log(`📂 Source: vanderbilt_courses.cs_sections`);
  console.log(`💾 Target: rmp_data.course_instructor_averages`);

  const collector = new SimpleRMPCollector(sourceUri, targetUri!);

  try {
    await collector.connect();
    
    const pairs = await collector.getCSCourseInstructorPairs();
    if (pairs.length === 0) {
      console.log('❌ No course-instructor pairs found');
      return;
    }

    await collector.collectAndStore(pairs);
    console.log('\n🎉 Complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await collector.disconnect();
  }
}

main();