const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Database = require('./database');
const DistributedManager = require('./distributedManager');

const app = express();
const PORT = process.env.PORT || 5001;
const SERVER_ID = parseInt(process.env.SERVER_ID) || 1;

// Initialize database and distributed manager
const db = new Database();
const distManager = new DistributedManager(SERVER_ID, PORT);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${SERVER_ID}] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    serverId: SERVER_ID, 
    port: PORT,
    timestamp: Date.now()
  });
});

// ============ DOCTORS ENDPOINTS ============
app.get('/api/doctors', async (req, res) => {
  try {
    console.log('[EXP 1 - RMI] Handling getDoctors request');
    const doctors = await db.getAllDoctors();
    res.json({ 
      data: doctors, 
      server: `Server-${SERVER_ID}`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

app.get('/api/doctors/:id/slots', async (req, res) => {
  try {
    const doctorId = req.params.id;
    console.log('[EXP 1 - RMI] Handling getSlots request for doctor:', doctorId);
    
    const slots = await db.getAvailableSlots(doctorId);
    const slotTimes = slots.map(slot => slot.slot_time);
    
    res.json({ 
      data: slotTimes, 
      server: `Server-${SERVER_ID}`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// ============ BOOKINGS ENDPOINTS ============
app.post('/api/bookings', async (req, res) => {
  try {
    const { doctorId, patientName, slotTime } = req.body;
    
    if (!doctorId || !patientName || !slotTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('[EXP 1 - RMI] Handling bookAppointment request');
    console.log('[EXP 2 - MULTITHREADING] Processing concurrent booking request');
    console.log('[EXP 5 - REPLICATION] Writing data with eventual consistency');

    // Check if slot is still available
    const slotAvailable = await db.bookSlot(doctorId, slotTime);
    
    if (!slotAvailable) {
      return res.status(400).json({ error: 'Slot no longer available' });
    }

    // Create booking
    const confirmationId = `CONF${uuidv4().substr(0, 9).toUpperCase()}`;
    const bookingResult = await db.createBooking(doctorId, patientName, slotTime, confirmationId, SERVER_ID);
    
    // Prepare booking data for replication
    const bookingData = {
      doctorId,
      patientName,
      slotTime,
      confirmationId,
      bookingTimestamp: bookingResult.timestamp,
      serverId: SERVER_ID
    };

    // Replicate data to other servers (eventual consistency)
    try {
      await distManager.replicateBooking(bookingData);
      await distManager.replicateSlotUpdate(doctorId, slotTime);
    } catch (replicationError) {
      console.log('[REPLICATION] Some replicas failed, but booking created locally');
    }

    console.log('[EXP 5 - PROPAGATION] Replicating booking to all server nodes');

    res.json({ 
      success: true, 
      consistency: 'eventual',
      confirmationId,
      timestamp: bookingResult.timestamp,
      server: `Server-${SERVER_ID}`
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    console.log('[EXP 1 - RMI] Handling getBookings request');
    const bookings = await db.getAllBookings();
    
    // Format bookings to match frontend expectations
    const formattedBookings = bookings.map(booking => ({
      id: booking.id,
      doctorId: booking.doctor_id,
      doctorName: booking.doctor_name,
      slot: booking.slot_time,
      patientName: booking.patient_name,
      confirmationId: booking.confirmation_id,
      timestamp: booking.booking_timestamp
    }));

    res.json({ 
      data: formattedBookings, 
      server: `Server-${SERVER_ID}`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ============ SERVER STATUS ENDPOINTS ============
app.get('/api/servers', async (req, res) => {
  try {
    const servers = await distManager.getServerStatus();
    
    // Format to match frontend expectations
    const formattedServers = servers.map(server => ({
      id: server.id,
      name: server.name,
      port: server.port,
      connections: server.connections,
      isLeader: server.isLeader,
      clock: Date.now() + (server.clockOffset || 0),
      lastHeartbeat: server.lastHeartbeat,
      status: server.status
    }));

    res.json({ 
      data: formattedServers,
      server: `Server-${SERVER_ID}`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ error: 'Failed to fetch server status' });
  }
});

// ============ LEADER ELECTION ENDPOINTS ============
app.post('/api/servers/election', async (req, res) => {
  try {
    console.log('[EXP 4 - ELECTION] Received election request');
    const { candidateId } = req.body;
    
    if (candidateId < SERVER_ID) {
      // This server has higher ID, respond with election message
      console.log('[EXP 4 - BULLY] Server has higher ID, responding to election');
      res.json({ success: true, message: 'Server is alive' });
      
      // Start own election if this server has higher ID
      setTimeout(async () => {
        await distManager.performBullyElection();
      }, 1000);
    } else {
      // This server has lower ID, acknowledge
      console.log('[EXP 4 - BULLY] Server has lower ID, acknowledging election');
      res.json({ success: false, message: 'Server acknowledges election' });
    }
  } catch (error) {
    console.error('Error handling election:', error);
    res.status(500).json({ error: 'Failed to handle election' });
  }
});

app.post('/api/servers/leader-update', async (req, res) => {
  try {
    const { newLeaderId } = req.body;
    console.log(`[LEADER UPDATE] New leader is server ${newLeaderId}`);
    
    // Update local leader status
    distManager.isLeader = (newLeaderId === SERVER_ID);
    await db.setLeader(newLeaderId);
    
    res.json({ success: true, message: 'Leader updated' });
  } catch (error) {
    console.error('Error updating leader:', error);
    res.status(500).json({ error: 'Failed to update leader' });
  }
});

// ============ CLOCK SYNCHRONIZATION ENDPOINTS ============
app.post('/api/clock-sync', async (req, res) => {
  try {
    const { clientTime } = req.body;
    console.log('[EXP 3 - CLOCK SYNC] Performing Cristian\'s algorithm');
    
    const syncResult = await distManager.performClockSync(clientTime);
    
    res.json({ 
      success: true,
      ...syncResult,
      server: `Server-${SERVER_ID}`
    });
  } catch (error) {
    console.error('Error in clock sync:', error);
    res.status(500).json({ error: 'Failed to sync clock' });
  }
});

app.get('/api/clock-sync', async (req, res) => {
  try {
    const clientTime = parseInt(req.query.clientTime) || Date.now();
    console.log('[EXP 3 - CLOCK SYNC] Handling clock sync request');
    
    const syncResult = await distManager.performClockSync(clientTime);
    
    res.json({ 
      success: true,
      ...syncResult,
      server: `Server-${SERVER_ID}`
    });
  } catch (error) {
    console.error('Error in clock sync:', error);
    res.status(500).json({ error: 'Failed to sync clock' });
  }
});

// ============ REPLICATION ENDPOINTS ============
app.post('/api/replicate/booking', async (req, res) => {
  try {
    const { doctorId, patientName, slotTime, confirmationId, bookingTimestamp, serverId } = req.body;
    
    // Create booking in local database
    await db.createBooking(doctorId, patientName, slotTime, confirmationId, serverId);
    
    // Mark slot as unavailable
    await db.bookSlot(doctorId, slotTime);
    
    console.log(`[REPLICATION] Booking replicated: ${confirmationId}`);
    res.json({ success: true, message: 'Booking replicated' });
  } catch (error) {
    console.error('Error replicating booking:', error);
    res.status(500).json({ error: 'Failed to replicate booking' });
  }
});

app.post('/api/replicate/slot', async (req, res) => {
  try {
    const { doctorId, slotTime } = req.body;
    
    // Mark slot as unavailable
    await db.bookSlot(doctorId, slotTime);
    
    console.log(`[REPLICATION] Slot update replicated: Doctor ${doctorId}, Time ${slotTime}`);
    res.json({ success: true, message: 'Slot update replicated' });
  } catch (error) {
    console.error('Error replicating slot:', error);
    res.status(500).json({ error: 'Failed to replicate slot' });
  }
});

// ============ CONCURRENT REQUESTS ENDPOINT ============
app.post('/api/concurrent', async (req, res) => {
  try {
    const { requests } = req.body;
    console.log('[EXP 2 - MULTITHREADING] Handling concurrent requests');
    
    const results = await distManager.handleConcurrentRequests(requests);
    
    res.json({ 
      success: true,
      results,
      server: `Server-${SERVER_ID}`
    });
  } catch (error) {
    console.error('Error handling concurrent requests:', error);
    res.status(500).json({ error: 'Failed to handle concurrent requests' });
  }
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await distManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await distManager.shutdown();
  process.exit(0);
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`🚀 Server ${SERVER_ID} running on port ${PORT}`);
  console.log(`📊 Distributed Hospital Appointment System Backend`);
  console.log(`🔄 Load Balancing: Round-robin`);
  console.log(`👑 Leader Election: Bully Algorithm`);
  console.log(`⏰ Clock Sync: Cristian's Algorithm`);
  console.log(`🔄 Data Replication: Eventual Consistency`);
  console.log(`🧵 Concurrent Handling: Async/Await`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
});


