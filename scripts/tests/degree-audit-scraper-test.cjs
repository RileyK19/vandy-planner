const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// MongoDB Schemas
const DegreeRequirementSchema = new mongoose.Schema({
  major: { type: String, required: true, index: true },
  department: String,
  degreeType: { type: String, default: 'Bachelor' },
  catalogYear: { type: String, required: true },
  creditHours: Number,
  lastUpdated: { type: Date, default: Date.now },
  source: String,
  
  // Core requirements
  coreRequirements: [{
    category: String,
    description: String,
    courses: [String],
    creditHours: Number,
    notes: String
  }],
  
  // All course requirements
  courseRequirements: [{
    courseCode: { type: String, required: true },
    courseTitle: String,
    creditHours: Number,
    category: String, // 'core', 'elective', 'prerequisite', etc.
    required: { type: Boolean, default: true }
  }],
  
  // Parsed requirements structure
  parsedRequirements: mongoose.Schema.Types.Mixed,
  
  // Raw scraped data for reference
  rawData: mongoose.Schema.Types.Mixed
});

const CourseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, unique: true },
  subject: String,
  courseNumber: String,
  title: String,
  description: String,
  creditHours: Number,
  prerequisites: [String],
  corequisites: [String],
  majors: [String], // Which majors require this course
  lastUpdated: { type: Date, default: Date.now }
});

const DegreeRequirement = mongoose.model('DegreeRequirement', DegreeRequirementSchema);
const Course = mongoose.model('Course', CourseSchema);

class VanderbiltDegreeScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.app = null;
        this.server = null;
    }

    async init() {
        console.log('🚀 Launching browser and connecting to database...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');

        // Launch browser
        this.browser = await puppeteer.launch({ 
            headless: true,
            defaultViewport: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        this.page = await this.browser.newPage();
        
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });
    }

    async waitForKualiLoad() {
        console.log('⏳ Waiting for Kuali catalog to load...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const selectors = [
            '.kuali-catalog-content', '[data-testid="content"]', '.catalog-content',
            '#catalog-content', 'main', 'article', '.main-content', '[role="main"]'
        ];
        
        let contentFound = false;
        for (const selector of selectors) {
            try {
                await this.page.waitForSelector(selector, { timeout: 3000 });
                console.log(`✅ Content loaded with selector: ${selector}`);
                contentFound = true;
                break;
            } catch (error) {
                continue;
            }
        }
        
        if (!contentFound) {
            console.log('⚠️  No specific content selectors found, proceeding anyway');
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
            await this.page.waitForLoadState?.('networkidle') || 
                  await this.page.waitForFunction(() => document.readyState === 'complete');
        } catch (error) {
            console.log('⚠️  Network idle check failed, continuing');
        }
    }

    async scrapePageContent(url) {
        console.log(`🌐 Navigating to: ${url}`);
        
        try {
            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            if (url.includes('#/')) {
                console.log('🔄 Hash navigation detected, waiting for content...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            await this.waitForKualiLoad();

            console.log('🔍 Extracting page content...');
            
            const pageTitle = await this.page.title();
            const currentUrl = this.page.url();
            console.log(`📄 Page title: ${pageTitle}`);

            const pageData = await this.page.evaluate(() => {
                function cleanText(text) {
                    return text.replace(/\s+/g, ' ').trim();
                }

                const basicInfo = {
                    title: document.title,
                    url: window.location.href,
                    bodyText: cleanText(document.body.innerText || ''),
                    bodyLength: document.body.innerText?.length || 0
                };

                const contentSelectors = [
                    '.kuali-catalog-content', '[data-testid="content"]', '.catalog-content', 
                    '#catalog-content', 'main', '.main-content', 'article', '[role="main"]',
                    '.content', '#content', '.page-content', '.entry-content'
                ];

                let mainContent = null;
                let foundSelector = '';
                
                for (const selector of contentSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.innerText?.trim().length > 100) {
                        mainContent = element;
                        foundSelector = selector;
                        break;
                    }
                }

                if (!mainContent) {
                    mainContent = document.body;
                    foundSelector = 'body';
                }

                const data = {
                    ...basicInfo,
                    mainText: cleanText(mainContent.innerText || ''),
                    contentSelector: foundSelector,
                    headings: [],
                    lists: [],
                    tables: [],
                    paragraphs: []
                };

                if (data.mainText.length < 50) {
                    return data;
                }

                // Extract headings
                mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                    const text = cleanText(heading.innerText);
                    if (text) {
                        data.headings.push({
                            level: heading.tagName.toLowerCase(),
                            text: text
                        });
                    }
                });

                // Extract lists
                mainContent.querySelectorAll('ul, ol').forEach(list => {
                    const items = [];
                    list.querySelectorAll('li').forEach(li => {
                        const text = cleanText(li.innerText);
                        if (text) items.push(text);
                    });
                    if (items.length > 0) {
                        data.lists.push({
                            type: list.tagName.toLowerCase(),
                            items: items
                        });
                    }
                });

                // Extract tables
                mainContent.querySelectorAll('table').forEach(table => {
                    const rows = [];
                    table.querySelectorAll('tr').forEach(tr => {
                        const cells = [];
                        tr.querySelectorAll('td, th').forEach(cell => {
                            const text = cleanText(cell.innerText);
                            if (text) cells.push(text);
                        });
                        if (cells.length > 0) rows.push(cells);
                    });
                    if (rows.length > 0) data.tables.push(rows);
                });

                // Extract paragraphs
                mainContent.querySelectorAll('p, div').forEach(element => {
                    const text = cleanText(element.innerText);
                    if (text.length > 20 && !data.paragraphs.includes(text)) {
                        data.paragraphs.push(text);
                    }
                });

                return data;
            });
            
            console.log(`📊 Extracted ${pageData.mainText.length} characters of content`);
            return pageData;

        } catch (error) {
            console.error(`❌ Error scraping page: ${error.message}`);
            return null;
        }
    }

    parseDegreeRequirements(pageData, majorName = null) {
        if (!pageData) return null;

        console.log('🔍 Parsing degree requirements...');

        const requirements = {
            major: majorName || this.extractMajorName(pageData),
            catalogYear: '2025-2026',
            lastUpdated: new Date(),
            source: pageData.url,
            rawData: pageData,
            parsedRequirements: {},
            courseRequirements: [],
            coreRequirements: [],
            creditHours: null
        };

        // Extract credit hours
        const creditMatch = pageData.mainText.match(/(\d+)\s*(?:semester\s*)?(?:credit\s*)?hours?/i);
        if (creditMatch) {
            requirements.creditHours = parseInt(creditMatch[1]);
        }

        // Extract course codes with enhanced parsing
        const coursePattern = /([A-Z]{2,5})\s+(\d{4}[A-Z]?)/g;
        const courses = new Set();
        let match;
        while ((match = coursePattern.exec(pageData.mainText)) !== null) {
            courses.add(`${match[1]} ${match[2]}`);
        }

        // Parse course requirements with categories
        const courseRequirements = [];
        courses.forEach(courseCode => {
            const [subject, number] = courseCode.split(' ');
            courseRequirements.push({
                courseCode: courseCode,
                subject: subject,
                courseNumber: number,
                category: this.determineCourseCategory(courseCode, pageData.mainText),
                required: true
            });
        });
        requirements.courseRequirements = courseRequirements;

        // Parse core requirements from lists
        pageData.lists.forEach((list, index) => {
            if (list.items.length > 0) {
                const category = this.determineCategoryFromContext(list.items, index);
                requirements.coreRequirements.push({
                    category: category,
                    description: `Requirement group ${index + 1}`,
                    courses: list.items.filter(item => /[A-Z]{2,5}\s+\d{4}/.test(item)),
                    notes: list.items.join('; ')
                });
                
                requirements.parsedRequirements[`requirement_group_${index + 1}`] = {
                    type: list.type,
                    category: category,
                    items: list.items
                };
            }
        });

        return requirements;
    }

    determineCourseCategory(courseCode, fullText) {
        const lowerText = fullText.toLowerCase();
        if (lowerText.includes('core') && lowerText.includes(courseCode.toLowerCase())) return 'core';
        if (lowerText.includes('elective') && lowerText.includes(courseCode.toLowerCase())) return 'elective';
        if (lowerText.includes('prerequisite') && lowerText.includes(courseCode.toLowerCase())) return 'prerequisite';
        return 'required';
    }

    determineCategoryFromContext(items, index) {
        const text = items.join(' ').toLowerCase();
        if (text.includes('core')) return 'Core Requirements';
        if (text.includes('elective')) return 'Elective Requirements';
        if (text.includes('math')) return 'Mathematics Requirements';
        if (text.includes('science')) return 'Science Requirements';
        if (text.includes('writing')) return 'Writing Requirements';
        return `Requirement Category ${index + 1}`;
    }

    extractMajorName(pageData) {
        const title = pageData.title;
        if (title) {
            const match = title.match(/([A-Za-z\s]+)(?:\s*-\s*|,|\|)/);
            if (match) return match[1].trim();
        }

        if (pageData.headings.length > 0) {
            return pageData.headings[0].text;
        }

        return 'Unknown Major';
    }

    async saveToDatabase(requirements) {
        try {
            console.log('💾 Saving to database...');

            // Save or update degree requirements
            const degreeReq = await DegreeRequirement.findOneAndUpdate(
                { 
                    major: requirements.major, 
                    catalogYear: requirements.catalogYear 
                },
                requirements,
                { upsert: true, new: true }
            );

            console.log(`✅ Saved degree requirements for ${requirements.major}`);

            // Save individual courses
            let coursesCreated = 0;
            let coursesUpdated = 0;

            for (const courseReq of requirements.courseRequirements) {
                try {
                    const existingCourse = await Course.findOne({ courseCode: courseReq.courseCode });
                    
                    if (existingCourse) {
                        // Add this major to the course if not already included
                        if (!existingCourse.majors.includes(requirements.major)) {
                            existingCourse.majors.push(requirements.major);
                            await existingCourse.save();
                            coursesUpdated++;
                        }
                    } else {
                        // Create new course
                        const newCourse = new Course({
                            courseCode: courseReq.courseCode,
                            subject: courseReq.subject,
                            courseNumber: courseReq.courseNumber,
                            majors: [requirements.major],
                            lastUpdated: new Date()
                        });
                        await newCourse.save();
                        coursesCreated++;
                    }
                } catch (courseError) {
                    console.error(`⚠️  Error saving course ${courseReq.courseCode}:`, courseError.message);
                }
            }

            console.log(`✅ Courses processed: ${coursesCreated} created, ${coursesUpdated} updated`);

            return {
                degreeRequirement: degreeReq,
                coursesCreated,
                coursesUpdated,
                totalCourses: requirements.courseRequirements.length
            };

        } catch (error) {
            console.error('❌ Database save error:', error);
            throw error;
        }
    }

    async setupAPI() {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());

        // Get all degree requirements
        this.app.get('/api/degrees', async (req, res) => {
            try {
                const degrees = await DegreeRequirement.find()
                    .select('-rawData') // Exclude raw data for performance
                    .sort({ major: 1 });
                res.json(degrees);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get specific degree requirements
        this.app.get('/api/degrees/:major', async (req, res) => {
            try {
                const degree = await DegreeRequirement.findOne({ 
                    major: new RegExp(req.params.major, 'i') 
                });
                if (!degree) {
                    return res.status(404).json({ error: 'Degree not found' });
                }
                res.json(degree);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get all courses for a specific major
        this.app.get('/api/degrees/:major/courses', async (req, res) => {
            try {
                const degree = await DegreeRequirement.findOne({ 
                    major: new RegExp(req.params.major, 'i') 
                });
                if (!degree) {
                    return res.status(404).json({ error: 'Degree not found' });
                }
                
                // Get detailed course information
                const courseCodes = degree.courseRequirements.map(cr => cr.courseCode);
                const courses = await Course.find({ 
                    courseCode: { $in: courseCodes } 
                });

                res.json({
                    major: degree.major,
                    totalCourses: courseCodes.length,
                    courseRequirements: degree.courseRequirements,
                    detailedCourses: courses
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get all courses
        this.app.get('/api/courses', async (req, res) => {
            try {
                const { subject, major } = req.query;
                let query = {};
                
                if (subject) {
                    query.subject = new RegExp(subject, 'i');
                }
                if (major) {
                    query.majors = new RegExp(major, 'i');
                }

                const courses = await Course.find(query).sort({ courseCode: 1 });
                res.json(courses);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Trigger scraping for a specific major
        this.app.post('/api/scrape/:major', async (req, res) => {
            try {
                const majorName = req.params.major;
                const url = MAJOR_URLS[majorName] || req.body.url;
                
                if (!url) {
                    return res.status(400).json({ 
                        error: 'URL required for unknown major',
                        availableMajors: Object.keys(MAJOR_URLS)
                    });
                }

                const requirements = await this.scrapeMajor(url, majorName);
                if (!requirements) {
                    return res.status(500).json({ error: 'Failed to scrape requirements' });
                }

                const result = await this.saveToDatabase(requirements);
                res.json({
                    success: true,
                    major: majorName,
                    ...result
                });

            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'healthy',
                database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            });
        });

        const PORT = process.env.PORT || 3001;
        this.server = this.app.listen(PORT, () => {
            console.log(`🌐 API server running on port ${PORT}`);
        });
    }

    async scrapeMajor(url, majorName = null) {
        const pageData = await this.scrapePageContent(url);
        if (!pageData) return null;

        const requirements = this.parseDegreeRequirements(pageData, majorName);
        return requirements;
    }

    async scrapeAllMajors() {
        console.log('🎯 Starting bulk scraping of all majors...');
        const results = [];

        for (const [majorName, url] of Object.entries(MAJOR_URLS)) {
            try {
                console.log(`\n📚 Scraping ${majorName}...`);
                const requirements = await this.scrapeMajor(url, majorName);
                
                if (requirements) {
                    const dbResult = await this.saveToDatabase(requirements);
                    results.push({
                        major: majorName,
                        success: true,
                        ...dbResult
                    });
                    console.log(`✅ ${majorName} completed successfully`);
                } else {
                    results.push({
                        major: majorName,
                        success: false,
                        error: 'Failed to scrape'
                    });
                    console.log(`❌ ${majorName} failed`);
                }

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`💥 Error scraping ${majorName}:`, error.message);
                results.push({
                    major: majorName,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }
        if (this.server) {
            this.server.close();
            console.log('🔒 Server closed');
        }
        await mongoose.disconnect();
        console.log('🔒 Database disconnected');
    }
}

// Predefined URLs for common majors
const MAJOR_URLS = {
    'Computer Science': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933594c9200f84cd3b942',
    'Mathematics': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933604c9200f84cd3bac5?q=mathematics&&limit=20&skip=0&bc=true&bcCurrent=Mathematics&bcItemType=institutional-information',
    'Biomedical Engineering': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933644c9200f84cd3b9bc',
    'Chemistry': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933584c9200f84cd3b91e',
    'Physics': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933614c9200f84cd3b992',
    'Economics': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933584c9200f84cd3b920',
    'Psychology': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933614c9200f84cd3b994'
};

// Main execution function
async function main() {
    const scraper = new VanderbiltDegreeScraper();
    
    try {
        await scraper.init();
        await scraper.setupAPI();
        
        const args = process.argv.slice(2);
        const command = args[0] || 'api';
        
        if (command === 'scrape-all') {
            const results = await scraper.scrapeAllMajors();
            console.log('\n📊 SCRAPING SUMMARY:');
            results.forEach(result => {
                console.log(`${result.success ? '✅' : '❌'} ${result.major}: ${result.success ? `${result.totalCourses} courses` : result.error}`);
            });
        } else if (command === 'scrape' && args[1]) {
            const majorName = args[1];
            const requirements = await scraper.scrapeMajor(MAJOR_URLS[majorName] || args[2], majorName);
            if (requirements) {
                await scraper.saveToDatabase(requirements);
                console.log(`✅ Successfully scraped and saved ${majorName}`);
            }
        } else {
            console.log('🌐 API server started. Available endpoints:');
            console.log('  GET  /api/degrees - List all degrees');
            console.log('  GET  /api/degrees/:major - Get specific degree');
            console.log('  GET  /api/degrees/:major/courses - Get courses for major');
            console.log('  GET  /api/courses - List all courses');
            console.log('  POST /api/scrape/:major - Trigger scraping');
            console.log('  GET  /api/health - Health check');
            console.log('\n🎯 Usage:');
            console.log('  node script.js api                    - Start API server');
            console.log('  node script.js scrape-all            - Scrape all majors');
            console.log('  node script.js scrape "Major Name"   - Scrape specific major');
        }
        
        // Keep the process running for API mode
        if (command === 'api') {
            process.on('SIGINT', async () => {
                console.log('\n🛑 Shutting down gracefully...');
                await scraper.close();
                process.exit(0);
            });
        } else {
            // Close for scraping commands
            setTimeout(async () => {
                await scraper.close();
            }, 5000);
        }
        
    } catch (error) {
        console.error('💥 Scraping failed:', error);
        await scraper.close();
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = VanderbiltDegreeScraper;