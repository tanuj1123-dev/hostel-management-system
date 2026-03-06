-- ============================================
-- HOSTEL MANAGEMENT SYSTEM — DATABASE SCHEMA
-- MySQL 8.0+
-- ============================================

CREATE DATABASE IF NOT EXISTS hostel_db;
USE hostel_db;

-- ── USERS (all roles share this table) ──────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin','student','warden','accountant','maintenance') NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── HOSTELS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hostels (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  type  ENUM('boys','girls','mixed') NOT NULL DEFAULT 'boys'
);

-- ── ROOMS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id   INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  type        ENUM('single','double','triple') NOT NULL DEFAULT 'double',
  capacity    INT NOT NULL DEFAULT 2,
  occupied    INT NOT NULL DEFAULT 0,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id)
);

-- ── HOSTEL APPLICATIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS hostel_applications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  full_name    VARCHAR(100) NOT NULL,
  roll_no      VARCHAR(30) NOT NULL,
  department   VARCHAR(80) NOT NULL,
  year         INT NOT NULL,
  phone        VARCHAR(15) NOT NULL,
  reason       TEXT,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  hostel_id    INT DEFAULT NULL,
  room_id      INT DEFAULT NULL,
  applied_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at  DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  FOREIGN KEY (room_id)   REFERENCES rooms(id)
);

-- ── STUDENT PROFILES (after approval) ───────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL UNIQUE,
  roll_no     VARCHAR(30),
  department  VARCHAR(80),
  year        INT,
  phone       VARCHAR(15),
  hostel_id   INT DEFAULT NULL,
  room_id     INT DEFAULT NULL,
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (hostel_id) REFERENCES hostels(id),
  FOREIGN KEY (room_id)   REFERENCES rooms(id)
);

-- ── FEES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fees (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  student_id          INT NOT NULL,
  amount              DECIMAL(10,2) NOT NULL,
  description         VARCHAR(200) DEFAULT 'Hostel Fee',
  due_date            DATE NOT NULL,
  status              ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  paid_at             DATETIME DEFAULT NULL,
  razorpay_payment_id VARCHAR(100) DEFAULT NULL,
  assigned_by         INT NOT NULL,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id)  REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- ── COMPLAINTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaints (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  student_id   INT NOT NULL,
  category     ENUM('electricity','water','wifi','furniture','cleanliness','other') NOT NULL,
  description  TEXT NOT NULL,
  status       ENUM('pending','in-progress','resolved') NOT NULL DEFAULT 'pending',
  visit_date   DATE DEFAULT NULL,
  visit_time   TIME DEFAULT NULL,
  resolved_at  DATETIME DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- ── LEAVE / OUTPASS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  student_id   INT NOT NULL,
  from_date    DATE NOT NULL,
  to_date      DATE NOT NULL,
  reason       TEXT NOT NULL,
  destination  VARCHAR(200),
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by  INT DEFAULT NULL,
  remarks      TEXT DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at  DATETIME DEFAULT NULL,
  FOREIGN KEY (student_id)  REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- ── ANNOUNCEMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  posted_by   INT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posted_by) REFERENCES users(id)
);

-- ============================================
-- SEED DATA — Default Users
-- Passwords: all "Password@123" (bcrypt hashed)
-- Use: node -e "require('bcryptjs').hash('Password@123',10,(_,h)=>console.log(h))"
-- ============================================

INSERT INTO users (name, email, password, role) VALUES
('Admin User',       'admin@hostel.com',       '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Warden Singh',     'warden@hostel.com',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'warden'),
('Accountant Sharma','accountant@hostel.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'accountant'),
('Maintenance Staff','maintenance@hostel.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'maintenance'),
('Tanuj Kumar',      'student@hostel.com',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student');

INSERT INTO hostels (name, type) VALUES
('Boys Hostel Block A', 'boys'),
('Girls Hostel Block B', 'girls');

INSERT INTO rooms (hostel_id, room_number, type, capacity, occupied) VALUES
(1, '101', 'single', 1, 0),
(1, '102', 'double', 2, 0),
(1, '103', 'double', 2, 0),
(1, '104', 'triple', 3, 0),
(1, '105', 'triple', 3, 0),
(2, '201', 'single', 1, 0),
(2, '202', 'double', 2, 0),
(2, '203', 'double', 2, 0);

INSERT INTO student_profiles (user_id, roll_no, department, year, phone) VALUES
(5, '241032048', 'Computer Science', 2, '9876543210');