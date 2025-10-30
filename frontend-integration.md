# Frontend Integration Guide

This guide explains how to integrate the React frontend with the Node.js backend.

## 🔄 Backend Integration Changes

To connect your React frontend to the real backend instead of the simulated one, make these changes:

### 1. Update API Base URLs

Replace the simulated backend with real API calls. In your React component, update the `DistributedBackend` class:

```typescript
// Replace the simulated backend with real API calls
class DistributedBackend {
  private baseUrls = [
    'http://localhost:5001',
    'http://localhost:5002', 
    'http://localhost:5003'
  ];
  
  private currentServerIndex = 0;

  // Get next server using round-robin
  private getNextServer() {
    const server = this.baseUrls[this.currentServerIndex];
    this.currentServerIndex = (this.currentServerIndex + 1) % this.baseUrls.length;
    return server;
  }

  // Replace simulateRemoteMethod with real API calls
  async invokeRemoteMethod(method: string, params: any = {}) {
    const server = this.getNextServer();
    console.log(`[EXP 1 - RMI] Invoking ${method} on ${server}`);
    
    try {
      switch(method) {
        case 'getDoctors':
          const doctorsResponse = await fetch(`${server}/api/doctors`);
          const doctorsData = await doctorsResponse.json();
          return { data: doctorsData.data, server: doctorsData.server };
          
        case 'getSlots':
          const slotsResponse = await fetch(`${server}/api/doctors/${params.doctorId}/slots`);
          const slotsData = await slotsResponse.json();
          return { data: slotsData.data, server: slotsData.server };
          
        case 'bookAppointment':
          const bookingResponse = await fetch(`${server}/api/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doctorId: params.doctorId,
              patientName: params.patientName,
              slotTime: params.slot
            })
          });
          const bookingData = await bookingResponse.json();
          return bookingData;
          
        case 'getBookings':
          const bookingsResponse = await fetch(`${server}/api/bookings`);
          const bookingsData = await bookingsResponse.json();
          return { data: bookingsData.data, server: bookingsData.server };
          
        default:
          return { error: 'Unknown method' };
      }
    } catch (error) {
      console.error(`API call failed to ${server}:`, error);
      throw error;
    }
  }

  // Real server status from backend
  async getServerStatus() {
    const server = this.getNextServer();
    const response = await fetch(`${server}/api/servers`);
    const data = await response.json();
    return data.data;
  }

  // Real clock synchronization
  async syncClockCristian(clientTime: number) {
    const server = this.getNextServer();
    const response = await fetch(`${server}/api/clock-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientTime })
    });
    const data = await response.json();
    return data;
  }

  // Real leader election trigger
  async performBullyElection() {
    const server = this.getNextServer();
    const response = await fetch(`${server}/api/servers/election`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId: 1 })
    });
    return await response.json();
  }
}
```

### 2. Update React Component Methods

Update the React component to use real API calls:

```typescript
const HospitalAppointmentSystem = () => {
  const [backend] = useState(() => new DistributedBackend());
  // ... other state

  const loadDoctors = async () => {
    addLog('[EXP 1 - RMI] Invoking getDoctors remote method', 'info');
    addLog('[EXP 6 - LOAD BALANCING] Selecting server using round-robin', 'info');
    try {
      const result = await backend.invokeRemoteMethod('getDoctors', {});
      setDoctors(result.data);
      addLog(`✓ Loaded doctors from ${result.server}`, 'success');
    } catch (error) {
      addLog('Failed to load doctors', 'error');
    }
  };

  const loadSlots = async (doctorId: number) => {
    addLog('[EXP 1 - RMI] Invoking getSlots remote method', 'info');
    try {
      const result = await backend.invokeRemoteMethod('getSlots', { doctorId });
      setAvailableSlots(result.data);
      addLog(`✓ Loaded slots for Doctor ID ${doctorId} from ${result.server}`, 'success');
    } catch (error) {
      addLog('Failed to load slots', 'error');
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !selectedSlot || !patientName) {
      addLog('Please fill all fields', 'error');
      return;
    }

    addLog('[EXP 1 - RMI] Invoking bookAppointment remote method', 'info');
    addLog('[EXP 2 - MULTITHREADING] Processing concurrent booking request', 'info');
    addLog('[EXP 5 - REPLICATION] Writing data with eventual consistency', 'info');

    const bookingData = {
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      slot: selectedSlot,
      patientName,
      timestamp: Date.now(),
      confirmationId: `CONF${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    };

    try {
      const result = await backend.invokeRemoteMethod('bookAppointment', bookingData);
      
      if (result.success) {
        addLog(`✓ Booking confirmed: ${result.confirmationId} (${result.consistency} consistency)`, 'success');
        addLog('[EXP 5 - PROPAGATION] Replicating booking to all server nodes', 'info');
        setBookings(prev => [...prev, { ...bookingData, confirmationId: result.confirmationId }]);
        setPatientName('');
        setSelectedSlot('');
        loadSlots(selectedDoctor.id);
      } else {
        addLog('Booking failed', 'error');
      }
    } catch (error) {
      addLog('Booking request failed', 'error');
    }
  };

  const loadServerStats = async () => {
    try {
      const servers = await backend.getServerStatus();
      setServerStats(servers);
    } catch (error) {
      addLog('Failed to load server stats', 'error');
    }
  };

  const performClockSync = async () => {
    addLog('[EXP 3 - CLOCK SYNC] Starting Cristian\'s algorithm...', 'info');
    const clientTime = Date.now();
    try {
      const syncResult = await backend.syncClockCristian(clientTime);
      setClockSync(syncResult);
      addLog(`✓ Clock synchronized. RTT: ${syncResult.rtt.toFixed(2)}ms`, 'success');
    } catch (error) {
      addLog('Clock sync failed', 'error');
    }
  };

  const simulateServerFailure = async () => {
    addLog('[EXP 4 - ELECTION] Simulating server failure...', 'warning');
    try {
      const result = await backend.performBullyElection();
      addLog('[EXP 4 - BULLY] Initiating Bully Election Algorithm...', 'info');
      addLog(`✓ Election complete! Result: ${JSON.stringify(result)}`, 'success');
      loadServerStats();
    } catch (error) {
      addLog('Election failed', 'error');
    }
  };

  // ... rest of component
};
```

### 3. Add Error Handling

Add proper error handling for network requests:

```typescript
const handleApiError = (error: any, operation: string) => {
  console.error(`${operation} failed:`, error);
  addLog(`${operation} failed: ${error.message}`, 'error');
};

