const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const path = require('path');

class DirectPDFScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.pdfUrl = 'https://registrar.vanderbilt.edu/documents/Undergraduate_Catalog_2024-25.pdf';
        this.localPdfPath = './catalog.pdf';
    }

    async init() {
        console.log('🚀 Launching browser for PDF processing...');
        this.browser = await puppeteer.launch({ 
            headless: true,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
    }

    async downloadPDF() {
        console.log('📥 Downloading Vanderbilt catalog PDF...');
        
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(this.localPdfPath);
            
            https.get(this.pdfUrl, (response) => {
                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;
                
                response.pipe(file);
                
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
                    process.stdout.write(`\r   📊 Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB)`);
                });
                
                file.on('finish', () => {
                    console.log('\n✅ PDF downloaded successfully');
                    file.close();
                    resolve();
                });
                
                file.on('error', (err) => {
                    fs.unlink(this.localPdfPath, () => {}); // Clean up
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    async extractTextFromPDF() {
        console.log('📄 Extracting text from PDF using browser...');
        
        try {
            // Navigate to the PDF file
            await this.page.goto(`file://${path.resolve(this.localPdfPath)}`, {
                waitUntil: 'networkidle0',
                timeout: 60000
            });

            // Wait for PDF to load
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Extract all text from the PDF
            const pdfText = await this.page.evaluate(() => {
                // Try different methods to get text from PDF viewer
                let text = '';
                
                // Method 1: Direct text selection
                try {
                    const range = document.createRange();
                    range.selectNodeContents(document.body);
                    text = range.toString();
                } catch (e) {
                    // Fallback methods
                }

                // Method 2: Check for text layers in PDF
                if (!text || text.length < 1000) {
                    const textElements = document.querySelectorAll('[data-page] [data-text="true"], .textLayer div, .page-text div');
                    text = Array.from(textElements).map(el => el.textContent).join(' ');
                }

                // Method 3: Get all visible text
                if (!text || text.length < 1000) {
                    text = document.body.innerText || document.body.textContent || '';
                }

                return text;
            });

            console.log(`📊 Extracted ${pdfText.length} characters from PDF`);
            
            if (pdfText.length < 10000) {
                console.log('⚠️  Warning: Extracted text seems short. PDF might need different processing.');
                console.log('💡 Sample of extracted text:');
                console.log(pdfText.substring(0, 500));
            }

            return pdfText;

        } catch (error) {
            console.log('❌ Browser PDF extraction failed:', error.message);
            console.log('💡 Trying alternative PDF processing...');
            return await this.extractTextAlternative();
        }
    }

    async extractTextAlternative() {
        console.log('🔄 Trying alternative PDF text extraction...');
        
        // Try using a PDF viewer page with better text extraction
        try {
            // Use Mozilla's PDF.js viewer
            const pdfJsUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(this.pdfUrl)}`;
            
            await this.page.goto(pdfJsUrl, {
                waitUntil: 'networkidle0', 
                timeout: 60000
            });

            // Wait for PDF to fully load
            await new Promise(resolve => setTimeout(resolve, 10000));

            const pdfText = await this.page.evaluate(() => {
                // Wait for text layer to load
                const textLayers = document.querySelectorAll('.textLayer');
                let allText = '';
                
                textLayers.forEach(layer => {
                    const spans = layer.querySelectorAll('span');
                    spans.forEach(span => {
                        allText += span.textContent + ' ';
                    });
                    allText += '\n';
                });

                return allText;
            });

            console.log(`📊 Alternative extraction: ${pdfText.length} characters`);
            return pdfText;

        } catch (error) {
            console.log('❌ Alternative extraction also failed:', error.message);
            console.log('💡 You may need to manually convert the PDF to text using:');
            console.log('   pdftotext catalog.pdf catalog.txt');
            return '';
        }
    }

    parseCatalogText(catalogText) {
        console.log('Parsing catalog content for courses and prerequisites...');
        
        const results = {
            courses: {},
            prerequisites: {},
            statistics: {
                totalCourses: 0,
                coursesWithPrereqs: 0,
                departments: new Set()
            }
        };

        // Pattern specifically for Vanderbilt catalog format:
        // CS3250 - Algorithms
        // Course Description  
        // Description text. Prerequisite: CS 2201, CS 2212. FALL, SPRING. [3]
        
        const coursePattern = /([A-Z]{2,5})(\d{4}[A-Z]*)\s*-\s*([^\n]+)\n(?:Course Description\n)?([\s\S]*?)(?=\n[A-Z]{2,5}\d{4}|\n\n[A-Z]{2,5}\d{4}|$)/gi;
        
        let match;
        while ((match = coursePattern.exec(catalogText)) !== null) {
            const [fullMatch, dept, number, title, description] = match;
            const courseCode = `${dept} ${number}`;
            
            // Clean up the description
            const cleanDescription = description.trim();
            
            // Extract prerequisites from the description
            const prerequisites = this.extractPrerequisites(cleanDescription, courseCode);
            
            // Extract credit hours from [3] format at end
            const creditMatch = cleanDescription.match(/\[(\d+(?:\.\d+)?)\]$/);
            const creditHours = creditMatch ? parseFloat(creditMatch[1]) : null;
            
            // Extract terms (FALL, SPRING, etc.)
            const termMatch = cleanDescription.match(/\b(FALL|SPRING|SUMMER|WINTER)(?:\s*,\s*(FALL|SPRING|SUMMER|WINTER))*\b/i);
            const terms = termMatch ? termMatch[0] : null;
            
            results.courses[courseCode] = {
                department: dept,
                number: number,
                title: title.trim(),
                creditHours: creditHours,
                terms: terms,
                description: cleanDescription,
                fullMatch: fullMatch
            };

            if (prerequisites) {
                results.prerequisites[courseCode] = prerequisites;
                results.statistics.coursesWithPrereqs++;
            }

            results.statistics.departments.add(dept);
            results.statistics.totalCourses++;
        }

        // Also try a more flexible pattern for courses that might not have "Course Description" header
        const flexiblePattern = /([A-Z]{2,5})\s*(\d{4}[A-Z]*)\s*[–\-]\s*([^\n]+)\n([\s\S]{50,800}?)(?=\n[A-Z]{2,5}\s*\d{4}|$)/gi;
        
        while ((match = flexiblePattern.exec(catalogText)) !== null) {
            const [fullMatch, dept, number, title, description] = match;
            const courseCode = `${dept} ${number}`;
            
            // Skip if we already have this course
            if (results.courses[courseCode]) {
                continue;
            }
            
            const cleanDescription = description.trim();
            const prerequisites = this.extractPrerequisites(cleanDescription, courseCode);
            
            const creditMatch = cleanDescription.match(/\[(\d+(?:\.\d+)?)\]$/);
            const creditHours = creditMatch ? parseFloat(creditMatch[1]) : null;
            
            results.courses[courseCode] = {
                department: dept,
                number: number,
                title: title.trim(),
                creditHours: creditHours,
                description: cleanDescription,
                fullMatch: fullMatch,
                pattern: 'flexible'
            };

            if (prerequisites) {
                results.prerequisites[courseCode] = prerequisites;
                results.statistics.coursesWithPrereqs++;
            }

            results.statistics.departments.add(dept);
            results.statistics.totalCourses++;
        }

        results.statistics.departments = Array.from(results.statistics.departments);
        
        console.log(`Parsing complete:`);
        console.log(`   Total courses: ${results.statistics.totalCourses}`);
        console.log(`   Courses with prerequisites: ${results.statistics.coursesWithPrereqs}`);
        console.log(`   Departments: ${results.statistics.departments.length} (${results.statistics.departments.slice(0, 10).join(', ')}${results.statistics.departments.length > 10 ? '...' : ''})`);
        
        return results;
    }

    extractPrerequisites(text, courseCode) {
        if (!text) return null;

        const prereqPatterns = [
            /prerequisite[s]?:\s*([^.!?\n]+)/gi,
            /prereq[s]?:\s*([^.!?\n]+)/gi,  
            /required:\s*([^.!?\n]+)/gi,
            /completion of\s*([^.!?\n]+)/gi,
            /must have completed\s*([^.!?\n]+)/gi
        ];

        for (const pattern of prereqPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                let prereqText = matches[0]
                    .replace(/prerequisite[s]?:\s*/gi, '')
                    .replace(/prereq[s]?:\s*/gi, '')
                    .replace(/required:\s*/gi, '')
                    .replace(/completion of\s*/gi, '')
                    .replace(/must have completed\s*/gi, '')
                    .trim();

                // Clean up
                prereqText = prereqText.replace(/\s+/g, ' ');
                prereqText = prereqText.replace(/\.$/, '');

                // Validate
                if (prereqText.length > 3 && 
                    !prereqText.toUpperCase().includes(courseCode.toUpperCase())) {
                    
                    return {
                        raw: prereqText,
                        parsed: this.parsePrerequisites(prereqText, courseCode),
                        extractedFrom: 'catalog_pdf'
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
        } else if (lowerText.includes(';') || lowerText.includes(' and ') || courses.length > 1) {
            type = 'and';
        }

        return {
            type: type,
            courses: [...new Set(courses)],
            description: prereqText
        };
    }

    printResults(results, department = null) {
        if (department) {
            console.log(`\n📚 ${department} COURSES WITH PREREQUISITES:`);
            const deptCourses = Object.keys(results.prerequisites)
                .filter(code => code.startsWith(department))
                .sort();

            deptCourses.forEach(courseCode => {
                const prereq = results.prerequisites[courseCode];
                const course = results.courses[courseCode];
                
                console.log(`\n🔸 ${courseCode}: ${course?.title || 'Unknown Title'}`);
                console.log(`   Prerequisites: ${prereq.raw}`);
                console.log(`   Parsed: ${prereq.parsed.courses.join(', ') || 'None'}`);
            });
        } else {
            // Show summary
            console.log('\n📊 CATALOG SCRAPING SUMMARY:');
            console.log('='.repeat(50));
            console.log(`Total courses found: ${results.statistics.totalCourses}`);
            console.log(`Courses with prerequisites: ${results.statistics.coursesWithPrereqs}`);
            console.log(`Departments: ${results.statistics.departments.join(', ')}`);
        }
    }

    generateDatabaseRecords(results) {
        const records = [];
        
        Object.keys(results.prerequisites).forEach(courseCode => {
            const prereq = results.prerequisites[courseCode];
            const course = results.courses[courseCode];
            
            records.push({
                courseId: courseCode,
                prerequisiteText: prereq.raw,
                prerequisiteType: prereq.parsed.type,
                prerequisiteCourses: prereq.parsed.courses,
                courseTitle: course?.title,
                creditHours: course?.creditHours,
                department: course?.department,
                lastUpdated: new Date(),
                dataSource: 'vanderbilt_catalog_pdf',
                extractionMethod: 'direct_pdf_scraping'
            });
        });

        return records;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    // Clean up downloaded file
    cleanup() {
        if (fs.existsSync(this.localPdfPath)) {
            fs.unlinkSync(this.localPdfPath);
            console.log('🗑️  Cleaned up downloaded PDF');
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage:');
        console.log('  node scraper.js catalog.txt           # Parse text file');
        console.log('  node scraper.js catalog.txt --cs      # Show CS courses only');
        console.log('  node scraper.js catalog.txt --json    # Output as JSON');
        console.log('  node scraper.js catalog.txt --math    # Show MATH courses only');
        return;
    }

    const filePath = args[0];
    
    // Check if it's a text file that exists
    if (fs.existsSync(filePath) && filePath.endsWith('.txt')) {
        console.log(`📄 Reading text file: ${filePath}`);
        
        const catalogText = fs.readFileSync(filePath, 'utf8');
        console.log(`📊 Loaded ${catalogText.length} characters from text file`);
        
        const scraper = new DirectPDFScraper();
        const results = scraper.parseCatalogText(catalogText);
        
        if (args.includes('--cs')) {
            scraper.printResults(results, 'CS');
        } else if (args.includes('--json')) {
            const dbRecords = scraper.generateDatabaseRecords(results);
            console.log('\n📄 JSON OUTPUT:');
            console.log(JSON.stringify(dbRecords, null, 2));
        } else if (args.includes('--math')) {
            scraper.printResults(results, 'MATH');
        } else {
            scraper.printResults(results);
            console.log('\n💡 Usage options:');
            console.log('  --cs     Show CS courses only');  
            console.log('  --math   Show MATH courses only');
            console.log('  --json   Output database records as JSON');
        }
        
        return;
    }
    
    // Original PDF processing code (keep as fallback)
    const scraper = new DirectPDFScraper();
    
    try {
        await scraper.init();
        
        // Download PDF
        await scraper.downloadPDF();
        
        // Extract text
        const catalogText = await scraper.extractTextFromPDF();
        
        if (!catalogText || catalogText.length < 1000) {
            console.log('❌ PDF text extraction failed or returned insufficient data');
            console.log('💡 Try manually converting: pdftotext catalog.pdf catalog.txt');
            return;
        }

        // Parse the text
        const results = scraper.parseCatalogText(catalogText);
        
        if (args.includes('--cs')) {
            scraper.printResults(results, 'CS');
        } else if (args.includes('--json')) {
            const dbRecords = scraper.generateDatabaseRecords(results);
            console.log('\n📄 JSON OUTPUT:');
            console.log(JSON.stringify(dbRecords, null, 2));
        } else if (args.includes('--math')) {
            scraper.printResults(results, 'MATH');
        } else {
            scraper.printResults(results);
            console.log('\n💡 Usage options:');
            console.log('  --cs     Show CS courses only');  
            console.log('  --math   Show MATH courses only');
            console.log('  --json   Output database records as JSON');
        }

    } catch (error) {
        console.error('💥 Error:', error.message);
    } finally {
        await scraper.close();
        scraper.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DirectPDFScraper;