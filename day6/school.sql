PRAGMA foreign_keys = ON;

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL,
    teacher TEXT NOT NULL
);

CREATE TABLE enrolments (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

INSERT INTO students (student_id, name, email) VALUES
    (1, 'Alice Njeri', 'alice@gmail.com'),
    (2, 'Ben Kamau', 'ben@example.com'),
    (3, 'Mary Jane', 'mary@example.com');

INSERT INTO courses (course_id, course_name, teacher) VALUES
    (1, 'Mathematics', 'Dr. Patel'),
    (2, 'English Literature', 'Ms. Garcia'),
    (3, 'Computer Science', 'Mr. Lee');

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 'A'),
    (1, 3, 'B+'),
    (2, 1, 'B'),
    (2, 2, 'A-'),
    (2, 3, 'B+');

-- 1. All courses for one student, selected by the student's name.
SELECT c.course_name
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE s.name = 'Alice Njeri'
ORDER BY c.course_name;

-- 2. All students enrolled on one course.
SELECT s.name
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE c.course_name = 'Mathematics'
ORDER BY s.name;

-- 3. The number of students enrolled on each course.
SELECT c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;

-- 4. Students who have no enrolments.
SELECT s.name
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.student_id IS NULL
ORDER BY s.name;

-- 5. Update one enrolment's grade.
UPDATE enrolments
SET grade = 'A-'
WHERE student_id = 1
  AND course_id = 3;