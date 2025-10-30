const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor(dbPath = './hospital.db') {
    this.db = new sqlite3.Database(dbPath);
    this.init();
  }

  init() {
    // Create tables
    this.db.serialize(() => {
      // Doctors table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS doctors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          specialization TEXT NOT NULL,
          experience TEXT NOT NULL,
          hospital TEXT NOT NULL
        )
      `);

      // Slots table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctor_id INTEGER NOT NULL,
          slot_time TEXT NOT NULL,
          is_available BOOLEAN DEFAULT 1,
          FOREIGN KEY (doctor_id) REFERENCES doctors (id)
        )
      `);

      // Bookings table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctor_id INTEGER NOT NULL,
          patient_name TEXT NOT NULL,
          slot_time TEXT NOT NULL,
          confirmation_id TEXT UNIQUE NOT NULL,
          booking_timestamp INTEGER NOT NULL,
          server_id INTEGER NOT NULL,
          FOREIGN KEY (doctor_id) REFERENCES doctors (id)
        )
      `);

      // Servers table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS servers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          port INTEGER NOT NULL,
          connections INTEGER DEFAULT 0,
          is_leader BOOLEAN DEFAULT 0,
          last_heartbeat INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active'
        )
      `);
    });
  }

  // Doctors CRUD
  getAllDoctors() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM doctors', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getDoctorById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM doctors WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Slots CRUD
  getAvailableSlots(doctorId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM slots WHERE doctor_id = ? AND is_available = 1',
        [doctorId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  bookSlot(doctorId, slotTime) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE slots SET is_available = 0 WHERE doctor_id = ? AND slot_time = ? AND is_available = 1',
        [doctorId, slotTime],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  // Bookings CRUD
  createBooking(doctorId, patientName, slotTime, confirmationId, serverId) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      this.db.run(
        'INSERT INTO bookings (doctor_id, patient_name, slot_time, confirmation_id, booking_timestamp, server_id) VALUES (?, ?, ?, ?, ?, ?)',
        [doctorId, patientName, slotTime, confirmationId, timestamp, serverId],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, timestamp });
        }
      );
    });
  }

  getAllBookings() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT b.*, d.name as doctor_name, d.specialization 
        FROM bookings b 
        JOIN doctors d ON b.doctor_id = d.id 
        ORDER BY b.booking_timestamp DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Servers CRUD
  getAllServers() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM servers', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  updateServerStatus(serverId, connections, isLeader, status = 'active') {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE servers SET connections = ?, is_leader = ?, last_heartbeat = ?, status = ? WHERE id = ?',
        [connections, isLeader, Date.now(), status, serverId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  updateServerHeartbeat(serverId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE servers SET last_heartbeat = ? WHERE id = ?',
        [Date.now(), serverId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  setLeader(serverId) {
    return new Promise((resolve, reject) => {
      // First, remove leader status from all servers
      this.db.run('UPDATE servers SET is_leader = 0', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Then set the new leader
        this.db.run(
          'UPDATE servers SET is_leader = 1 WHERE id = ?',
          [serverId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      this.db.close(resolve);
    });
  }
}

module.exports = Database;


