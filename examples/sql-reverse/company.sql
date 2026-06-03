-- Example schema for SQL Reverse Engineering: company organization.
CREATE TABLE Department (
  id INTEGER PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE Employee (
  id INTEGER PRIMARY KEY,
  department_id INTEGER,
  manager_id INTEGER,
  employee_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  hired_on DATE,
  FOREIGN KEY (department_id) REFERENCES Department(id),
  FOREIGN KEY (manager_id) REFERENCES Employee(id)
);

CREATE TABLE Project (
  id INTEGER PRIMARY KEY,
  department_id INTEGER NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(160) NOT NULL,
  CONSTRAINT uq_project_department_code UNIQUE (department_id, code),
  FOREIGN KEY (department_id) REFERENCES Department(id)
);

CREATE TABLE Assignment (
  employee_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  assigned_on DATE NOT NULL,
  role_name VARCHAR(100),
  PRIMARY KEY (employee_id, project_id),
  FOREIGN KEY (employee_id) REFERENCES Employee(id),
  FOREIGN KEY (project_id) REFERENCES Project(id)
);