// Wrap all API calls with error handling
const loadDoctors = async () => {
  try {
    // ... API call
  } catch (error) {
    handleApiError(error, 'Load doctors');
  }
};
```

### 4. Add Loading States

Add loading states for better UX:

```typescript
const [loading, setLoading] = useState({
  doctors: false,
  slots: false,
  booking: false,
  servers: false
});

const loadDoctors = async () => {
  setLoading(prev => ({ ...prev, doctors: true }));
  try {
    // ... API call
  } catch (error) {
    // ... error handling
  } finally {
    setLoading(prev => ({ ...prev, doctors: false }));
  }
};
```

## 🔧 Backend Configuration

### 1. CORS Setup

The backend already has CORS enabled, but you can customize it in `server.js`:

```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your frontend URLs
  credentials: true
}));
```

### 2. Environment Variables

Create a `.env` file for configuration:

```env
# Server Configuration
PORT=5001
SERVER_ID=1

# Database
DB_PATH=./hospital.db

# CORS
FRONTEND_URL=http://localhost:3000
```

### 3. Production Configuration

For production deployment:

```javascript
// In server.js
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : true,
  credentials: true
};
app.use(cors(corsOptions));
```

## 🧪 Testing Integration

### 1. Test API Endpoints

```bash
# Test doctors endpoint
curl http://localhost:5001/api/doctors

# Test booking endpoint
curl -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"doctorId": 1, "patientName": "Test User", "slotTime": "09:00"}'

# Test server status
curl http://localhost:5001/api/servers
```

### 2. Test Load Balancing

Make multiple requests to see load balancing in action:

```bash
for i in {1..10}; do
  curl http://localhost:5001/api/doctors
  sleep 1
done
```

### 3. Test Distributed Features

```bash
# Test clock synchronization
curl -X POST http://localhost:5001/api/clock-sync \
  -H "Content-Type: application/json" \
  -d '{"clientTime": 1234567890}'

# Test leader election
curl -X POST http://localhost:5001/api/servers/election \
  -H "Content-Type: application/json" \
  -d '{"candidateId": 1}'
```

## 🚀 Deployment

### 1. Frontend Deployment

Update your React app's API configuration for production:

```typescript
const baseUrls = process.env.NODE_ENV === 'production' 
  ? ['https://your-backend-domain.com']
  : ['http://localhost:5001', 'http://localhost:5002', 'http://localhost:5003'];
```

### 2. Backend Deployment

Deploy the backend to your preferred platform (Heroku, AWS, DigitalOcean, etc.) and update the frontend URLs accordingly.

## 🔍 Monitoring

### 1. Frontend Monitoring

Add error tracking and monitoring:

```typescript
const logError = (error: any, context: string) => {
  console.error(`[${context}] Error:`, error);
  // Send to error tracking service (Sentry, LogRocket, etc.)
};

// Use in API calls
try {
  const result = await fetch(`${server}/api/doctors`);
} catch (error) {
  logError(error, 'loadDoctors');
}
```

### 2. Backend Monitoring

The backend already includes comprehensive logging. For production, consider adding:

- Request/response logging
- Performance metrics
- Error tracking
- Health monitoring

## 📝 Summary

This integration guide provides:

1. **Complete API Integration** - Replace simulation with real backend calls
2. **Error Handling** - Robust error handling for network requests
3. **Loading States** - Better user experience with loading indicators
4. **Configuration** - Environment-based configuration
5. **Testing** - Comprehensive testing procedures
6. **Deployment** - Production deployment considerations

The backend is designed to work seamlessly with your React frontend, providing all the distributed computing features as real, working functionality rather than simulations.


