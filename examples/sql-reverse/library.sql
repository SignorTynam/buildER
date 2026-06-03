-- Example schema for SQL Reverse Engineering: library loans.
CREATE TABLE Author (
  id INTEGER PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL
);

CREATE TABLE Book (
  id INTEGER PRIMARY KEY,
  isbn VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(220) NOT NULL,
  published_year INTEGER
);

CREATE TABLE BookAuthor (
  book_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  author_order INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (book_id, author_id),
  FOREIGN KEY (book_id) REFERENCES Book(id),
  FOREIGN KEY (author_id) REFERENCES Author(id)
);

CREATE TABLE Member (
  id INTEGER PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL
);

CREATE TABLE Loan (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  loaned_at DATE NOT NULL,
  returned_at DATE,
  FOREIGN KEY (book_id) REFERENCES Book(id),
  FOREIGN KEY (member_id) REFERENCES Member(id)
);
