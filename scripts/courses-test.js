// Test script to parse CS courses from catalog and print results

const { readFileSync } = require('fs');

class CSCoursesParser {
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
}

async function testCSCoursesParsing() {
    const parser = new CSCoursesParser();
    
    try {
        console.log('Reading catalog from: ./catalog.txt');
        
        const catalogText = readFileSync('./catalog.txt', 'utf8');
        console.log(`Loaded ${catalogText.length} characters from catalog`);
        
        const courses = parser.parseCatalogText(catalogText);
        const courseList = Object.values(courses);
        
        console.log(`\nFound ${courseList.length} CS courses in catalog\n`);
        
        if (courseList.length === 0) {
            console.log('No CS courses found. Checking sample text...');
            console.log('First 1000 characters of catalog:');
            console.log(catalogText.substring(0, 1000));
            console.log('\nLooking for CS course patterns...');
            
            const csMatches = catalogText.match(/CS\d{4}/g);
            if (csMatches) {
                console.log(`Found CS course codes: ${csMatches.slice(0, 10).join(', ')}`);
            } else {
                console.log('No CS course codes found at all');
            }
            return;
        }

        // Print first few courses for testing
        console.log('='.repeat(80));
        console.log('SAMPLE CS COURSES (first 5):');
        console.log('='.repeat(80));
        
        courseList.slice(0, 5).forEach((course, index) => {
            console.log(`\n${index + 1}. ${course.courseCode} - ${course.name}`);
            console.log(`   Department: ${course.department}`);
            console.log(`   Number: ${course.number}`);
            console.log(`   Credit Hours: ${course.creditHours || 'Not specified'}`);
            
            if (course.prerequisites) {
                console.log(`   Prerequisites (Raw): "${course.prerequisites.raw}"`);
                console.log(`   Prerequisites (Parsed): ${course.prerequisites.parsed.type}`);
                console.log(`   Prerequisite Courses: [${course.prerequisites.parsed.courses.join(', ')}]`);
            } else {
                console.log(`   Prerequisites: None`);
            }
            
            if (course.termsOffered.length > 0) {
                console.log(`   Terms Offered: ${course.termsOffered.join(', ')}`);
            }
            
            console.log(`   Description: ${course.description.substring(0, 150)}${course.description.length > 150 ? '...' : ''}`);
        });
        
        // Statistics
        console.log('\n' + '='.repeat(80));
        console.log('STATISTICS:');
        console.log('='.repeat(80));
        
        const withPrereqs = courseList.filter(c => c.prerequisites).length;
        const withoutPrereqs = courseList.length - withPrereqs;
        
        console.log(`Total CS courses: ${courseList.length}`);
        console.log(`Courses with prerequisites: ${withPrereqs}`);
        console.log(`Courses without prerequisites: ${withoutPrereqs}`);
        
        // Course level breakdown
        const levels = {
            '1000': courseList.filter(c => c.number.startsWith('1')).length,
            '2000': courseList.filter(c => c.number.startsWith('2')).length,
            '3000': courseList.filter(c => c.number.startsWith('3')).length,
            '4000': courseList.filter(c => c.number.startsWith('4')).length,
            '5000+': courseList.filter(c => /^[5-9]/.test(c.number)).length
        };
        
        console.log('\nCourse level distribution:');
        Object.entries(levels).forEach(([level, count]) => {
            console.log(`  ${level} level: ${count} courses`);
        });
        
        // Show courses with prerequisites
        const coursesWithPrereqs = courseList.filter(c => c.prerequisites);
        if (coursesWithPrereqs.length > 0) {
            console.log('\n' + '='.repeat(80));
            console.log('COURSES WITH PREREQUISITES:');
            console.log('='.repeat(80));
            
            coursesWithPrereqs.slice(0, 10).forEach(course => {
                console.log(`${course.courseCode}: ${course.prerequisites.raw}`);
                console.log(`  -> Requires: ${course.prerequisites.parsed.courses.join(', ')}`);
            });
            
            if (coursesWithPrereqs.length > 10) {
                console.log(`... and ${coursesWithPrereqs.length - 10} more courses with prerequisites`);
            }
        }
        
        // Example database record format
        console.log('\n' + '='.repeat(80));
        console.log('EXAMPLE DATABASE RECORD FORMAT:');
        console.log('='.repeat(80));
        
        if (courseList.length > 0) {
            const exampleCourse = courseList.find(c => c.prerequisites) || courseList[0];
            console.log(JSON.stringify(exampleCourse, null, 2));
        }
        
    } catch (error) {
        console.error('Error reading or parsing catalog:', error.message);
        
        if (error.code === 'ENOENT') {
            console.log('\nMake sure catalog.txt exists in the current directory');
            console.log('You can create it by converting the PDF:');
            console.log('  pdftotext catalog.pdf catalog.txt');
        }
    }
}

// Run the test
console.log('Testing CS courses parsing...');
testCSCoursesParsing().then(() => {
    console.log('\nTesting completed!');
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});