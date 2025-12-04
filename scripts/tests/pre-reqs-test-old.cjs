// might work better but idk..


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
        // Try multiple strategies for the Kuali catalog
        const strategies = [
            // Strategy 1: Try the direct course ID URL (if we had the ID)
            async () => {
                const searchUrl = `https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/courses?q=${encodeURIComponent(courseCode)}`;
                await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer for JS
                
                // Try clicking on search results or course links
                const clicked = await this.page.evaluate((searchCourse) => {
                    // Look for course links or buttons
                    const courseLinks = Array.from(document.querySelectorAll('a, button, .course-item, [data-course], .course-link'));
                    for (const link of courseLinks) {
                        const text = link.textContent || link.innerText || '';
                        if (text.includes(searchCourse)) {
                            link.click();
                            return true;
                        }
                    }
                    return false;
                }, courseCode);
                
                if (clicked) {
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for navigation
                }
                
                return await this.extractKualiContent(courseCode);
            },
            
            // Strategy 2: Try searching and parsing results
            async () => {
                await this.page.goto('https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/courses', { waitUntil: 'domcontentloaded', timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 4000));
                
                // Try to trigger search
                await this.page.evaluate((searchTerm) => {
                    // Try multiple search input selectors
                    const selectors = [
                        'input[type="search"]',
                        'input[placeholder*="search" i]',
                        'input[name*="search" i]',
                        '.search-input',
                        '#search-input',
                        'input[type="text"]'
                    ];
                    
                    for (const selector of selectors) {
                        const input = document.querySelector(selector);
                        if (input) {
                            input.value = searchTerm;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            
                            // Try Enter key
                            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                            
                            // Try form submission
                            const form = input.closest('form');
                            if (form) {
                                form.dispatchEvent(new Event('submit', { bubbles: true }));
                            }
                            
                            return true;
                        }
                    }
                    return false;
                }, courseCode);
                
                await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for results
                
                return await this.extractKualiContent(courseCode);
            },
            
            // Strategy 3: Parse whatever is currently on the page
            async () => {
                await this.page.goto('https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php', { waitUntil: 'domcontentloaded', timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for all JS to load
                
                return await this.extractKualiContent(courseCode);
            }
        ];
        
        // Try each strategy
        for (const strategy of strategies) {
            try {
                const result = await strategy();
                if (result.found && result.prerequisites !== 'Not found') {
                    return result;
                }
            } catch (error) {
                console.log(`   Strategy failed: ${error.message}`);
                continue;
            }
        }

        return { prerequisites: 'Not found', method: 'kuali_direct' };
    }

    async extractKualiContent(courseCode) {
        return await this.page.evaluate((searchCourse) => {
            const text = document.body.innerText || '';
            
            // Look specifically for the course description block, not just any mention
            // Pattern: "CS 3250 - Course Title" followed by description and prerequisites
            const courseDescPattern = new RegExp(
                `${searchCourse.replace(' ', '\\s*')}\\s*[-–—]\\s*([^\\n]+)\\n([\\s\\S]{50,1500}?)(?=\\n\\s*[A-Z]{2,4}\\s*\\d{4}|\\n\\s*$|$)`,
                'i'
            );
            
            const match = text.match(courseDescPattern);
            if (!match) {
                return { 
                    found: false, 
                    reason: `Could not find course description block for ${searchCourse}`,
                    pageLength: text.length 
                };
            }
            
            const courseTitle = match[1].trim();
            const courseDescription = match[2].trim();
            
            console.log(`Found course: ${searchCourse} - ${courseTitle}`);
            console.log(`Description preview: ${courseDescription.substring(0, 100)}...`);
            
            // Now look for prerequisites within this specific course description
            let prerequisites = null;
            const prereqPatterns = [
                /prerequisite[s]?:\s*([^.!?\n\r]+)/gi,
                /prereq[s]?:\s*([^.!?\n\r]+)/gi
            ];
            
            for (const pattern of prereqPatterns) {
                const prereqMatch = courseDescription.match(pattern);
                if (prereqMatch) {
                    let prereqText = prereqMatch[1].trim();
                    prereqText = prereqText.replace(/\s+/g, ' ');
                    prereqText = prereqText.replace(/\.$/, '');
                    
                    if (prereqText.length > 3) {
                        prerequisites = prereqText;
                        break;
                    }
                }
            }
            
            return {
                found: true,
                prerequisites: prerequisites || 'No prerequisites listed',
                courseTitle: courseTitle,
                courseDescription: courseDescription.substring(0, 300),
                method: 'kuali_direct',
                url: window.location.href
            };
        }, courseCode);
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
                    
                    // Look for the specific course description, not just mentions
                    // Pattern: "CS 3250 - Course Title" or similar course header format
                    const courseDescPatterns = [
                        // Pattern 1: "CS 3250 - Algorithms"
                        new RegExp(`${searchCourse.replace(' ', '\\s*')}\\s*[-–—]\\s*([^\\n]+)\\n([\\s\\S]{50,800}?)(?=\\n\\s*[A-Z]{2,4}\\s*\\d{4}|\\n\\s*$|$)`, 'i'),
                        // Pattern 2: "[ CS 3250 Course Name ]"
                        new RegExp(`\\[\\s*${searchCourse.replace(' ', '\\s*')}\\s+([^\\]\\n]+)\\][\\s\\S]{0,50}\\n([\\s\\S]{50,800}?)(?=\\n\\s*\\[|\\n\\s*$|$)`, 'i'),
                        // Pattern 3: Course code at start of line followed by description
                        new RegExp(`^\\s*${searchCourse.replace(' ', '\\s*')}\\s+([^\\n]+)\\n([\\s\\S]{50,800}?)(?=\\n\\s*[A-Z]{2,4}\\s*\\d{4}|\\n\\s*$)`, 'm')
                    ];
                    
                    let courseDescription = null;
                    let courseTitle = null;
                    
                    for (const pattern of courseDescPatterns) {
                        const match = text.match(pattern);
                        if (match) {
                            courseTitle = match[1].trim();
                            courseDescription = match[2].trim();
                            break;
                        }
                    }
                    
                    if (!courseDescription) {
                        return { 
                            prerequisites: 'Course description not found', 
                            method: 'department_scan',
                            foundCourse: false 
                        };
                    }
                    
                    // Now look for prerequisites within this course description only
                    let prerequisites = null;
                    const prereqPatterns = [
                        /prerequisite[s]?:\s*([^.!?\n\r]+)/gi,
                        /prereq[s]?:\s*([^.!?\n\r]+)/gi
                    ];
                    
                    for (const pattern of prereqPatterns) {
                        const prereqMatch = courseDescription.match(pattern);
                        if (prereqMatch) {
                            let prereqText = prereqMatch[1].trim();
                            prereqText = prereqText.replace(/\s+/g, ' ');
                            prereqText = prereqText.replace(/\.$/, '');
                            
                            if (prereqText.length > 3) {
                                prerequisites = prereqText;
                                break;
                            }
                        }
                    }
                    
                    return {
                        prerequisites: prerequisites || 'No prerequisites listed',
                        courseTitle: courseTitle,
                        method: 'department_scan',
                        foundCourse: true,
                        context: courseDescription.substring(0, 300)
                    };
                }, courseCode);

                if (data.foundCourse && data.prerequisites !== 'Not found') {
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
        // Validate prerequisites before parsing
        const validation = this.validatePrerequisites(prereqText, currentCourse);
        if (!validation.valid) {
            return { 
                type: 'error', 
                courses: [], 
                raw: prereqText,
                error: validation.reason
            };
        }

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