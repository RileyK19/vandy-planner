const puppeteer = require('puppeteer');

class CoursePrerequisiteScraper {
    constructor() {
        this.browser = null;
        this.page = null;
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
        console.log(`\n🔍 Scraping prerequisites for: ${courseCode}`);
        console.log('='.repeat(60));
        
        const sources = [
            {
                name: 'Kuali Catalog Direct',
                method: 'kuali_direct',
                priority: 1
            },
            {
                name: 'Kuali Catalog Search',
                method: 'kuali_search', 
                priority: 2
            },
            {
                name: 'Course Registration System',
                method: 'registration_search',
                priority: 3
            },
            {
                name: 'Department Course Lists',
                method: 'department_scan',
                priority: 4
            },
            {
                name: 'Academic Bulletin',
                method: 'bulletin_search',
                priority: 5
            }
        ];

        const results = {
            courseCode: courseCode,
            timestamp: new Date().toISOString(),
            prerequisites: null,
            sources: {}
        };

        // Try each source until we find good prerequisite data
        for (const source of sources) {
            console.log(`\n📡 Trying: ${source.name}`);
            
            try {
                const data = await this.trySource(courseCode, source.method);
                results.sources[source.name] = data;
                
                if (data.prerequisites && data.prerequisites !== 'Not found') {
                    console.log(`   ✅ Found prerequisites: "${data.prerequisites}"`);
                    if (!results.prerequisites) {
                        results.prerequisites = data.prerequisites;
                    }
                } else {
                    console.log(`   ❌ No prerequisites found`);
                }
                
                // Show what we found
                if (data.courseDescription) {
                    console.log(`   📝 Description: ${data.courseDescription.substring(0, 100)}...`);
                }
                if (data.additionalInfo) {
                    console.log(`   ℹ️  Additional: ${data.additionalInfo}`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                results.sources[source.name] = { error: error.message };
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Parse the final prerequisites
        if (results.prerequisites) {
            results.parsedPrerequisites = this.parsePrerequisites(results.prerequisites, courseCode);
        }

        return results;
    }

    async trySource(courseCode, method) {
        switch (method) {
            case 'kuali_direct':
                return await this.scrapeKualiDirect(courseCode);
            case 'kuali_search':
                return await this.scrapeKualiSearch(courseCode);
            case 'registration_search':
                return await this.scrapeRegistrationSystem(courseCode);
            case 'department_scan':
                return await this.scrapeDepartmentPages(courseCode);
            case 'bulletin_search':
                return await this.scrapeAcademicBulletin(courseCode);
            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }

    async scrapeKualiDirect(courseCode) {
        // Try direct URL to the course in Kuali catalog
        const encodedCourse = encodeURIComponent(courseCode);
        const urls = [
            `https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/courses/${encodedCourse}`,
            `https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/courses/${encodedCourse}`,
            `https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/courses?search=${encodedCourse}`
        ];

        for (const url of urls) {
            try {
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for JS to load
                
                const data = await this.page.evaluate((searchCourse) => {
                    const text = document.body.innerText || '';
                    const lowerText = text.toLowerCase();
                    const courseRegex = new RegExp(searchCourse.replace(' ', '\\s*'), 'i');
                    
                    if (!courseRegex.test(text)) {
                        return { found: false };
                    }

                    // Find course description blocks more precisely
                    let prerequisites = null;
                    let searchText = text;
                    let courseContext = '';

                    // Try to find the actual course description block
                    const courseDescPatterns = [
                        // Pattern 1: Course code followed by title, then description with prerequisite
                        new RegExp(`${searchCourse.replace(' ', '\\s*')}\\s*-\\s*([^\\n]*?)\\n([\\s\\S]{50,1000}?)(?=\\n\\s*[A-Z]{2,4}\\s*\\d{4}|\\n\\s*$|$)`, 'i'),
                        // Pattern 2: Course title line followed by description
                        new RegExp(`${searchCourse.replace(' ', '\\s*')}[^\\n]*?\\n([\\s\\S]{50,800}?)(?=prerequisite|prereq)([\\s\\S]{10,200}?)(?=\\.|\\n[A-Z]|$)`, 'i'),
                        // Pattern 3: Any mention with surrounding context
                        new RegExp(`([\\s\\S]{0,200}${searchCourse.replace(' ', '\\s*')}[\\s\\S]{50,600})`, 'i')
                    ];

                    for (const pattern of courseDescPatterns) {
                        const match = text.match(pattern);
                        if (match) {
                            courseContext = match[0];
                            searchText = courseContext;
                            break;
                        }
                    }

                    // If no specific pattern found, fall back to context search
                    if (!courseContext) {
                        const courseIndex = text.search(courseRegex);
                        if (courseIndex !== -1) {
                            const start = Math.max(0, courseIndex - 100);
                            const end = Math.min(text.length, courseIndex + 600);
                            searchText = text.substring(start, end);
                        }
                    }

                    // Look for prerequisite patterns more specifically
                    const prereqPatterns = [
                        // Pattern for "Prerequisite: CS 2201, CS 2212"
                        /prerequisite[s]?:\s*([A-Z]{2,4}\s*\d{4}[A-Z]?(?:\s*,\s*[A-Z]{2,4}\s*\d{4}[A-Z]?)*)/gi,
                        // Pattern for "Prereq: CS 2201, CS 2212" 
                        /prereq[s]?:\s*([A-Z]{2,4}\s*\d{4}[A-Z]?(?:\s*,\s*[A-Z]{2,4}\s*\d{4}[A-Z]?)*)/gi,
                        // More general patterns
                        /prerequisite[s]?:\s*([^.!?\n]{5,100})/gi,
                        /prereq[s]?:\s*([^.!?\n]{5,100})/gi
                    ];

                    for (const pattern of prereqPatterns) {
                        const matches = [...searchText.matchAll(pattern)];
                        if (matches.length > 0) {
                            let prereqText = matches[0][1].trim();
                            
                            // Validate that this prerequisite makes sense
                            // Skip if it contains the current course code
                            if (!prereqText.toUpperCase().includes(searchCourse.toUpperCase())) {
                                // Clean up common formatting issues
                                prereqText = prereqText.replace(/\s+/g, ' '); // Normalize whitespace
                                prereqText = prereqText.replace(/\.$/, ''); // Remove trailing period
                                
                                if (prereqText.length > 3) {
                                    prerequisites = prereqText;
                                    break;
                                }
                            }
                        }
                    }

                    // Look for course description in the context we found
                    let courseDescription = null;
                    const descPatterns = [
                        // Pattern for "CS 3250 - Algorithms Course Description ..."
                        new RegExp(`${searchCourse.replace(' ', '\\s*')}\\s*-\\s*([^\\n]+)\\n[^\\n]*Course Description[^\\n]*\\n([^.]+\\.)`, 'i'),
                        // General description pattern
                        new RegExp(`${searchCourse.replace(' ', '\\s*')}[^.]*?\\.\\s*([^.]{30,300}\\.)`, 'i')
                    ];
                    
                    for (const pattern of descPatterns) {
                        const match = searchText.match(pattern);
                        if (match) {
                            courseDescription = match[match.length - 1]; // Get the last capture group
                            break;
                        }
                    }

                    return {
                        found: true,
                        prerequisites: prerequisites || 'Not found',
                        courseDescription: courseDescription,
                        contextUsed: searchText.substring(0, 400), // Show more context
                        fullContext: courseContext || 'No specific context found',
                        url: window.location.href
                    };
                }, courseCode);

                if (data.found) {
                    return data;
                }
            } catch (error) {
                continue; // Try next URL
            }
        }

        return { prerequisites: 'Not found', method: 'kuali_direct' };
    }

    async scrapeKualiSearch(courseCode) {
        // Go to the main catalog and try to search
        await this.page.goto('https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/courses', 
                           { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Try to find and use search functionality
        const searchAttempted = await this.page.evaluate((searchTerm) => {
            const searchInputs = [
                'input[type="search"]',
                'input[placeholder*="search" i]',
                'input[placeholder*="course" i]',
                '.search-input',
                '#search-input'
            ];

            for (const selector of searchInputs) {
                const input = document.querySelector(selector);
                if (input) {
                    input.value = searchTerm;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Try to trigger search
                    const form = input.closest('form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { bubbles: true }));
                    }
                    
                    return true;
                }
            }
            return false;
        }, courseCode);

        if (searchAttempted) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return await this.page.evaluate((searchCourse) => {
                const text = document.body.innerText || '';
                const courseRegex = new RegExp(searchCourse.replace(' ', '\\s*'), 'i');
                
                if (courseRegex.test(text)) {
                    // Find course and look for prerequisites in context
                    const courseIndex = text.search(courseRegex);
                    if (courseIndex !== -1) {
                        const contextStart = Math.max(0, courseIndex - 100);
                        const contextEnd = Math.min(text.length, courseIndex + 500);
                        const context = text.substring(contextStart, contextEnd);
                        
                        const prereqMatch = context.match(/prerequisite[s]?:\s*([^.!?\n]+)/gi);
                        if (prereqMatch) {
                            let prereqText = prereqMatch[0]
                                .replace(/prerequisite[s]?:\s*/i, '')
                                .trim();
                            return {
                                prerequisites: prereqText,
                                method: 'kuali_search',
                                searchPerformed: true
                            };
                        }
                    }
                }
                return { prerequisites: 'Not found', method: 'kuali_search' };
            }, courseCode);
        }

        return { prerequisites: 'Not found', method: 'kuali_search', searchPerformed: false };
    }

    async scrapeRegistrationSystem(courseCode) {
        // Try the course registration/schedule system
        const urls = [
            'https://www.vanderbilt.edu/registrar/course-schedules/',
            'https://webapp.mis.vanderbilt.edu/more/SearchClasses/',
            'https://yes.vanderbilt.edu/' // Student information system
        ];

        for (const url of urls) {
            try {
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const data = await this.page.evaluate((searchCourse) => {
                    const text = document.body.innerText || '';
                    const courseRegex = new RegExp(searchCourse.replace(' ', '\\s*'), 'i');
                    const courseIndex = text.search(courseRegex);
                    
                    if (courseIndex !== -1) {
                        // Look in context around the course
                        const contextStart = Math.max(0, courseIndex - 200);
                        const contextEnd = Math.min(text.length, courseIndex + 600);
                        const context = text.substring(contextStart, contextEnd);
                        
                        const prereqMatch = context.match(/prerequisite[s]?:\s*([^.!?\n]+)/i);
                        return {
                            prerequisites: prereqMatch ? prereqMatch[1].trim() : 'Not found',
                            method: 'registration_search',
                            foundCourse: true
                        };
                    }
                    return { prerequisites: 'Not found', method: 'registration_search', foundCourse: false };
                }, courseCode);

                if (data.foundCourse) {
                    return data;
                }
            } catch (error) {
                continue;
            }
        }

        return { prerequisites: 'Not found', method: 'registration_search' };
    }

    async scrapeDepartmentPages(courseCode) {
        const subject = courseCode.split(' ')[0]; // Get 'CS' from 'CS 2201'
        const departmentUrls = {
            'CS': [
                'https://engineering.vanderbilt.edu/departments/computer-science/',
                'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/home',
                'https://www.vanderbilt.edu/undergrad-datascience/course-descriptions/',
                'https://www.vanderbilt.edu/scientific_computing/courses.php',
                'https://engineering.vanderbilt.edu/eecs/undergraduate/courses.php'
            ],
            'MATH': [
                'https://as.vanderbilt.edu/math/undergraduate/courses/',
                'https://www.vanderbilt.edu/catalogs/undergraduate/math.php'
            ],
            'EECS': [
                'https://engineering.vanderbilt.edu/eecs/undergraduate/courses.php'
            ]
        };

        const urls = departmentUrls[subject] || [];
        
        for (const url of urls) {
            try {
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const data = await this.page.evaluate((searchCourse) => {
                    const text = document.body.innerText || '';
                    const courseRegex = new RegExp(searchCourse.replace(' ', '\\s*'), 'i');
                    const courseIndex = text.search(courseRegex);
                    
                    if (courseIndex !== -1) {
                        // Look for course description block
                        const contextStart = Math.max(0, courseIndex - 50);
                        const contextEnd = Math.min(text.length, courseIndex + 800);
                        const context = text.substring(contextStart, contextEnd);
                        
                        // Look for prerequisite patterns
                        const prereqMatch = context.match(/(?:prerequisite|prereq)[s]?:?\s*([^.!?\n]+)/i);
                        if (prereqMatch) {
                            return {
                                prerequisites: prereqMatch[1].trim(),
                                method: 'department_scan',
                                foundCourse: true,
                                context: context.substring(0, 200)
                            };
                        }
                        
                        return {
                            prerequisites: 'Found course but no prerequisites listed',
                            method: 'department_scan',
                            foundCourse: true,
                            context: context.substring(0, 200)
                        };
                    }
                    
                    return { prerequisites: 'Not found', method: 'department_scan' };
                }, courseCode);

                if (data.foundCourse) {
                    return data;
                }
            } catch (error) {
                continue;
            }
        }

        return { prerequisites: 'Not found', method: 'department_scan' };
    }

    async scrapeAcademicBulletin(courseCode) {
        // Try academic bulletin or other catalog sources
        const urls = [
            'https://www.vanderbilt.edu/catalogs/',
            'https://catalog.vanderbilt.edu/',
            `https://catalog.vanderbilt.edu/undergraduate/courses/${courseCode.toLowerCase().replace(' ', '-')}/`
        ];

        for (const url of urls) {
            try {
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const data = await this.page.evaluate((searchCourse) => {
                    const text = document.body.innerText || '';
                    const courseRegex = new RegExp(searchCourse.replace(' ', '\\s*'), 'i');
                    const courseIndex = text.search(courseRegex);
                    
                    if (courseIndex !== -1) {
                        const contextStart = Math.max(0, courseIndex - 100);
                        const contextEnd = Math.min(text.length, courseIndex + 600);
                        const context = text.substring(contextStart, contextEnd);
                        
                        const prereqMatch = context.match(/prerequisite[s]?:\s*([^.!?\n]{10,200})/i);
                        return {
                            prerequisites: prereqMatch ? prereqMatch[1].trim() : 'Not found',
                            method: 'bulletin_search',
                            foundCourse: true
                        };
                    }
                    return { prerequisites: 'Not found', method: 'bulletin_search' };
                }, courseCode);

                if (data.foundCourse) {
                    return data;
                }
            } catch (error) {
                continue;
            }
        }

        return { prerequisites: 'Not found', method: 'bulletin_search' };
    }

    validatePrerequisites(prereqText, currentCourse) {
        if (!prereqText || prereqText === 'Not found') {
            return { valid: true, reason: 'No prerequisites to validate' };
        }

        const courseNum = parseInt(currentCourse.split(' ')[1]);
        const prereqCourses = prereqText.match(/[A-Z]{2,4}\s*\d{4}[A-Z]?/g) || [];
        
        // Check if any prerequisite course number is >= current course number
        // This would be illogical (higher level course can't be prereq for lower level)
        for (const prereq of prereqCourses) {
            const prereqNum = parseInt(prereq.match(/\d{4}/)[0]);
            if (prereqNum >= courseNum) {
                return { 
                    valid: false, 
                    reason: `Prerequisite ${prereq} has course number >= current course ${currentCourse}` 
                };
            }
        }

        // Check if current course appears in prerequisites (self-reference)
        if (prereqText.toUpperCase().includes(currentCourse.toUpperCase())) {
            return { 
                valid: false, 
                reason: 'Self-referential prerequisite detected' 
            };
        }

        return { valid: true, reason: 'Prerequisites appear valid' };
    }

    parsePrerequisites(prereqText, currentCourse) {
        if (!prereqText || prereqText === 'Not found' || prereqText.toLowerCase().includes('none')) {
            return { type: 'none', courses: [], raw: prereqText };
        }

        // Clean up the prerequisite text
        let cleanText = prereqText;
        
        // Remove common prefixes that might have been caught
        cleanText = cleanText.replace(/^[^A-Za-z]*/, ''); // Remove leading non-letters
        cleanText = cleanText.replace(/^\w*:\s*/, ''); // Remove "s:" or similar prefixes
        cleanText = cleanText.trim();

        const coursePattern = /([A-Z]{2,4})\s*(\d{4}[A-Z]?)/gi;
        const courses = [];
        let match;
        
        while ((match = coursePattern.exec(cleanText)) !== null) {
            const foundCourse = `${match[1].toUpperCase()} ${match[2]}`;
            // Don't include the current course as a prerequisite for itself
            if (foundCourse !== currentCourse.toUpperCase()) {
                courses.push(foundCourse);
            }
        }

        // If we found the current course as a prerequisite, it's likely wrong data
        if (courses.length === 0 && cleanText.toUpperCase().includes(currentCourse.toUpperCase())) {
            return { 
                type: 'error', 
                courses: [], 
                raw: prereqText,
                error: 'Self-referential prerequisite detected - likely parsing error'
            };
        }

        let type = 'single';
        const lowerText = cleanText.toLowerCase();
        if (lowerText.includes(' or ')) {
            type = 'or';
        } else if (lowerText.includes(';') || lowerText.includes(' and ') || courses.length > 1) {
            type = 'and';
        }

        return {
            type: type,
            courses: [...new Set(courses)], // Remove duplicates
            raw: prereqText,
            cleaned: cleanText,
            description: cleanText
        };
    }

    printResults(results) {
        console.log('\n' + '='.repeat(80));
        console.log(`📚 PREREQUISITE RESULTS FOR: ${results.courseCode.toUpperCase()}`);
        console.log(`🕒 Scraped: ${new Date(results.timestamp).toLocaleString()}`);
        console.log('='.repeat(80));

        if (results.prerequisites && results.prerequisites !== 'Not found') {
            console.log(`\n✅ PREREQUISITES FOUND:`);
            console.log(`   Raw: "${results.prerequisites}"`);
            
            if (results.parsedPrerequisites) {
                const parsed = results.parsedPrerequisites;
                console.log(`   Type: ${parsed.type}`);
                if (parsed.courses.length > 0) {
                    console.log(`   Courses: ${parsed.courses.join(', ')}`);
                } else if (parsed.type === 'error') {
                    console.log(`   ⚠️  Error: ${parsed.error}`);
                }
                if (parsed.cleaned && parsed.cleaned !== parsed.raw) {
                    console.log(`   Cleaned: "${parsed.cleaned}"`);
                }
            }
        } else {
            console.log('\n❌ NO PREREQUISITES FOUND');
        }

        console.log('\n📊 SOURCES CHECKED:');
        Object.entries(results.sources).forEach(([source, data]) => {
            const status = data.error ? '❌' : (data.prerequisites && data.prerequisites !== 'Not found' ? '✅' : '⚠️');
            console.log(`   ${status} ${source}: ${data.prerequisites || data.error || 'No data'}`);
        });

        console.log('\n' + '='.repeat(80));
    }

    generateDatabaseRecord(results) {
        if (!results.prerequisites || results.prerequisites === 'Not found') {
            return null;
        }

        // Don't generate records for error cases
        if (results.parsedPrerequisites?.type === 'error') {
            console.log('⚠️  Skipping database record due to parsing error');
            return null;
        }

        return {
            courseId: results.courseCode,
            prerequisiteText: results.prerequisites,
            prerequisiteType: results.parsedPrerequisites?.type || 'unknown',
            prerequisiteCourses: results.parsedPrerequisites?.courses || [],
            lastUpdated: new Date(),
            dataSource: 'vanderbilt_course_scraper',
            sourceDetails: Object.keys(results.sources).join(', '),
            scrapedAt: results.timestamp,
            cleanedPrerequisiteText: results.parsedPrerequisites?.cleaned || results.prerequisites
        };
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Main execution - can be called with course code as argument
async function main() {
    const scraper = new CoursePrerequisiteScraper();
    
    try {
        await scraper.init();
        
        const args = process.argv.slice(2);
        const courseCode = args[0] || 'CS 2201';
        
        console.log(`🎯 Scraping prerequisites for: ${courseCode}`);
        
        const results = await scraper.scrapePrerequisites(courseCode);
        scraper.printResults(results);
        
        const dbRecord = scraper.generateDatabaseRecord(results);
        if (dbRecord) {
            console.log('\n💾 DATABASE RECORD:');
            console.log(JSON.stringify(dbRecord, null, 2));
        } else {
            console.log('\n⚠️  No database record generated (no prerequisites found or parsing error)');
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

// Export the class for programmatic use
module.exports = {
    CoursePrerequisiteScraper,
    scrapePrerequisites: async (courseCode) => {
        const scraper = new CoursePrerequisiteScraper();
        await scraper.init();
        try {
            const results = await scraper.scrapePrerequisites(courseCode);
            return scraper.generateDatabaseRecord(results);
        } finally {
            await scraper.close();
        }
    }
};
 