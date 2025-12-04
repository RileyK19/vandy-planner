const { readFileSync } = require('fs');

class VanderbiltCatalogScraper {
    constructor(catalogTextPath) {
        this.catalogTextPath = catalogTextPath;
        this.catalogText = '';
    }

    loadCatalog() {
        console.log(`Reading catalog from: ${this.catalogTextPath}`);
        this.catalogText = readFileSync(this.catalogTextPath, 'utf8');
        console.log(`Loaded ${this.catalogText.length} characters from catalog`);
    }

    findMajorSection(majorName) {
        console.log(`Searching for ${majorName} degree requirements...`);
        
        // Look specifically for the Computer Science section and its curriculum requirements
        const majorNameLower = majorName.toLowerCase();
        
        // Find the start of the CS section
        const patterns = [
            // Look for "Computer Science" followed by curriculum content
            new RegExp(`${majorName}[\\s\\S]*?Curriculum Requirements[\\s\\S]*?The B\\.S\\. in ${majorNameLower}[\\s\\S]{1000,5000}?(?=Specimen Curriculum|Second Major|\\n[A-Z][a-z]+\\s+(?:Major|Program))`, 'gi'),
            
            // Fallback: look for curriculum requirements section
            new RegExp(`Curriculum Requirements[\\s\\S]*?The B\\.S\\. in ${majorNameLower}[\\s\\S]{1000,4000}?(?=Specimen Curriculum|\\n\\n[A-Z])`, 'gi'),
            
            // More specific pattern
            new RegExp(`${majorName}[\\s\\S]{100,1000}?Curriculum Requirements[\\s\\S]{100,4000}?(?=Specimen Curriculum|Second Major)`, 'gi')
        ];

        for (let i = 0; i < patterns.length; i++) {
            const matches = this.catalogText.match(patterns[i]);
            if (matches && matches.length > 0) {
                console.log(`Found ${majorName} section using pattern ${i + 1}`);
                return matches[0];
            }
        }

        // Manual extraction for Computer Science if patterns fail
        const csIndex = this.catalogText.indexOf('Computer Science');
        const curriculumIndex = this.catalogText.indexOf('Curriculum Requirements', csIndex);
        const specimenIndex = this.catalogText.indexOf('Specimen Curriculum', curriculumIndex);
        
        if (csIndex !== -1 && curriculumIndex !== -1 && specimenIndex !== -1) {
            const section = this.catalogText.substring(csIndex, specimenIndex);
            console.log(`Found CS section manually (${section.length} characters)`);
            return section;
        }

        return null;
    }

    parseDegreeRequirements(majorSection, majorName) {
        if (!majorSection) {
            console.log(`No section found for ${majorName}`);
            return null;
        }

        console.log('Parsing degree requirements...');

        const requirements = {
            _id: `${majorName.toLowerCase().replace(/\s+/g, '_')}_bs`,
            majorName: majorName,
            degreeType: 'Bachelor of Science',
            school: 'School of Engineering',
            catalogYear: '2024-2025',
            lastUpdated: new Date(),
            
            // Core program info
            totalCreditHours: null,
            requirementCategories: [],
            allCourses: [],
            
            // Additional metadata
            source: 'vanderbilt_catalog',
            honors: null,
            rawText: majorSection.substring(0, 2000) + '...' // Truncate for storage
        };

        // Extract total credit hours
        const creditMatch = majorSection.match(/requires a minimum of (\d+) hours/i);
        if (creditMatch) {
            requirements.totalCreditHours = parseInt(creditMatch[1]);
            console.log(`Found total credit hours: ${requirements.totalCreditHours}`);
        }

        // Parse the structured requirements (1., 2., 3., etc.)
        this.parseStructuredRequirements(majorSection, requirements);

        // Extract honors program info
        const honorsMatch = majorSection.match(/Honors in Computer Science[^.]*\.(.*?)(?=Curriculum Requirements|\n\n)/s);
        if (honorsMatch) {
            requirements.honors = {
                gpaRequirement: 3.5,
                description: honorsMatch[0].trim(),
                requirements: ['Overall GPA of 3.5 or better', 'GPA of 3.5 or better in CS classes', '6 hours of undergraduate research or 6000+ level courses']
            };
        }

        return requirements;
    }

    parseStructuredRequirements(text, requirements) {
        // Look for numbered requirements: "1. Mathematics (17-19 hours)."
        const numberedSections = text.match(/(\d+)\.\s*([^(]+?)\s*\(([^)]+)\)\s*\.?\s*(.*?)(?=\n\d+\.|\n\n|$)/gs);
        
        if (numberedSections) {
            numberedSections.forEach(section => {
                const match = section.match(/(\d+)\.\s*([^(]+?)\s*\(([^)]+)\)\s*\.?\s*(.*)/s);
                if (match) {
                    const [, number, name, hours, description] = match;
                    
                    const category = {
                        order: parseInt(number),
                        name: name.trim(),
                        creditHours: hours.trim(),
                        description: description.trim(),
                        courses: this.extractCoursesFromText(description),
                        subcategories: []
                    };

                    // Parse subcategories (a., b., c., etc.)
                    this.parseSubcategories(description, category);
                    
                    requirements.requirementCategories.push(category);
                    
                    // Add courses to master list
                    requirements.allCourses.push(...category.courses);
                }
            });
        }

        // Remove duplicates from allCourses
        requirements.allCourses = [...new Set(requirements.allCourses)];
        
        console.log(`Parsed ${requirements.requirementCategories.length} requirement categories`);
        console.log(`Found ${requirements.allCourses.length} unique courses`);
    }

    parseSubcategories(text, parentCategory) {
        // Look for lettered subcategories: "a. Calculus/Linear algebra (14–16 hours)."
        const letteredSections = text.match(/([a-z])\.\s*([^(]*?)(?:\(([^)]+)\))?\s*\.?\s*(.*?)(?=\n[a-z]\.|\n\n|$)/gs);
        
        if (letteredSections) {
            letteredSections.forEach(section => {
                const match = section.match(/([a-z])\.\s*([^(]*?)(?:\(([^)]+)\))?\s*\.?\s*(.*)/s);
                if (match) {
                    const [, letter, name, hours, description] = match;
                    
                    const subcategory = {
                        order: letter,
                        name: name.trim(),
                        creditHours: hours ? hours.trim() : null,
                        description: description.trim(),
                        courses: this.extractCoursesFromText(description),
                        options: []
                    };

                    // Parse numbered options within subcategories (i., ii., etc.)
                    this.parseOptions(description, subcategory);
                    
                    parentCategory.subcategories.push(subcategory);
                    parentCategory.courses.push(...subcategory.courses);
                }
            });
        }
    }

    parseOptions(text, parentSubcategory) {
        // Look for roman numeral options: "i. MATH 1300, 1301, 2300, and one of 2410 or 2600, or"
        const romanSections = text.match(/([ivxlc]+)\.\s*(.*?)(?=\n[ivxlc]+\.|\nor\s*$|$)/gs);
        
        if (romanSections) {
            romanSections.forEach(section => {
                const match = section.match(/([ivxlc]+)\.\s*(.*)/s);
                if (match) {
                    const [, roman, description] = match;
                    
                    const option = {
                        order: roman,
                        description: description.trim(),
                        courses: this.extractCoursesFromText(description)
                    };
                    
                    parentSubcategory.options.push(option);
                    parentSubcategory.courses.push(...option.courses);
                }
            });
        }
    }

    extractCoursesFromText(text) {
        if (!text) return [];
        
        // More comprehensive course extraction
        const coursePattern = /([A-Z]{2,5})\s+(\d{4}[A-Z]?)/g;
        const courses = [];
        let match;
        
        while ((match = coursePattern.exec(text)) !== null) {
            courses.push(`${match[1]} ${match[2]}`);
        }
        
        return [...new Set(courses)];
    }

