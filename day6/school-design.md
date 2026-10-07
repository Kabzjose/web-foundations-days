# School database design

## Tables

- **students** stores one row for each student. Its email address is required and
  unique, so two students cannot share the same email.
- **courses** stores the courses offered by the school and the teacher for each
  course.
- **enrolments** records a student's enrolment on a course and the grade earned.
  It uses the pair of student and course IDs as its primary key, which prevents
  the same student from enrolling on the same course twice.

## Relationships

One student can have many enrolments, and one course can have many enrolments.
These are both one-to-many relationships from `students` and `courses` to
`enrolments`. Taken together, students and courses have a many-to-many
relationship: one student can take many courses, and one course can contain many
students. The `enrolments` join table is needed to represent each pairing and
to store relationship-specific data such as the grade.

## Index

I would add an index on `enrolments(course_id)`. Queries that list all students
on a particular course and queries that count students per course filter or
join using `course_id`, so this index would make those lookups faster as the
number of enrolments grows. SQLite already indexes the composite primary key,
but that index starts with `student_id` and is not as effective for
`course_id`-only lookups.

## SQL or NoSQL?

I would choose SQL for this system. Students, courses, and enrolments have
well-defined fields and strong relationships, and foreign keys and a composite
primary key enforce important rules such as valid references and no duplicate
enrolments. The reporting queries also need joins, grouping, and counts, which
are natural in a relational database. A NoSQL database could work at a much
larger or less structured scale, but it would require more application-side
work to maintain these relationships and constraints.
