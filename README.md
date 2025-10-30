# Distributed Hospital Appointment System Backend

A comprehensive Node.js backend implementation with SQLite database that implements all distributed computing concepts from the React frontend as real, working features.

## 🏗️ Architecture

This backend implements a distributed system with:
- **3 Express Server Instances** (ports 5001, 5002, 5003)
- **SQLite Database** with proper schema
- **Round-robin Load Balancing**
- **Bully Algorithm for Leader Election**
- **Cristian's Clock Synchronization**
- **Eventual Consistency Data Replication**
- **Concurrent Request Handling**

## 📋 Features Implemented

### Distributed Computing Concepts

1. **RMI (Remote Method Invocation)** - All API calls simulate remote method calls
2. **Multithreading** - Concurrent request handling with connection tracking
3. **Clock Synchronization** - Cristian's algorithm for time synchronization
4. **Election Algorithm** - Bully algorithm for leader election when servers fail
5. **Data Replication** - Eventual consistency across server instances
6. **Load Balancing** - Round-robin distribution of requests

### Database Schema

- **doctors** - Doctor information (id, name, specialization, experience, hospital)
- **slots** - Available time slots (id, doctor_id, slot_time, is_available)
- **bookings** - Appointment bookings (id, doctor_id, patient_name, slot_time, confirmation_id, booking_timestamp, server_id)
- **servers** - Server instances (id, name, port, connections, is_leader, last_heartbeat, status)

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Seed the Database**
   ```bash
   npm run seed
   ```

3. **Start All Servers**
   
   **Option A: Using npm scripts (Recommended)**
   ```bash
   npm run start:all
   ```
   
   **Option B: Using startup scripts**
   
   **Windows:**
   ```bash
   start-servers.bat
   ```
   
   **Linux/Mac:**
   ```bash
   ./start-servers.sh
   ```
   
   **Option C: Manual startup**
   ```bash
   # Terminal 1
   npm run start:5001
   
   # Terminal 2
   npm run start:5002
   
   # Terminal 3
   npm run start:5003
   ```

### Server URLs

Once started, the servers will be available at:
- **Server 1**: http://localhost:5001
- **Server 2**: http://localhost:5002
- **Server 3**: http://localhost:5003

## 📡 API Endpoints

### Doctors
- `GET /api/doctors` - Get all doctors
- `GET /api/doctors/:id/slots` - Get available slots for a doctor

### Bookings
- `POST /api/bookings` - Create a new appointment booking
- `GET /api/bookings` - Get all bookings

### Server Management
- `GET /api/servers` - Get server status for all instances
- `POST /api/servers/election` - Trigger leader election
- `POST /api/clock-sync` - Perform Cristian's clock synchronization

### Health & Monitoring
- `GET /api/health` - Health check endpoint
- `POST /api/concurrent` - Handle concurrent requests

## 🔧 Configuration

### Environment Variables

- `PORT` - Server port (default: 5001)
- `SERVER_ID` - Server instance ID (default: 1)

### Database

The SQLite database (`hospital.db`) is automatically created and seeded with:
- 4 doctors (Cardiologist, Dermatologist, Pediatrician, Neurologist)
- Time slots for each doctor
- 3 server instances

## 🔄 Distributed Features

### Load Balancing
- Round-robin distribution of requests
- Connection tracking per server
- Automatic failover to available servers

### Leader Election (Bully Algorithm)
- Automatic leader election when servers fail
- Server with highest ID becomes leader
- Heartbeat monitoring for failure detection

### Clock Synchronization
- Cristian's algorithm implementation
- RTT calculation and time adjustment
- Cross-server time synchronization

### Data Replication
- Eventual consistency model
- Asynchronous propagation to all servers
- Conflict resolution for concurrent updates

## 🧪 Testing the System

### 1. Health Check
```bash
curl http://localhost:5001/api/health
curl http://localhost:5002/api/health
curl http://localhost:5003/api/health
```

### 2. Get Doctors
```bash
curl http://localhost:5001/api/doctors
```

### 3. Create Booking
```bash
curl -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": 1,
    "patientName": "John Doe",
    "slotTime": "09:00"
  }'
```

### 4. Server Status
```bash
curl http://localhost:5001/api/servers
```

### 5. Clock Synchronization
```bash
curl -X POST http://localhost:5001/api/clock-sync \
  -H "Content-Type: application/json" \
  -d '{"clientTime": 1234567890}'
```

## 🔗 Frontend Integration

The backend is designed to work seamlessly with the provided React frontend. The API responses match exactly what the frontend expects:

### Expected Response Format

```json
{
  "data": [...],
  "server": "Server-1",
  "timestamp": 1234567890,
  "success": true
}
```

### CORS Configuration

CORS is enabled for all origins to allow frontend integration. For production, configure specific origins.

## 🛠️ Development

### Project Structure

```
├── server.js              # Main server file
├── database.js            # Database connection and queries
├── distributedManager.js  # Distributed computing logic
├── seed.js               # Database seeding script
├── start-servers.js      # Node.js server manager
├── start-servers.bat     # Windows startup script
├── start-servers.sh      # Linux/Mac startup script
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

### Available Scripts

- `npm start` - Start single server instance
- `npm run start:all` - Start all 3 server instances
- `npm run start:5001` - Start server on port 5001
- `npm run start:5002` - Start server on port 5002
- `npm run start:5003` - Start server on port 5003
- `npm run seed` - Seed the database
- `npm run dev` - Start with nodemon for development

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Kill existing processes: `npx kill-port 5001 5002 5003`
   - Or change ports in environment variables

2. **Database Errors**
   - Delete `hospital.db` and run `npm run seed`
   - Check file permissions

3. **Server Connection Issues**
   - Verify all servers are running
   - Check firewall settings
   - Ensure ports are not blocked

### Logs

Each server logs its activities with timestamps and server ID:
```
[1] POST /api/bookings - 2024-01-01T10:00:00.000Z
[EXP 1 - RMI] Handling bookAppointment request
[EXP 5 - REPLICATION] Writing data with eventual consistency
```

## 📊 Monitoring

### Server Status Dashboard

Access the server status at any server's `/api/servers` endpoint to see:
- Server health and connections
- Leader election status
- Clock synchronization status
- Last heartbeat timestamps

### Health Monitoring

Use `/api/health` endpoint for basic health checks and monitoring.

## 🔒 Security Considerations

- Input validation on all endpoints
- SQL injection prevention with parameterized queries
- CORS configuration for production
- Rate limiting (recommended for production)
- Authentication (not implemented, add as needed)

## 🚀 Production Deployment

For production deployment:

1. **Environment Configuration**
   - Set `NODE_ENV=production`
   - Configure proper CORS origins
   - Use environment variables for sensitive data

2. **Database**
   - Consider PostgreSQL for production
   - Implement proper backup strategies
   - Use connection pooling

3. **Load Balancing**
   - Use nginx or HAProxy for external load balancing
   - Implement health checks
   - Configure SSL/TLS

4. **Monitoring**
   - Add logging framework (Winston, etc.)
   - Implement metrics collection
   - Set up alerting

## 📝 License

MIT License - feel free to use and modify as needed.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs
3. Test individual endpoints
4. Verify database integrity

---

**Happy Coding! 🎉**

This backend provides a complete implementation of distributed computing concepts in a real-world hospital appointment system scenario.


