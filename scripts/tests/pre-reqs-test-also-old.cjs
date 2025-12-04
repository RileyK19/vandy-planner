const puppeteer = require('puppeteer');

class ReliablePrereqScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        
        // Known prerequisites from reliable sources (PDFs, etc.)
        this.knownPrereqs = {
            // 'CS 1101': { prereqs: 'None', source: 'CS_Prerequisites_PDF' },
            // 'CS 1151': { prereqs: 'None', source: 'CS_Prerequisites_PDF' },
            // 'CS 2201': { prereqs: 'CS 1101 or CS 1104', source: 'CS_Prerequisites_PDF' },
            // 'CS 2212': { prereqs: 'A course in CS or 2 semesters of calculus', source: 'CS_Prerequisites_PDF' },
            // 'CS 2231': { prereqs: 'CS 2201', source: 'Engineering_Handbook' },
            // 'CS 2281': { prereqs: 'CS 2201', source: 'CS_Prerequisites_PDF' },
            // 'CS 3250': { prereqs: 'CS 2201; CS 2212', source: 'CS_Prerequisites_PDF' },
            // 'CS 3251': { prereqs: 'CS 2201', source: 'CS_Prerequisites_PDF' },
            // 'CS 3270': { prereqs: 'CS 2201; CS 2231 or EECE 2123', source: 'CS_Prerequisites_PDF' },
            // 'CS 3281': { prereqs: 'CS 2231 or EECE 2123; CS 3251', source: 'CS_Prerequisites_PDF' },
            // 'CS 4260': { prereqs: 'CS 3250; CS 3251; MATH 2810 or MATH 2820 or MATH 3640', source: 'CS_Prerequisites_PDF' },
            // 'CS 4277': { prereqs: 'CS 3251', source: 'CS_Prerequisites_PDF' },
            // 'CS 4278': { prereqs: 'CS 3251', source: 'CS_Prerequisites_PDF' },
            // 'CS 4959': { prereqs: 'CS 3251', source: 'CS_Prerequisites_PDF' }
        };
    }

    async init() {
        console.log('🚀 Launching browser...');
        this.browser = await puppeteer.launch({ 
            headless: true,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    }

    async scrapePrerequisites(courseCode) {
        console.log(`\n🎯 Getting prerequisites for: ${courseCode}`);
        console.log('='.repeat(60));

        // Check if we have known prerequisites first
        if (this.knownPrereqs[courseCode]) {
            const known = this.knownPrereqs[courseCode];
            console.log(`✅ Found in known prerequisites (${known.source})`);
            
            return {
                courseCode: courseCode,
                prerequisites: known.prereqs,
                parsedPrerequisites: this.parsePrerequisites(known.prereqs, courseCode),
                source: known.source,
                method: 'known_data',
                success: true,
                timestamp: new Date().toISOString()
            };
        }

        // If not in known prerequisites, try web scraping
        console.log('📡 Not in known prerequisites, trying web sources...');
        
        const webSources = [
            {
                name: 'Data Science Course Descriptions',
                url: 'https://www.vanderbilt.edu/undergrad-datascience/course-descriptions/',
                method: 'text_search'
            },
            {
                name: 'PDF',
                url: 'https://registrar.vanderbilt.edu/documents/Undergraduate_Catalog_2024-25.pdf',
                method: 'text_search'
            },
            {
                name: 'Scientific Computing Courses',
                url: 'https://www.vanderbilt.edu/scientific_computing/courses.php',
                method: 'text_search'
            },
            {
                name: 'Engineering Course Catalog',
                url: 'https://engineering.vanderbilt.edu/eecs/Graduate/Programs/CSrequirements.php',
                method: 'text_search'
            }
        ];

        for (const source of webSources) {
            console.log(`   📡 Trying: ${source.name}`);
            
            try {
                const result = await this.scrapeWebSource(courseCode, source);
                if (result.found) {
                    console.log(`   ✅ Found prerequisites: "${result.prerequisites}"`);
                    return {
                        courseCode: courseCode,
                        prerequisites: result.prerequisites,
                        parsedPrerequisites: this.parsePrerequisites(result.prerequisites, courseCode),
                        source: source.name,
                        method: 'web_scraping',
                        success: true,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                console.log(`   ❌ Error with ${source.name}: ${error.message}`);
            }
        }

        // If still not found, return unknown
        console.log('❌ Prerequisites not found in any source');
        return {
            courseCode: courseCode,
            prerequisites: null,
            source: 'none',
            method: 'not_found',
            success: false,
            timestamp: new Date().toISOString()
        };
    }

    async scrapeWebSource(courseCode, source) {
        await this.page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        return await this.page.evaluate((searchCourse) => {
            const text = document.body.innerText || '';
            const courseRegex = new RegExp(searchCourse.replace(' ', '\\s*'), 'i');
            
            if (!courseRegex.test(text)) {
                return { found: false, reason: 'Course not found' };
            }

            // Find the course and look for prerequisites in context
            const courseIndex = text.search(courseRegex);
            const contextStart = Math.max(0, courseIndex - 100);
            const contextEnd = Math.min(text.length, courseIndex + 800);
            const context = text.substring(contextStart, contextEnd);

            // Look for prerequisite patterns
            const prereqPatterns = [
                /prerequisite[s]?:\s*([^.!?\n]+)/gi,
                /prereq[s]?:\s*([^.!?\n]+)/gi,
                /requires?:\s*([^.!?\n]+)/gi,
                /completion of:\s*([^.!?\n]+)/gi
            ];

            for (const pattern of prereqPatterns) {
                const match = context.match(pattern);
                if (match) {
                    let prereqText = match[1].trim();
                    
                    // Validate - don't include self-references
                    if (!prereqText.toUpperCase().includes(searchCourse.toUpperCase()) && prereqText.length > 3) {
                        return {
                            found: true,
                            prerequisites: prereqText,
                            context: context
                        };
                    }
                }
            }

            return { found: false, reason: 'Prerequisites not found in context' };
        }, courseCode);
    }

    parsePrerequisites(prereqText, currentCourse) {
        if (!prereqText || prereqText.toLowerCase().includes('none')) {
            return { type: 'none', courses: [], raw: prereqText };
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
        } else if (lowerText.includes(';') || lowerText.includes(' and ') || courses.length > 1) {
            type = 'and';
        }

        return {
            type: type,
            courses: [...new Set(courses)],
            raw: prereqText,
            description: prereqText
        };
    }

    printResults(results) {
        console.log('\n' + '='.repeat(80));
        console.log(`📚 PREREQUISITES FOR: ${results.courseCode.toUpperCase()}`);
        console.log(`🕒 Retrieved: ${new Date(results.timestamp).toLocaleString()}`);
        console.log(`📊 Source: ${results.source} (${results.method})`);
        console.log('='.repeat(80));

        if (results.success) {
            console.log(`\n✅ PREREQUISITES: "${results.prerequisites}"`);
            
            if (results.parsedPrerequisites) {
                const parsed = results.parsedPrerequisites;
                console.log(`   Type: ${parsed.type}`);
                console.log(`   Courses: ${parsed.courses.join(', ') || 'None'}`);
            }
        } else {
            console.log('\n❌ NO PREREQUISITES FOUND');
        }

        console.log('\n' + '='.repeat(80));
    }

    generateDatabaseRecord(results) {
        if (!results.success) {
            return null;
        }

        return {
            courseId: results.courseCode,
            prerequisiteText: results.prerequisites,
            prerequisiteType: results.parsedPrerequisites?.type || 'unknown',
            prerequisiteCourses: results.parsedPrerequisites?.courses || [],
            lastUpdated: new Date(),
            dataSource: results.source,
            extractionMethod: results.method,
            scrapedAt: results.timestamp
        };
    }

    // Method to get prerequisites for multiple courses
    async scrapeMultipleCourses(courseCodes) {
        console.log(`\n🎯 Scraping prerequisites for ${courseCodes.length} courses...`);
        
        const results = [];
        for (const courseCode of courseCodes) {
            const result = await this.scrapePrerequisites(courseCode);
            results.push(result);
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }

    // Method to get all known CS prerequisites
    getAllKnownPrerequisites() {
        console.log('\n📊 All known CS prerequisites:');
        console.log('='.repeat(50));
        
        const results = [];
        Object.entries(this.knownPrereqs).forEach(([courseCode, data]) => {
            const parsed = this.parsePrerequisites(data.prereqs, courseCode);
            const record = {
                courseId: courseCode,
                prerequisiteText: data.prereqs,
                prerequisiteType: parsed.type,
                prerequisiteCourses: parsed.courses,
                lastUpdated: new Date(),
                dataSource: data.source,
                extractionMethod: 'known_data'
            };
            
            results.push(record);
            console.log(`${courseCode}: ${data.prereqs} (${parsed.courses.join(', ') || 'None'})`);
        });

        return results;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Main execution
async function main() {
    const scraper = new ReliablePrereqScraper();
    
    try {
        await scraper.init();
        
        const args = process.argv.slice(2);
        
        if (args[0] === '--all') {
            // Get all known prerequisites
            const allResults = scraper.getAllKnownPrerequisites();
            console.log(`\n💾 Generated ${allResults.length} database records`);
            
            // Output as JSON
            console.log('\n📄 JSON OUTPUT:');
            console.log(JSON.stringify(allResults, null, 2));
            
        } else if (args[0] === '--batch') {
            // Scrape multiple courses
            const courses = args.slice(1);
            if (courses.length === 0) {
                console.log('❌ Please provide course codes for batch scraping');
                console.log('Example: node scraper.js --batch "CS 3250" "CS 4260" "MATH 2300"');
                return;
            }
            
            const results = await scraper.scrapeMultipleCourses(courses);
            results.forEach(result => scraper.printResults(result));
            
        } else {
            // Single course
            const courseCode = args[0] || 'CS 3250';
            const results = await scraper.scrapePrerequisites(courseCode);
            scraper.printResults(results);
            
            const dbRecord = scraper.generateDatabaseRecord(results);
            if (dbRecord) {
                console.log('\n💾 DATABASE RECORD:');
                console.log(JSON.stringify(dbRecord, null, 2));
            }
        }
        
    } catch (error) {
        console.error('💥 Scraping failed:', error);
    } finally {
        await scraper.close();
    }
}

// Export for use as module
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ReliablePrereqScraper;