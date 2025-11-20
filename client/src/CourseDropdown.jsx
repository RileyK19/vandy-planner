import React, { useState, useEffect, useRef } from 'react';
import './CourseDropdown.css';

/**
 * CourseDropdown - A searchable dropdown component for selecting courses
 * 
 * @param {Object} value - Currently selected course { courseCode, courseName }
 * @param {Function} onChange - Callback when a course is selected
 * @param {Array} courses - List of available courses [{ courseCode, courseName }]
 * @param {String} placeholder - Input placeholder text
 * @param {Boolean} error - Whether to show error state
 */
const CourseDropdown = ({ value, onChange, courses = [], placeholder = "Select a course...", error = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredCourses, setFilteredCourses] = useState([]);
    const wrapperRef = useRef(null);

    // Initialize search term from value
    useEffect(() => {
        if (value && value.courseCode) {
            setSearchTerm(value.courseCode);
        } else {
            setSearchTerm('');
        }
    }, [value]);

    // Filter courses based on search term
    useEffect(() => {
        if (!searchTerm) {
            setFilteredCourses(courses);
            return;
        }

        const lowerSearch = searchTerm.toLowerCase();
        const filtered = courses.filter(course =>
            course.courseCode.toLowerCase().includes(lowerSearch) ||
            (course.courseName && course.courseName.toLowerCase().includes(lowerSearch))
        );
        setFilteredCourses(filtered);
    }, [searchTerm, courses]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                // Reset search term to selected value if no selection was made
                if (value && value.courseCode) {
                    setSearchTerm(value.courseCode);
                } else if (!value || !value.courseCode) {
                    setSearchTerm('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [value]);

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        // Clear selection when user types
        if (value && value.courseCode !== e.target.value) {
            // We don't call onChange here to avoid clearing the parent state prematurely
            // or we could call onChange(null) if we want to enforce valid selection
        }
    };

    const handleSelectOption = (course) => {
        setSearchTerm(course.courseCode);
        onChange(course);
        setIsOpen(false);
    };

    return (
        <div className="course-dropdown-wrapper" ref={wrapperRef}>
            <div className="course-dropdown-input-container">
                <input
                    type="text"
                    className={`course-dropdown-input ${error ? 'error' : ''}`}
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                />
                <span className="dropdown-arrow">▼</span>
            </div>

            {isOpen && (
                <div className="course-dropdown-list">
                    {filteredCourses.length > 0 ? (
                        filteredCourses.map((course) => (
                            <div
                                key={course.courseCode}
                                className={`course-dropdown-item ${value && value.courseCode === course.courseCode ? 'selected' : ''}`}
                                onClick={() => handleSelectOption(course)}
                            >
                                <span className="course-code-item">{course.courseCode}</span>
                                {course.courseName && (
                                    <span className="course-name-item"> - {course.courseName}</span>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="course-dropdown-no-results">No courses found</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CourseDropdown;
