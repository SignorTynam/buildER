-- Example schema for SQL Reverse Engineering: MySQL-style quoting and identity columns.
CREATE TABLE `user_account` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `email` VARCHAR(160) NOT NULL UNIQUE,
  `display_name` VARCHAR(120) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE `user_profile` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL UNIQUE,
  `bio` TEXT,
  FOREIGN KEY (`user_id`) REFERENCES `user_account`(`id`)
) ENGINE=InnoDB;

CREATE TABLE `login_event` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT,
  `event_message` VARCHAR(255) DEFAULT 'login; accepted',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `user_account`(`id`)
) ENGINE=InnoDB;