    printRequirements(requirements) {
        if (!requirements) {
            console.log('No requirements found to display');
            return;
        }

        console.log('\n' + '='.repeat(80));
        console.log(`MONGODB DOCUMENT: ${requirements.majorName.toUpperCase()}`);
        console.log(`Document ID: ${requirements._id}`);
        console.log(`Credit Hours: ${requirements.totalCreditHours}`);
        console.log(`Categories: ${requirements.requirementCategories.length}`);
        console.log(`Total Unique Courses: ${requirements.allCourses.length}`);
        console.log('='.repeat(80));

        console.log('\nREQUIREMENT CATEGORIES:');
        requirements.requirementCategories.forEach(cat => {
            console.log(`\n${cat.order}. ${cat.name} (${cat.creditHours})`);
            console.log(`   Courses: ${cat.courses.length > 0 ? cat.courses.join(', ') : 'None specified'}`);
            
            if (cat.subcategories.length > 0) {
                cat.subcategories.forEach(sub => {
                    console.log(`   ${sub.order}. ${sub.name}${sub.creditHours ? ` (${sub.creditHours})` : ''}`);
                    if (sub.courses.length > 0) {
                        console.log(`      Courses: ${sub.courses.join(', ')}`);
                    }
                    
                    if (sub.options.length > 0) {
                        sub.options.forEach(opt => {
                            console.log(`      ${opt.order}. ${opt.description.substring(0, 80)}...`);
                            if (opt.courses.length > 0) {
                                console.log(`         Courses: ${opt.courses.join(', ')}`);
                            }
                        });
                    }
                });
            }
        });

        if (requirements.honors) {
            console.log('\nHONORS PROGRAM:');
            console.log(`   GPA Requirement: ${requirements.honors.gpaRequirement}`);
            console.log(`   Requirements: ${requirements.honors.requirements.join(', ')}`);
        }

        console.log('\n' + '='.repeat(80));
    }

    // Method to generate MongoDB-ready document
    getMongoDocument(requirements) {
        if (!requirements) return null;
        
        // Clean up the document for MongoDB storage
        const mongoDoc = {
            ...requirements,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Ensure all arrays are properly formatted
        mongoDoc.requirementCategories = mongoDoc.requirementCategories.map(cat => ({
            ...cat,
            subcategories: cat.subcategories || [],
            courses: cat.courses || []
        }));
        
        return mongoDoc;
    }

    async scrapeMajor(majorName) {
        this.loadCatalog();
        const majorSection = this.findMajorSection(majorName);
        const requirements = this.parseDegreeRequirements(majorSection, majorName);
        return requirements;
    }
}

// Main execution function
async function main() {
    const args = process.argv.slice(2);
    const catalogPath = args[0] || './catalog.txt';
    const majorName = args[1] || 'Computer Science';
    
    console.log(`Scraping requirements for: ${majorName}`);
    console.log(`Using catalog file: ${catalogPath}`);
    
    try {
        const scraper = new VanderbiltCatalogScraper(catalogPath);
        const requirements = await scraper.scrapeMajor(majorName);
        
        if (requirements) {
            scraper.printRequirements(requirements);
            
            // Save MongoDB-ready document
            const fs = require('fs');
            const mongoDoc = scraper.getMongoDocument(requirements);
            const filename = `${majorName.toLowerCase().replace(/\s+/g, '_')}_mongo.json`;
            fs.writeFileSync(filename, JSON.stringify(mongoDoc, null, 2));
            console.log(`\nSaved MongoDB document to: ${filename}`);
            
            // Also save a simplified version for quick reference
            const simplifiedDoc = {
                _id: mongoDoc._id,
                majorName: mongoDoc.majorName,
                totalCreditHours: mongoDoc.totalCreditHours,
                categories: mongoDoc.requirementCategories.map(cat => ({
                    name: cat.name,
                    creditHours: cat.creditHours,
                    courseCount: cat.courses.length
                })),
                totalCourses: mongoDoc.allCourses.length,
                sampleCourses: mongoDoc.allCourses.slice(0, 10)
            };
            
            fs.writeFileSync('cs_summary.json', JSON.stringify(simplifiedDoc, null, 2));
            console.log(`Saved summary to: cs_summary.json`);
            
        } else {
            console.log(`Failed to find requirements for ${majorName}`);
        }
        
    } catch (error) {
        console.error('Scraping failed:', error.message);
        
        if (error.code === 'ENOENT') {
            console.log('\nMake sure the catalog text file exists.');
            console.log('Usage: node scraper.js [catalog.txt] [Major Name]');
            console.log('Example: node scraper.js catalog.txt "Computer Science"');
        }
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = VanderbiltCatalogScraper;