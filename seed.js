const Database = require('./database');
const { v4: uuidv4 } = require('uuid');

class DatabaseSeeder {
  constructor() {
    this.db = new Database();
  }

  async seed() {
    try {
      console.log('🌱 Starting database seeding...');

      // Clear existing data
      await this.clearData();

      // Seed doctors
      await this.seedDoctors();

      // Seed slots
      await this.seedSlots();

      // Seed servers
      await this.seedServers();

      console.log('✅ Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Error seeding database:', error);
    } finally {
      await this.db.close();
    }
  }

  async clearData() {
    console.log('🧹 Clearing existing data...');
    return new Promise((resolve, reject) => {
      this.db.db.serialize(() => {
        this.db.db.run('DELETE FROM bookings');
        this.db.db.run('DELETE FROM slots');
        this.db.db.run('DELETE FROM doctors');
        this.db.db.run('DELETE FROM servers');
        resolve();
      });
    });
  }

  async seedDoctors() {
    console.log('👨‍⚕️ Seeding doctors...');
    const doctors = [
      { id: 1, name: 'Dr. Aisha Khan', specialization: 'Cardiologist', experience: '12 years', hospital: 'Apollo Hospital' },
      { id: 2, name: 'Dr. Rohan Patel', specialization: 'Dermatologist', experience: '10 years', hospital: 'Fortis Hospital' },
      { id: 3, name: 'Dr. Neha Sharma', specialization: 'Pediatrician', experience: '8 years', hospital: 'Manipal Hospital' },
      { id: 4, name: 'Dr. Nikhil Rao', specialization: 'Neurologist', experience: '15 years', hospital: 'Max Hospital' }
    ];

    for (const doctor of doctors) {
      await new Promise((resolve, reject) => {
        this.db.db.run(
          'INSERT OR REPLACE INTO doctors (id, name, specialization, experience, hospital) VALUES (?, ?, ?, ?, ?)',
          [doctor.id, doctor.name, doctor.specialization, doctor.experience, doctor.hospital],
          function(err) {
            if (err) reject(err);
            else {
              console.log(`✅ Seeded doctor: ${doctor.name} (ID: ${doctor.id})`);
              resolve(this.lastID);
            }
          }
        );
      });
    }
  }

  async seedSlots() {
    console.log('⏰ Seeding time slots...');
    const slots = {
      1: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00'],
      2: ['10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00'],
      3: ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'],
      4: ['08:00', '08:30', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']
    };

    let slotCount = 0;
    for (const [doctorId, timeSlots] of Object.entries(slots)) {
      for (const slotTime of timeSlots) {
        await new Promise((resolve, reject) => {
          this.db.db.run(
            'INSERT INTO slots (doctor_id, slot_time, is_available) VALUES (?, ?, ?)',
            [parseInt(doctorId), slotTime, 1],
            function(err) {
              if (err) reject(err);
              else {
                slotCount++;
                resolve(this.lastID);
              }
            }
          );
        });
      }
      console.log(`✅ Seeded ${slots[doctorId].length} slots for doctor ID ${doctorId}`);
    }
    console.log(`✅ Total slots seeded: ${slotCount}`);
  }

  async seedServers() {
    console.log('🖥️ Seeding server instances...');
    const servers = [
      { id: 1, name: 'Server-Mumbai', port: 5001, is_leader: 1 },
      { id: 2, name: 'Server-Delhi', port: 5002, is_leader: 0 },
      { id: 3, name: 'Server-Bangalore', port: 5003, is_leader: 0 }
    ];

    for (const server of servers) {
      await new Promise((resolve, reject) => {
        this.db.db.run(
          'INSERT OR REPLACE INTO servers (id, name, port, connections, is_leader, last_heartbeat, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [server.id, server.name, server.port, 0, server.is_leader, Date.now(), 'active'],
          function(err) {
            if (err) reject(err);
            else {
              console.log(`✅ Seeded server: ${server.name}`);
              resolve(this.lastID);
            }
          }
        );
      });
    }
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.seed();
}

module.exports = DatabaseSeeder;

