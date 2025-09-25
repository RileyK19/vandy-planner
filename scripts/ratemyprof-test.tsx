// RateMyProfessor API Test Script using rate-my-professor-api-ts
// Install: npm install rate-my-professor-api-ts
// Install dev deps: npm install --save-dev typescript @types/node tsx

import { RateMyProfessor } from "rate-my-professor-api-ts";

async function testProfessorData(collegeName: string, professorName: string) {
    console.log(`🔍 Testing: ${professorName} at ${collegeName}`);
    console.log("=".repeat(60));
    
    try {
        // Create instance with both college and professor
        const rmp = new RateMyProfessor(collegeName, professorName);
        
        console.log("📊 PROFESSOR INFO (aggregate data):");
        console.log("-".repeat(40));
        const professorInfo = await rmp.get_professor_info();
        console.log(JSON.stringify(professorInfo, null, 2));
        
        console.log("\n💬 INDIVIDUAL COMMENTS/REVIEWS:");
        console.log("-".repeat(40));
        const comments = await rmp.get_comments_by_professor();
        console.log(JSON.stringify(comments, null, 2));
        
        console.log("\n🏫 COLLEGE INFO:");
        console.log("-".repeat(40));
        const collegeInfo = await rmp.get_college_info(false);
        console.log(JSON.stringify(collegeInfo, null, 2));
        
        console.log("\n👥 PROFESSOR LIST (first few from college):");
        console.log("-".repeat(40));
        const professorList = await rmp.get_professor_list();
        // Show just first 3 professors to avoid spam
        const limitedList = professorList.slice(0, 3);
        console.log(JSON.stringify(limitedList, null, 2));
        
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

async function testCollegeOnly(collegeName: string) {
    console.log(`\n🏫 Testing college-only instance: ${collegeName}`);
    console.log("=".repeat(60));
    
    try {
        // Create instance with just college
        const rmp = new RateMyProfessor(collegeName);
        
        console.log("🏫 COLLEGE INFO:");
        console.log("-".repeat(40));
        const collegeInfo = await rmp.get_college_info(false);
        console.log(JSON.stringify(collegeInfo, null, 2));
        
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

async function main() {
    console.log("🎓 RateMyProfessor API Data Explorer");
    console.log("=".repeat(60));
    
    // Test cases - modify these
    const testCases = [
        { college: "Vanderbilt University", professor: "John Smith" },
        { college: "City College of New York", professor: "Douglas Troeger" }, // From docs example
        { college: "Harvard University", professor: "Jane Doe" }
    ];
    
    for (const testCase of testCases) {
        await testProfessorData(testCase.college, testCase.professor);
        
        // Wait between requests to be respectful
        console.log("\n⏳ Waiting 2 seconds...\n");
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Test college-only functionality
    await testCollegeOnly("Vanderbilt University");
}

// Run the tests
main().catch(console.error);