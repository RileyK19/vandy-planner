const { readFileSync } = require('fs');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config();

class AIDegreeParser {
    constructor(catalogTextPath, apiProvider = 'openai') {
        this.catalogTextPath = catalogTextPath;
        this.catalogText = '';
        this.apiProvider = apiProvider;
        
        // API keys from environment
        this.openaiKey = process.env.OPENAI_API_KEY;
        this.anthropicKey = process.env.ANTHROPIC_API_KEY;
        
        // MongoDB connection
        this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        this.dbName = process.env.DB_NAME || 'university';
        this.mongoClient = null;
    }

    async connectMongo() {
        if (!this.mongoClient) {
            console.log('Connecting to MongoDB...');
            this.mongoClient = new MongoClient(this.mongoUri);
            await this.mongoClient.connect();
            console.log('Connected to MongoDB');
        }
        return this.mongoClient.db(this.dbName);
    }

    async closeMongo() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            console.log('MongoDB connection closed');
        }
    }

    loadCatalog() {
        console.log(`Reading catalog from: ${this.catalogTextPath}`);
        this.catalogText = readFileSync(this.catalogTextPath, 'utf8');
        console.log(`Loaded ${this.catalogText.length} characters from catalog`);
    }

    findMajorSection(majorName) {
        console.log(`Searching for ${majorName} section...`);
        
        const lowerCatalog = this.catalogText.toLowerCase();
        const lowerMajor = majorName.toLowerCase();
        
        let bestSection = null;
        let bestScore = 0;
        let searchStart = 0;
        
        while (true) {
            const majorIndex = lowerCatalog.indexOf(lowerMajor, searchStart);
            if (majorIndex === -1) break;
            
            const start = Math.max(0, majorIndex - 200);
            const end = Math.min(this.catalogText.length, majorIndex + 8000);
            const section = this.catalogText.substring(start, end);
            const lowerSection = section.toLowerCase();
            
            let score = 0;
            
            // Check if this is the exact major (not a substring of another major)
            // Look at context around the match
            const contextStart = Math.max(0, majorIndex - 50);
            const contextEnd = Math.min(lowerCatalog.length, majorIndex + lowerMajor.length + 50);
            const context = lowerCatalog.substring(contextStart, contextEnd);
            
            // Penalize if the major name is part of a longer phrase
            // e.g., "Computer Science" found in "Electrical and Computer Engineering"
            const beforeChar = majorIndex > 0 ? lowerCatalog[majorIndex - 1] : ' ';
            const afterChar = majorIndex + lowerMajor.length < lowerCatalog.length ? 
                lowerCatalog[majorIndex + lowerMajor.length] : ' ';
            
            // Check if it's a word boundary (not part of a larger word/phrase)
            const isWordBoundary = /[\s\n,.:;()\[\]{}]/.test(beforeChar) && /[\s\n,.:;()\[\]{}]/.test(afterChar);
            if (!isWordBoundary) {
                console.log(`  Skipping occurrence at position ${majorIndex} - not a word boundary`);
                searchStart = majorIndex + 1;
                continue;
            }
            
            // Penalize if context suggests it's part of another major name
            if (context.includes('electrical and computer') && lowerMajor === 'computer science') {
                console.log(`  Skipping occurrence at position ${majorIndex} - found in ECE context`);
                searchStart = majorIndex + 1;
                continue;
            }
            
            if (lowerSection.includes('major')) score += 3;
            if (lowerSection.includes('bachelor')) score += 3;
            if (lowerSection.includes('degree')) score += 2;
            if (lowerSection.includes('requirement')) score += 5;
            if (lowerSection.includes('credit hours') || lowerSection.includes('credit-hours')) score += 5;
            if (lowerSection.includes('prerequisite')) score += 3;
            if (lowerSection.includes('core') || lowerSection.includes('elective')) score += 4;
            
            const courseCodeMatches = section.match(/[A-Z]{2,4}\s+\d{3,4}/g);
            if (courseCodeMatches) score += courseCodeMatches.length * 2;
            
            if (lowerSection.includes('page ') && lowerSection.includes(' of ')) score -= 10;
            const lineBreaks = (section.match(/\n/g) || []).length;
            const avgLineLength = section.length / (lineBreaks + 1);
            if (avgLineLength < 30) score -= 5;
            
            // Boost score if section title matches exactly
            const sectionTitlePattern = new RegExp(`\\b${lowerMajor}\\s+(major|program|degree|bachelor)`, 'i');
            if (sectionTitlePattern.test(lowerSection)) {
                score += 10;
                console.log(`  Found occurrence at position ${majorIndex}, score: ${score} (EXACT MATCH BONUS)`);
            } else {
                console.log(`  Found occurrence at position ${majorIndex}, score: ${score}`);
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestSection = section;
            }
            
            searchStart = majorIndex + 1;
        }
        
        if (bestSection) {
            console.log(`Selected best section with score ${bestScore} (${bestSection.length} characters)`);
            console.log(`Section starts with: ${bestSection.substring(0, 150).replace(/\n/g, ' ')}...`);
            return bestSection;
        }
        
        return null;
    }

    async parseWithOpenAI(majorSection, majorName) {
        console.log('Parsing with OpenAI API...');
        
        if (!this.openaiKey) {
            throw new Error('OPENAI_API_KEY not found in environment variables');
        }

        const prompt = `You are parsing degree requirements from a university catalog. Extract structured information from the following text about the ${majorName} major.

Return a JSON object with this EXACT structure:
{
  "major": "${majorName}",
  "totalCreditHours": <number or null>,
  "categories": [
    {
      "name": "category name (e.g., 'Core Requirements', 'Technical Electives')",
      "requiredHours": <number of credit hours required for this category>,
      "availableClasses": [
        {
          "code": "DEPT 1234",
          "hours": 3,
          "required": true
        }
      ],
      "minCourses": <number of courses to choose if elective category, null if all required>,
      "description": "brief description"
    }
  ]
}

IMPORTANT RULES:
- If ALL classes in a category must be taken, set "required": true for each class and "minCourses": null
- If it's an elective category (choose X courses), set "required": false for classes and "minCourses": X
- requiredHours should be the total hours needed for that category
- Extract course codes in format "DEPT 1234"
- Parse credit hours for each course (usually 3 or 4)

Catalog text:
${majorSection.substring(0, 6000)}

Return only valid JSON, no additional text.`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { 
                            role: 'system', 
                            content: 'You are a precise parser of university degree requirements. Always return valid JSON with the exact structure requested.' 
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 4000
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`OpenAI API error: ${data.error.message}`);
            }

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('Unexpected API response structure:', JSON.stringify(data, null, 2));
                throw new Error('Invalid response structure from OpenAI API');
            }

            const parsedText = data.choices[0].message.content.trim();
            console.log('\nRaw API Response (first 500 chars):');
            console.log(parsedText.substring(0, 500) + '...');
            
            const cleanedText = parsedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            let parsed;
            try {
                parsed = JSON.parse(cleanedText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError.message);
                console.error('Attempted to parse:', cleanedText.substring(0, 500));
                throw new Error(`Failed to parse JSON response: ${parseError.message}`);
            }

            if (!parsed.categories) {
                console.warn('Warning: No categories found in parsed data');
                parsed.categories = [];
            }

            parsed.source = 'openai_api';
            parsed.catalogYear = '2024-2025';
            parsed.lastUpdated = new Date().toISOString();
            
            console.log(`Successfully parsed ${parsed.categories.length} categories`);
            
            return parsed;
            
        } catch (error) {
            console.error('OpenAI parsing error:', error.message);
            throw error;
        }
    }

    async parseWithAnthropic(majorSection, majorName) {
        console.log('Parsing with Anthropic Claude API...');
        
        if (!this.anthropicKey) {
            throw new Error('ANTHROPIC_API_KEY not found in environment variables');
        }

        const prompt = `Parse the following university catalog text for the ${majorName} major and extract degree requirements into structured JSON.

Return a JSON object with this EXACT structure:
{
  "major": "${majorName}",
  "totalCreditHours": <number or null>,
  "categories": [
    {
      "name": "category name (e.g., 'Core Requirements', 'Technical Electives')",
      "requiredHours": <number of credit hours required for this category>,
      "availableClasses": [
        {
          "code": "DEPT 1234",
          "hours": 3,
          "required": true
        }
      ],
      "minCourses": <number of courses to choose if elective category, null if all required>,
      "description": "brief description"
    }
  ]
}

IMPORTANT RULES:
- If ALL classes in a category must be taken, set "required": true for each class and "minCourses": null
- If it's an elective category (choose X courses), set "required": false for classes and "minCourses": X
- requiredHours should be the total hours needed for that category
- Extract course codes in format "DEPT 1234"
- Parse credit hours for each course (usually 3 or 4)

Catalog text:
${majorSection.substring(0, 6000)}

Return only the JSON object, nothing else.`;

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.anthropicKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 4000,
                    temperature: 0,
                    messages: [
                        { 
                            role: 'user', 
                            content: prompt 
                        }
                    ]
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Anthropic API error: ${data.error.message}`);
            }

            if (!data.content || !data.content[0]) {
                console.error('Unexpected API response structure:', JSON.stringify(data, null, 2));
                throw new Error('Invalid response structure from Anthropic API');
            }

            const parsedText = data.content[0].text.trim();
            console.log('\nRaw API Response (first 500 chars):');
            console.log(parsedText.substring(0, 500) + '...');
            
            const cleanedText = parsedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            let parsed;
            try {
                parsed = JSON.parse(cleanedText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError.message);
                console.error('Attempted to parse:', cleanedText.substring(0, 500));
                throw new Error(`Failed to parse JSON response: ${parseError.message}`);
            }

            if (!parsed.categories) {
                console.warn('Warning: No categories found in parsed data');
                parsed.categories = [];
            }

            parsed.source = 'anthropic_api';
            parsed.catalogYear = '2024-2025';
            parsed.lastUpdated = new Date().toISOString();
            
            console.log(`Successfully parsed ${parsed.categories.length} categories`);
            
            return parsed;
            
        } catch (error) {
            console.error('Anthropic parsing error:', error.message);
            throw error;
        }
    }

    async parseMajor(majorName) {
        this.loadCatalog();
        const majorSection = this.findMajorSection(majorName);
        
        if (!majorSection) {
            throw new Error(`Could not find section for ${majorName} in catalog`);
        }

        console.log(`\nSending section to AI for parsing...`);
        
        if (this.apiProvider === 'openai') {
            return await this.parseWithOpenAI(majorSection, majorName);
        } else if (this.apiProvider === 'anthropic') {
            return await this.parseWithAnthropic(majorSection, majorName);
        } else {
            throw new Error(`Unknown API provider: ${this.apiProvider}`);
        }
    }

    async saveToMongo(requirements) {
        try {
            const db = await this.connectMongo();
            const collection = db.collection('degree_audits');
            
            // Upsert based on major name
            const result = await collection.replaceOne(
                { major: requirements.major },
                requirements,
                { upsert: true }
            );
            
            if (result.upsertedCount > 0) {
                console.log(`\n✅ Inserted new document into MongoDB (degree_audits collection)`);
            } else if (result.modifiedCount > 0) {
                console.log(`\n✅ Updated existing document in MongoDB (degree_audits collection)`);
            } else {
                console.log(`\n✅ Document already exists in MongoDB (no changes needed)`);
            }
            
            return result;
        } catch (error) {
            console.error('MongoDB save error:', error.message);
            throw error;
        }
    }

    printRequirements(requirements) {
        console.log('\n' + '='.repeat(80));
        console.log(`DEGREE REQUIREMENTS: ${requirements.major.toUpperCase()}`);
        console.log(`Total Credit Hours: ${requirements.totalCreditHours || 'Not specified'}`);
        console.log(`Parsed by: ${requirements.source}`);
        console.log('='.repeat(80));

        if (!requirements.categories || requirements.categories.length === 0) {
            console.log('\n⚠️  WARNING: No requirement categories found!');
            console.log('This likely means the AI failed to parse the catalog text properly.');
        } else {
            console.log('\nREQUIREMENT CATEGORIES:');
            requirements.categories.forEach((category, index) => {
                console.log(`\n${index + 1}. ${category.name}`);
                console.log(`   Required Hours: ${category.requiredHours || 'Not specified'}`);
                
                if (category.description) {
                    console.log(`   Description: ${category.description}`);
                }
                
                if (category.minCourses !== null && category.minCourses !== undefined) {
                    console.log(`   ⚠️  Choose ${category.minCourses} course(s) from the following:`);
                } else {
                    console.log(`   ✓ All courses required:`);
                }
                
                if (category.availableClasses && category.availableClasses.length > 0) {
                    console.log(`   Available Classes:`);
                    category.availableClasses.forEach(cls => {
                        const reqMarker = cls.required ? '*' : ' ';
                        console.log(`     ${reqMarker} ${cls.code} (${cls.hours || '?'} hours)`);
                    });
                } else {
                    console.log(`   No classes listed`);
                }
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('Legend: * = Required course');
        console.log('='.repeat(80));
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const catalogPath = args[0] || './catalog.txt';
    const majorName = args[1] || 'Computer Science';
    const apiProvider = args[2] || 'openai';
    
    console.log(`Parsing ${majorName} requirements using ${apiProvider} API`);
    console.log(`Catalog file: ${catalogPath}\n`);
    
    const parser = new AIDegreeParser(catalogPath, apiProvider);
    
    try {
        const requirements = await parser.parseMajor(majorName);
        
        // Print to console
        parser.printRequirements(requirements);
        
        // Save to JSON file
        const fs = require('fs');
        const filename = `${majorName.toLowerCase().replace(/\s+/g, '_')}_requirements.json`;
        fs.writeFileSync(filename, JSON.stringify(requirements, null, 2));
        console.log(`\n📄 Saved to: ${filename}`);
        
        // Save to MongoDB
        await parser.saveToMongo(requirements);
        
    } catch (error) {
        console.error('Error:', error.message);
        
        if (error.message.includes('API_KEY')) {
            console.log('\nMake sure to set your API key in .env file:');
            console.log('  OPENAI_API_KEY=your_key_here');
            console.log('  or');
            console.log('  ANTHROPIC_API_KEY=your_key_here');
        }
    } finally {
        await parser.closeMongo();
    }
}

// Usage examples:
// node scraper.js catalog.txt "Computer Science" openai
// node scraper.js catalog.txt "Mathematics" anthropic

if (require.main === module) {
    main().catch(console.error);
}

module.exports = AIDegreeParser;