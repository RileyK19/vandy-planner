const puppeteer = require('puppeteer');

class VanderbiltKualiScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        console.log('🚀 Launching browser...');
        this.browser = await puppeteer.launch({ 
            headless: true, // Set to false if you want to see the browser
            defaultViewport: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        this.page = await this.browser.newPage();
        
        // Set a realistic user agent
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Remove webdriver property
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });
    }

    async waitForKualiLoad() {
        console.log('⏳ Waiting for Kuali catalog to load...');
        
        // Wait for page to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Wait for various possible loading indicators or content
        const selectors = [
            '.kuali-catalog-content',
            '[data-testid="content"]', 
            '.catalog-content',
            '#catalog-content',
            'main',
            'article',
            '.main-content',
            '[role="main"]'
        ];
        
        let contentFound = false;
        for (const selector of selectors) {
            try {
                await this.page.waitForSelector(selector, { timeout: 3000 });
                console.log(`✅ Content loaded with selector: ${selector}`);
                contentFound = true;
                break;
            } catch (error) {
                // Continue to next selector
                continue;
            }
        }
        
        if (!contentFound) {
            console.log('⚠️  No specific content selectors found, proceeding anyway');
        }
        
        // Wait for dynamic content to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Wait for network to be idle
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

            // For hash-based navigation, we need to handle it differently
            if (url.includes('#/')) {
                console.log('🔄 Hash navigation detected, waiting for content...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            await this.waitForKualiLoad();

            // Extract all text content from the page
            console.log('🔍 Extracting page content...');
            
            // First, let's see what we're working with
            const pageTitle = await this.page.title();
            const currentUrl = this.page.url();
            console.log(`📄 Page title: ${pageTitle}`);
            console.log(`🔗 Current URL: ${currentUrl}`);
            const pageData = await this.page.evaluate(() => {
                // Helper function to clean text
                function cleanText(text) {
                    return text.replace(/\s+/g, ' ').trim();
                }

                // Get basic page info first
                const basicInfo = {
                    title: document.title,
                    url: window.location.href,
                    bodyText: cleanText(document.body.innerText || ''),
                    bodyLength: document.body.innerText?.length || 0
                };

                console.log('Page has', basicInfo.bodyLength, 'characters of content');

                // Try to find the main content area with more selectors
                const contentSelectors = [
                    '.kuali-catalog-content',
                    '[data-testid="content"]',
                    '.catalog-content', 
                    '#catalog-content',
                    'main',
                    '.main-content',
                    'article',
                    '[role="main"]',
                    '.content',
                    '#content',
                    '.page-content',
                    '.entry-content'
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

                // Fallback to body if no main content found
                if (!mainContent) {
                    mainContent = document.body;
                    foundSelector = 'body';
                }

                console.log('Using content from selector:', foundSelector);

                // Extract structured data
                const data = {
                    ...basicInfo,
                    mainText: cleanText(mainContent.innerText || ''),
                    contentSelector: foundSelector,
                    headings: [],
                    lists: [],
                    tables: [],
                    paragraphs: []
                };

                // Only proceed if we have substantial content
                if (data.mainText.length < 50) {
                    console.log('Warning: Very little content found');
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

                // Extract substantial paragraphs
                mainContent.querySelectorAll('p, div').forEach(element => {
                    const text = cleanText(element.innerText);
                    if (text.length > 20 && !data.paragraphs.includes(text)) {
                        data.paragraphs.push(text);
                    }
                });

                return data;
            });
            
            console.log(`📊 Extracted ${pageData.mainText.length} characters of content`);
            console.log(`📋 Found ${pageData.headings.length} headings, ${pageData.lists.length} lists, ${pageData.tables.length} tables`);

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
            lastUpdated: new Date().toISOString(),
            source: pageData.url,
            rawData: pageData,
            parsedRequirements: {},
            courseRequirements: [],
            creditHours: null
        };

        // Extract credit hours
        const creditMatch = pageData.mainText.match(/(\d+)\s*(?:semester\s*)?(?:credit\s*)?hours?/i);
        if (creditMatch) {
            requirements.creditHours = parseInt(creditMatch[1]);
        }

        // Look for course codes (pattern: LETTERS NUMBERS)
        const coursePattern = /([A-Z]{2,5})\s+(\d{4}[A-Z]?)/g;
        const courses = [];
        let match;
        while ((match = coursePattern.exec(pageData.mainText)) !== null) {
            courses.push(`${match[1]} ${match[2]}`);
        }
        requirements.courseRequirements = [...new Set(courses)]; // Remove duplicates

        // Parse structured requirements from lists and headings
        pageData.lists.forEach((list, index) => {
            if (list.items.length > 0) {
                requirements.parsedRequirements[`requirement_group_${index + 1}`] = {
                    type: list.type,
                    items: list.items
                };
            }
        });

        // Parse tables if any
        pageData.tables.forEach((table, index) => {
            requirements.parsedRequirements[`table_${index + 1}`] = table;
        });

        return requirements;
    }

    extractMajorName(pageData) {
        // Try to extract major name from title or headings
        const title = pageData.title;
        if (title) {
            const match = title.match(/([A-Za-z\s]+)(?:\s*-\s*|,|\|)/);
            if (match) return match[1].trim();
        }

        // Try from first heading
        if (pageData.headings.length > 0) {
            return pageData.headings[0].text;
        }

        return 'Unknown Major';
    }

    printRequirements(requirements) {
        console.log('\n' + '='.repeat(80));
        console.log(`📖 ${requirements.major.toUpperCase()} DEGREE REQUIREMENTS`);
        console.log(`📅 Catalog Year: ${requirements.catalogYear}`);
        console.log(`💳 Credit Hours: ${requirements.creditHours || 'Not specified'}`);
        console.log(`🔗 Source: ${requirements.source}`);
        console.log('='.repeat(80));

        if (requirements.courseRequirements.length > 0) {
            console.log('\n📚 COURSE REQUIREMENTS FOUND:');
            requirements.courseRequirements.forEach(course => {
                console.log(`   • ${course}`);
            });
        }

        console.log('\n📋 PARSED REQUIREMENTS:');
        Object.entries(requirements.parsedRequirements).forEach(([key, value]) => {
            console.log(`\n🔸 ${key.replace(/_/g, ' ').toUpperCase()}:`);
            if (Array.isArray(value)) {
                // Table data
                value.forEach(row => {
                    console.log(`   ${row.join(' | ')}`);
                });
            } else if (value.items) {
                // List data
                value.items.forEach(item => {
                    console.log(`   • ${item}`);
                });
            }
        });

        console.log('\n📄 FULL TEXT CONTENT:');
        console.log(requirements.rawData.mainText.substring(0, 1000) + '...');
        console.log('='.repeat(80));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }
    }

    // Method to scrape any major by URL
    async scrapeMajor(url, majorName = null) {
        const pageData = await this.scrapePageContent(url);
        if (!pageData) return null;

        const requirements = this.parseDegreeRequirements(pageData, majorName);
        return requirements;
    }
}

// Predefined URLs for common majors
const MAJOR_URLS = {
    'Computer Science': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933594c9200f84cd3b942',
    'Mathematics': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/6819335c4c9200f84cd3b96e',
    'Biomedical Engineering': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933644c9200f84cd3b9bc',
    'Chemistry': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933584c9200f84cd3b91e',
    'Physics': 'https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/content/681933614c9200f84cd3b992',
    // Add more as needed - you can find these by browsing the catalog
};

// Main execution function
async function main() {
    const scraper = new VanderbiltKualiScraper();
    
    try {
        await scraper.init();
        
        // Get the major to scrape from command line arguments
        const args = process.argv.slice(2);
        const majorName = args[0] || 'Computer Science';
        
        console.log(`🎯 Scraping requirements for: ${majorName}`);
        
        let url = MAJOR_URLS[majorName];
        if (!url) {
            console.log(`❓ URL for ${majorName} not found. Using Computer Science as example.`);
            console.log('Available majors:', Object.keys(MAJOR_URLS).join(', '));
            url = MAJOR_URLS['Computer Science'];
        }
        
        const requirements = await scraper.scrapeMajor(url, majorName);
        
        if (requirements) {
            scraper.printRequirements(requirements);
            
            // Optionally save to JSON
            // const fs = require('fs');
            // fs.writeFileSync(`${majorName.toLowerCase().replace(/\s+/g, '_')}_requirements.json`, JSON.stringify(requirements, null, 2));
        } else {
            console.log('❌ Failed to scrape requirements');
        }
        
    } catch (error) {
        console.error('💥 Scraping failed:', error);
    } finally {
        await scraper.close();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

// Usage examples:
// node degree-audit-scraper-test.cjs "Computer Science"

module.exports = VanderbiltKualiScraper;