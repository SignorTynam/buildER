-- Example schema for SQL Reverse Engineering: university domain.
CREATE TABLE Student (
  id INTEGER PRIMARY KEY,
  student_number VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(160) UNIQUE,
  enrolled_at DATE DEFAULT CURRENT_DATE
);

CREATE TABLE Course (
  id INTEGER PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0)
);

CREATE TABLE Enrollment (
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  enrolled_on DATE DEFAULT CURRENT_DATE,
  grade NUMERIC(4, 2),
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES Student(id),
  FOREIGN KEY (course_id) REFERENCES Course(id)
);
