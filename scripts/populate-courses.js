/*

NOTE: DON'T run this script yet until we hook it up to mongo correctly 
(database, cluster names etc)

*/

// Populates database with CS course information including prerequisites

const { MongoClient } = require('mongodb');
const { readFileSync } = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class CSCoursesPopulator {
    constructor() {
        this.client = new MongoClient(process.env.MONGO_URI);
        this.db = null;
        this.collection = null;
    }

    async connect() {
        console.log('Connecting to MongoDB...');
        await this.client.connect();
        console.log('Connected to MongoDB successfully!');
        
        this.db = this.client.db('vanderbilt_courses');
        this.collection = this.db.collection('cs_courses'); // Different collection for course info vs sections
    }

    parseCatalogText(catalogText) {
        console.log('Parsing catalog content for CS courses...');
        
        const courses = {};
        
        // Pattern for Vanderbilt catalog format:
        // CS3250 - Algorithms
        // Course Description  
        // Description text. Prerequisite: CS 2201, CS 2212. FALL, SPRING. [3]
        
        const coursePattern = /(CS)(\d{4}[A-Z]*)\s*-\s*([^\n]+)\n(?:Course Description\n)?([\s\S]*?)(?=\nCS\d{4}|\n\n[A-Z]{2,5}\d{4}|$)/gi;
        
        let match;
        while ((match = coursePattern.exec(catalogText)) !== null) {
            const [fullMatch, dept, number, title, description] = match;
            const courseCode = `${dept} ${number}`;
            
            // Clean up the description
            const cleanDescription = description.trim();
            
            // Extract prerequisites
            const prerequisites = this.extractPrerequisites(cleanDescription, courseCode);
            
            // Extract credit hours from [3] format
            const creditMatch = cleanDescription.match(/\[(\d+(?:\.\d+)?)\]$/);
            const creditHours = creditMatch ? parseFloat(creditMatch[1]) : null;
            
            // Extract terms offered
            const termMatch = cleanDescription.match(/\b(FALL|SPRING|SUMMER|WINTER)(?:\s*,\s*(FALL|SPRING|SUMMER|WINTER))*\b/i);
            const terms = termMatch ? termMatch[0].split(',').map(t => t.trim()) : [];
            
            // Remove prerequisite, terms, and credit hours from description for clean description
            let cleanDesc = cleanDescription
                .replace(/\s*Prerequisite[s]?:\s*[^.]*\./gi, '')
                .replace(/\s*\b(FALL|SPRING|SUMMER|WINTER).*?\[?\d+\]?\s*$/gi, '')
                .replace(/\s*\[\d+\]\s*$/g, '')
                .trim();
            
            courses[courseCode] = {
                courseCode: courseCode,
                department: dept,
                number: number,
                name: title.trim(),
                creditHours: creditHours,
                description: cleanDesc,
                prerequisites: prerequisites,
                termsOffered: terms,
                lastUpdated: new Date(),
                dataSource: 'vanderbilt_catalog_2024_25'
            };
        }
        
        return courses;
    }

    extractPrerequisites(text, courseCode) {
        if (!text) return null;

        const prereqPatterns = [
            /prerequisite[s]?:\s*([^.!?\n]+)/gi,
            /prereq[s]?:\s*([^.!?\n]+)/gi
        ];

        for (const pattern of prereqPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                let prereqText = matches[0]
                    .replace(/prerequisite[s]?:\s*/gi, '')
                    .replace(/prereq[s]?:\s*/gi, '')
                    .trim();

                // Clean up
                prereqText = prereqText.replace(/\s+/g, ' ');
                prereqText = prereqText.replace(/\.$/, '');

                // Validate - no self-references and meaningful length
                if (prereqText.length > 3 && 
                    !prereqText.toUpperCase().includes(courseCode.toUpperCase())) {
                    
                    return {
                        raw: prereqText,
                        parsed: this.parsePrerequisites(prereqText, courseCode)
                    };
                }
            }
        }

        return null;
    }

    parsePrerequisites(prereqText, currentCourse) {
        if (!prereqText || prereqText.toLowerCase().includes('none')) {
            return { type: 'none', courses: [] };
        }

        const coursePattern = /([A-Z]{2,4})\s*(\d{4}[A-Z]?)/gi;
        const courses = [];
        let match;
        
        while ((match = coursePattern.exec(prereqText)) !== null) {
            const foundCourse = `${match[1].toUpperCase()} ${match[2]}`;
            if (foundCourse !== currentCourse.toUpperCase()) {
                courses.push(foundCourse);
            }
        }

        let type = 'single';
        const lowerText = prereqText.toLowerCase();
        if (lowerText.includes(' or ')) {
            type = 'or';
        } else if (lowerText.includes(';') || lowerText.includes(' and ') || lowerText.includes(',') || courses.length > 1) {
            type = 'and';
        }

        return {
            type: type,
            courses: [...new Set(courses)],
            description: prereqText
        };
    }

    async populateCSCourses(catalogTextPath) {
        console.log(`Reading catalog from: ${catalogTextPath}`);
        
        const catalogText = readFileSync(catalogTextPath, 'utf8');
        console.log(`Loaded ${catalogText.length} characters from catalog`);
        
        const courses = this.parseCatalogText(catalogText);
        const courseList = Object.values(courses);
        
        console.log(`Found ${courseList.length} CS courses in catalog`);
        
        if (courseList.length === 0) {
            console.log('No CS courses found. Check catalog format or parsing logic.');
            return;
        }

        // Show sample of what we found
        console.log('\n=== Sample courses found ===');
        courseList.slice(0, 3).forEach((course, index) => {
            console.log(`Sample ${index + 1}:`);
            console.log(`  Code: ${course.courseCode}`);
            console.log(`  Name: ${course.name}`);
            console.log(`  Credit Hours: ${course.creditHours}`);
            console.log(`  Prerequisites: ${course.prerequisites?.raw || 'None'}`);
            console.log(`  Description: ${course.description.substring(0, 100)}...`);
            console.log('');
        });

        // Clear existing CS courses to avoid duplicates
        console.log('Clearing existing CS courses...');
        const deleteResult = await this.collection.deleteMany({ department: 'CS' });
        console.log(`Deleted ${deleteResult.deletedCount} existing CS course records`);

        // Insert new course data
        console.log(`Inserting ${courseList.length} CS courses...`);
        const insertResult = await this.collection.insertMany(courseList);
        console.log(`Successfully inserted ${insertResult.insertedCount} CS courses`);

        // Show statistics
        await this.showStatistics();
        
        return courseList;
    }

    async showStatistics() {
        console.log('\n=== CS Courses Statistics ===');
        
        const totalCourses = await this.collection.countDocuments({ department: 'CS' });
        console.log(`Total CS courses: ${totalCourses}`);
        
        const coursesWithPrereqs = await this.collection.countDocuments({ 
            department: 'CS',
            'prerequisites.raw': { $exists: true, $ne: null }
        });
        console.log(`Courses with prerequisites: ${coursesWithPrereqs}`);
        
        const coursesWithoutPrereqs = totalCourses - coursesWithPrereqs;
        console.log(`Courses without prerequisites: ${coursesWithoutPrereqs}`);

        // Show course level distribution
        console.log('\n=== Course Level Distribution ===');
        const levels = {
            '1000': await this.collection.countDocuments({ department: 'CS', number: { $regex: /^1\d{3}/ } }),
            '2000': await this.collection.countDocuments({ department: 'CS', number: { $regex: /^2\d{3}/ } }),
            '3000': await this.collection.countDocuments({ department: 'CS', number: { $regex: /^3\d{3}/ } }),
            '4000': await this.collection.countDocuments({ department: 'CS', number: { $regex: /^4\d{3}/ } }),
            '5000+': await this.collection.countDocuments({ department: 'CS', number: { $regex: /^[5-9]\d{3}/ } })
        };
        
        Object.entries(levels).forEach(([level, count]) => {
            console.log(`  ${level} level: ${count} courses`);
        });

        // Show courses with most prerequisites
        console.log('\n=== Courses with Most Prerequisites ===');
        const coursesWithMostPrereqs = await this.collection
            .find({ 
                department: 'CS',
                'prerequisites.parsed.courses': { $exists: true, $not: { $size: 0 } }
            })
            .sort({ 'prerequisites.parsed.courses': -1 })
            .limit(5)
            .toArray();
            
        coursesWithMostPrereqs.forEach(course => {
            console.log(`  ${course.courseCode} (${course.name}): ${course.prerequisites.parsed.courses.length} prerequisites`);
            console.log(`    Prerequisites: ${course.prerequisites.parsed.courses.join(', ')}`);
        });
    }

    async close() {
        await this.client.close();
        console.log('MongoDB connection closed.');
    }
}

async function populateCSCourses() {
    const populator = new CSCoursesPopulator();
    
    try {
        await populator.connect();
        
        // Use catalog.txt from current directory
        const catalogPath = './catalog.txt';
        const courses = await populator.populateCSCourses(catalogPath);
        
        console.log('\n=== All CS Courses ===');
        courses.forEach(course => {
            console.log(`${course.courseCode}: ${course.name}`);
            if (course.prerequisites) {
                console.log(`  Prerequisites: ${course.prerequisites.raw}`);
                console.log(`  Parsed: ${course.prerequisites.parsed.courses.join(', ') || 'None'}`);
            }
            console.log(`  Credit Hours: ${course.creditHours || 'Not specified'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await populator.close();
    }
}

// Run the script
console.log('Starting CS courses population...');
populateCSCourses().then(() => {
    console.log('CS courses population completed!');
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});