
const degreeRequirements = {
    "categories": [
        {
            "name": "Core Requirements",
            "availableClasses": [
                { "code": "CS 1101", "hours": 3, "required": true },
                { "code": "CS 1104", "hours": 3, "required": false }
            ]
        },
        {
            "name": "Computer Science Depth",
            "availableClasses": [],
            "minCourses": 5,
            "description": "Courses numbered 3000 or higher in Computer Science.",
            "moreClassesAvailable": true
        }
    ]
};

const courseCategoryMap = {};
if (degreeRequirements && degreeRequirements.categories) {
    degreeRequirements.categories.forEach((category) => {
        const categoryName = category.name;

        // Add courses from availableClasses
        if (category.availableClasses && Array.isArray(category.availableClasses)) {
            category.availableClasses.forEach((course) => {
                if (course.code) {
                    // Normalize course code - handle variations like "CS 1101" vs "CS1101"
                    const code = course.code.toUpperCase().trim().replace(/\s+/g, ' ');
                    // Store both with space and without space for matching
                    if (!courseCategoryMap[code]) {
                        courseCategoryMap[code] = new Set();
                    }
                    courseCategoryMap[code].add(categoryName);

                    // Also store without space
                    const codeNoSpace = code.replace(/\s+/g, '');
                    if (codeNoSpace !== code) {
                        if (!courseCategoryMap[codeNoSpace]) {
                            courseCategoryMap[codeNoSpace] = new Set();
                        }
                        courseCategoryMap[codeNoSpace].add(categoryName);
                    }
                }
            });
        }
    });
}

// Convert Sets to Arrays for easier use
const categoryMapArrays = {};
Object.keys(courseCategoryMap).forEach((code) => {
    categoryMapArrays[code] = Array.from(courseCategoryMap[code]);
});

const getCourseCategories = (course) => {
    const categories = new Set();

    if (!degreeRequirements || !degreeRequirements.categories) {
        return Array.from(categories);
    }

    const courseCode = course.code?.toUpperCase().trim();
    if (!courseCode) return Array.from(categories);

    // Normalize course code (remove spaces, handle variations like "CS1101" vs "CS 1101")
    const normalizedCode = courseCode.replace(/\s+/g, ' ');

    // Check direct mapping (try both with and without spaces)
    if (categoryMapArrays[normalizedCode]) {
        categoryMapArrays[normalizedCode].forEach((cat) => categories.add(cat));
    }

    // Also check without spaces
    const codeNoSpaces = normalizedCode.replace(/\s+/g, '');
    if (categoryMapArrays[codeNoSpaces]) {
        categoryMapArrays[codeNoSpaces].forEach((cat) => categories.add(cat));
    }

    // Check special categories
    degreeRequirements.categories.forEach((category) => {
        if (category.name === 'Computer Science Depth') {
            // Check if it's a CS 3000+ course
            const match = normalizedCode.match(/^CS\s*(\d+)/);
            if (match) {
                const courseNum = parseInt(match[1]);
                if (!isNaN(courseNum) && courseNum >= 3000) {
                    categories.add(category.name);
                }
            }
        }
    });

    return Array.from(categories);
};

console.log("CS 1101:", getCourseCategories({ code: "CS 1101" }));
console.log("CS 3251:", getCourseCategories({ code: "CS 3251" })); // Should be CS Depth
console.log("CS 1100:", getCourseCategories({ code: "CS 1100" })); // Should be empty
