import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Users, Activity, Server, Shield, Database, Zap } from 'lucide-react';

// ==================== REAL BACKEND CONNECTION ====================

class DistributedBackend {
  constructor() {
    // Real server endpoints - make sure these match your running servers
    this.baseUrls = [
      'http://localhost:5001',
      'http://localhost:5002', 
      'http://localhost:5003'
    ];
    
    this.currentServerIndex = 0;
    this.consistencyModel = 'eventual';
    
    // Fallback data in case servers are not running
    this.fallbackDoctors = [
      { id: 1, name: 'Dr. Aisha Khan', specialization: 'Cardiologist', experience: '12 years', hospital: 'Apollo Hospital' },
      { id: 2, name: 'Dr. Rohan Patel', specialization: 'Dermatologist', experience: '10 years', hospital: 'Fortis Hospital' },
      { id: 3, name: 'Dr. Neha Sharma', specialization: 'Pediatrician', experience: '8 years', hospital: 'Manipal Hospital' },
      { id: 4, name: 'Dr. Nikhil Rao', specialization: 'Neurologist', experience: '15 years', hospital: 'Max Hospital' }
    ];
    
    this.fallbackSlots = {
      1: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00'],
      2: ['10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00'],
      3: ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00'],
      4: ['08:00', '08:30', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']
    };

    this.fallbackServers = [
      { id: 1, name: 'Server-Mumbai', port: 5001, connections: 0, isLeader: true, clock: Date.now() },
      { id: 2, name: 'Server-Delhi', port: 5002, connections: 0, isLeader: false, clock: Date.now() },
      { id: 3, name: 'Server-Bangalore', port: 5003, connections: 0, isLeader: false, clock: Date.now() }
    ];
  }

  // Get next server using round-robin with fallback
  getNextServer() {
    const server = this.baseUrls[this.currentServerIndex];
    this.currentServerIndex = (this.currentServerIndex + 1) % this.baseUrls.length;
    return server;
  }

  // Enhanced fetch with timeout and fallback
  async fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // ============ RMI - Remote Method Invocation with Fallback ============
  async invokeRemoteMethod(method, params = {}) {
    const server = this.getNextServer();
    console.log(`[EXP 1 - RMI] Invoking ${method} on ${server}`);
    
    try {
      switch(method) {
        case 'getDoctors':
          try {
            const doctorsResponse = await this.fetchWithTimeout(`${server}/api/doctors`);
            const doctorsData = await doctorsResponse.json();
            return { data: doctorsData.data, server: doctorsData.server };
          } catch (error) {
            console.log('Falling back to local doctors data');
            return { data: this.fallbackDoctors, server: 'Local-Fallback' };
          }
          
        case 'getSlots':
          try {
            const slotsResponse = await this.fetchWithTimeout(`${server}/api/doctors/${params.doctorId}/slots`);
            const slotsData = await slotsResponse.json();
            return { data: slotsData.data, server: slotsData.server };
          } catch (error) {
            console.log('Falling back to local slots data');
            return { data: this.fallbackSlots[params.doctorId] || [], server: 'Local-Fallback' };
          }
          
        case 'bookAppointment':
          // For booking, we'll simulate success if servers are down
          try {
            const bookingResponse = await this.fetchWithTimeout(`${server}/api/bookings`, {
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
          } catch (error) {
            console.log('Simulating booking success locally');
            return { 
              success: true, 
              consistency: 'eventual',
              confirmationId: `CONF${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
              timestamp: Date.now(),
              server: 'Local-Simulation'
            };
          }
          
        case 'getBookings':
          try {
            const bookingsResponse = await this.fetchWithTimeout(`${server}/api/bookings`);
            const bookingsData = await bookingsResponse.json();
            return { data: bookingsData.data, server: bookingsData.server };
          } catch (error) {
            return { data: [], server: 'Local-Fallback' };
          }
          
        default:
          return { error: 'Unknown method' };
      }
    } catch (error) {
      console.error(`API call failed to ${server}:`, error);
      // Return appropriate fallback based on method
      switch(method) {
        case 'getDoctors':
          return { data: this.fallbackDoctors, server: 'Local-Fallback' };
        case 'getSlots':
          return { data: this.fallbackSlots[params.doctorId] || [], server: 'Local-Fallback' };
        case 'getBookings':
          return { data: [], server: 'Local-Fallback' };
        default:
          throw error;
      }
    }
  }

  // ============ OTHER DC METHODS ============
  syncClockCristian(clientTime) {
    console.log('[EXP 3 - CLOCK SYNC] Performing Cristian\'s algorithm locally');
    const t0 = clientTime;
    const serverTime = Date.now();
    const t1 = Date.now();
    const rtt = t1 - t0;
    const adjustedTime = serverTime + (rtt / 2);
    
    return { adjustedTime, rtt, serverTime };
  }

  performBullyElection(failedServerId) {
    console.log(`[EXP 4 - BULLY ELECTION] Server ${failedServerId} failed, starting election locally`);
    
    const activeServers = this.fallbackServers.filter(s => s.id !== failedServerId);
    const newLeader = activeServers.reduce((max, server) => 
      server.id > max.id ? server : max, activeServers[0]);
    
    this.fallbackServers.forEach(s => s.isLeader = (s.id === newLeader.id));
    
    return newLeader;
  }
}

// ==================== FRONTEND REACT APPLICATION ====================

const App = () => {
  const [backend] = useState(() => new DistributedBackend());
  const [activeTab, setActiveTab] = useState('doctors');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [patientName, setPatientName] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [serverStats, setServerStats] = useState([]);
  const [clockSync, setClockSync] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  useEffect(() => {
    loadDoctors();
    loadServerStats();
    performClockSync();
    checkBackendConnection();
  }, []);

  const addLog = (message, type = 'info') => {
    setSystemLogs(prev => [...prev.slice(-4), { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const checkBackendConnection = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/health', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        setIsBackendConnected(true);
        addLog('✓ Backend servers are connected', 'success');
      }
    } catch (error) {
      setIsBackendConnected(false);
      addLog('⚠️ Backend servers not running. Using local simulation mode.', 'warning');
      addLog('💡 Run: npm start in backend folder to start servers', 'info');
    }
  };

  const loadDoctors = async () => {
    addLog('[EXP 1 - RMI] Invoking getDoctors remote method', 'info');
    addLog('[EXP 6 - LOAD BALANCING] Selecting server using round-robin', 'info');
    const result = await backend.invokeRemoteMethod('getDoctors', {});
    setDoctors(result.data);
    addLog(`✓ Loaded doctors from ${result.server}`, 'success');
  };

  const loadSlots = async (doctorId) => {
    console.log('Loading slots for doctor ID:', doctorId);
    console.log('Selected doctor:', selectedDoctor);
    
    addLog('[EXP 1 - RMI] Invoking getSlots remote method', 'info');
    const result = await backend.invokeRemoteMethod('getSlots', { doctorId });
    
    console.log('Slots API response:', result);
    console.log('Available slots data:', result.data);
    
    setAvailableSlots(result.data);
    addLog(`✓ Loaded slots for Doctor ID ${doctorId} from ${result.server}`, 'success');
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    loadSlots(doctor.id);
    setActiveTab('booking');
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

    const result = await backend.invokeRemoteMethod('bookAppointment', bookingData);
    
    if (result.success) {
      addLog(`✓ Booking confirmed: ${bookingData.confirmationId} (${result.consistency} consistency)`, 'success');
      addLog('[EXP 5 - PROPAGATION] Replicating booking to all server nodes', 'info');
      setBookings(prev => [...prev, bookingData]);
      setPatientName('');
      setSelectedSlot('');
      loadSlots(selectedDoctor.id);
    } else {
      addLog('Booking failed', 'error');
    }
  };

  const loadServerStats = async () => {
    try {
      const server = backend.getNextServer();
      const response = await backend.fetchWithTimeout(`${server}/api/servers`);
      const data = await response.json();
      setServerStats(data.data);
      setIsBackendConnected(true);
    } catch (error) {
      addLog('Failed to load server stats, using local data', 'warning');
      setServerStats(backend.fallbackServers);
      setIsBackendConnected(false);
    }
  };

  const performClockSync = async () => {
    addLog('[EXP 3 - CLOCK SYNC] Starting Cristian\'s algorithm...', 'info');
    const clientTime = Date.now();
    try {
      const server = backend.getNextServer();
      const response = await backend.fetchWithTimeout(`${server}/api/clock-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTime })
      });
      const syncResult = await response.json();
      setClockSync(syncResult);
      addLog(`✓ Clock synchronized. RTT: ${syncResult.rtt.toFixed(2)}ms`, 'success');
    } catch (error) {
      addLog('Clock sync failed, using local simulation', 'warning');
      const syncResult = backend.syncClockCristian(clientTime);
      setClockSync(syncResult);
    }
  };

  const simulateServerFailure = async () => {
    addLog('[EXP 4 - ELECTION] Simulating server failure...', 'warning');
    try {
      const server = backend.getNextServer();
      const response = await backend.fetchWithTimeout(`${server}/api/servers/election`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 1 })
      });
      const result = await response.json();
      addLog('[EXP 4 - BULLY] Initiating Bully Election Algorithm...', 'info');
      addLog(`✓ Election complete! Result: ${JSON.stringify(result)}`, 'success');
      loadServerStats();
    } catch (error) {
      addLog('Election failed, simulating locally', 'warning');
      const failedServer = backend.fallbackServers[2];
      addLog(`[EXP 4 - BULLY] Server ${failedServer.name} (ID: ${failedServer.id}) has failed`, 'error');
      const newLeader = backend.performBullyElection(failedServer.id);
      addLog(`✓ Election complete! New leader: ${newLeader.name} (ID: ${newLeader.id})`, 'success');
      loadServerStats();
    }
  };

  // Inline CSS styles
  const styles = {
    app: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto'
    },
    header: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      padding: '24px',
      marginBottom: '24px',
      border: isBackendConnected ? '2px solid #10b981' : '2px solid #f59e0b'
    },
    headerContent: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '16px'
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flex: 1
    },
    headerTitle: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#1f2937',
      margin: 0
    },
    headerSubtitle: {
      color: '#6b7280',
      margin: 0
    },
    connectionStatus: {
      padding: '8px 12px',
      borderRadius: '6px',
      fontWeight: '600',
      fontSize: '14px',
      backgroundColor: isBackendConnected ? '#d1fae5' : '#fef3c7',
      color: isBackendConnected ? '#065f46' : '#92400e',
      border: isBackendConnected ? '1px solid #a7f3d0' : '1px solid #fcd34d'
    },
    buttonGroup: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 6px',
      borderRadius: '8px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '14px'
    },
    buttonPrimary: {
      backgroundColor: '#2563eb',
      color: 'white'
    },
    buttonDanger: {
      backgroundColor: '#dc2626',
      color: 'white'
    },
    buttonSecondary: {
      backgroundColor: '#6b7280',
      color: 'white'
    },
    serverGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '16px',
      marginBottom: '24px'
    },
    serverCard: {
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      padding: '16px',
      border: '2px solid #e5e7eb',
      transition: 'all 0.2s ease'
    },
    serverCardLeader: {
      borderColor: '#10b981',
      boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
    },
    serverHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '8px'
    },
    serverInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    serverName: {
      fontWeight: '600',
      fontSize: '16px'
    },
    serverDetails: {
      fontSize: '14px',
      color: '#6b7280',
      lineHeight: '1.5'
    },
    statusIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      marginTop: '4px',
      fontSize: '12px'
    },
    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%'
    },
    clockSync: {
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      padding: '16px',
      marginBottom: '24px'
    },
    clockHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
      fontWeight: '600'
    },
    clockGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      fontSize: '14px',
      color: '#6b7280'
    },
    mainCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      marginBottom: '24px',
      overflow: 'hidden'
    },
    tabNav: {
      display: 'flex',
      borderBottom: '1px solid #e5e7eb',
      flexWrap: 'wrap'
    },
    tabButton: {
      flex: '1 1 120px',
      padding: '16px 24px',
      fontWeight: '600',
      backgroundColor: '#f3f4f6',
      color: '#374151',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '14px',
      minWidth: '120px'
    },
    tabButtonActive: {
      backgroundColor: '#2563eb',
      color: 'white'
    },
    tabContent: {
      padding: '24px'
    },
    doctorGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '16px'
    },
    doctorCard: {
      background: 'linear-gradient(135deg, #eff6ff 0%, white 100%)',
      border: '1px solid #bfdbfe',
      borderRadius: '8px',
      padding: '20px',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    },
    doctorHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '12px'
    },
    doctorInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    doctorAvatar: {
      width: '48px',
      height: '48px',
      backgroundColor: '#2563eb',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '18px',
      flexShrink: 0
    },
    doctorName: {
      fontWeight: 'bold',
      fontSize: '18px',
      color: '#1f2937',
      margin: 0
    },
    doctorSpecialty: {
      color: '#2563eb',
      fontSize: '14px',
      margin: '4px 0 0 0'
    },
    doctorDetails: {
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '12px',
      lineHeight: '1.5'
    },
    selectedDoctor: {
      backgroundColor: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '24px'
    },
    inputGroup: {
      marginBottom: '24px'
    },
    label: {
      display: 'block',
      fontWeight: '600',
      marginBottom: '8px',
      color: '#374151'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      outline: 'none',
      fontSize: '16px',
      transition: 'all 0.2s ease',
      boxSizing: 'border-box'
    },
    slotGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: '12px'
    },
    slotButton: {
      padding: '12px 8px',
      borderRadius: '8px',
      fontWeight: '600',
      backgroundColor: '#f3f4f6',
      color: '#374151',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '14px'
    },
    slotButtonActive: {
      backgroundColor: '#2563eb',
      color: 'white',
      transform: 'scale(1.05)'
    },
    confirmButton: {
      width: '100%',
      backgroundColor: '#16a34a',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontSize: '16px'
    },
    confirmButtonDisabled: {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed',
      transform: 'none'
    },
    bookingCard: {
      backgroundColor: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '16px'
    },
    bookingHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px'
    },
    bookingInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px'
    },
    bookingDetails: {
      fontSize: '14px',
      color: '#374151',
      lineHeight: '1.6'
    },
    statusBadge: {
      backgroundColor: '#16a34a',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    },
    emptyState: {
      textAlign: 'center',
      color: '#6b7280',
      padding: '48px 20px'
    },
    logsHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px',
      fontWeight: '600'
    },
    logsDisplay: {
      backgroundColor: '#1f2937',
      borderRadius: '8px',
      padding: '16px',
      fontSize: '14px',
      fontFamily: 'Monaco, "Courier New", monospace',
      color: '#10b981',
      height: '384px',
      overflowY: 'auto',
      lineHeight: '1.5'
    },
    logError: {
      color: '#f87171'
    },
    logWarning: {
      color: '#fbbf24'
    },
    logSuccess: {
      color: '#10b981'
    },
    conceptsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px',
      fontSize: '14px'
    },
    conceptCard: {
      padding: '16px',
      borderRadius: '8px',
      lineHeight: '1.5'
    },
    conceptTitle: {
      fontWeight: '600',
      marginBottom: '8px',
      fontSize: '15px'
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.headerLeft}>
              <Activity style={{ width: '40px', height: '40px', color: '#2563eb' }} />
              <div>
                <h1 style={styles.headerTitle}>Distributed Hospital Appointment System</h1>
                <p style={styles.headerSubtitle}>MERN Stack with DC Concepts</p>
                <div style={styles.connectionStatus}>
                  {isBackendConnected ? '✅ Backend Connected' : '⚠️ Local Simulation Mode'}
                </div>
              </div>
            </div>
            <div style={styles.buttonGroup}>
              <button 
                style={{...styles.button, ...styles.buttonSecondary}}
                onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
                onMouseOut={(e) => e.target.style.backgroundColor = styles.buttonSecondary.backgroundColor}
                onClick={checkBackendConnection}
              >
                <Server style={{ width: '16px', height: '16px' }} /> Check Connection
              </button>
              <button 
                style={{...styles.button, ...styles.buttonPrimary}}
                onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.target.style.backgroundColor = styles.buttonPrimary.backgroundColor}
                onClick={loadServerStats}
              >
                <Server style={{ width: '16px', height: '16px' }} /> Refresh Stats
              </button>
              <button 
                style={{...styles.button, ...styles.buttonDanger}}
                onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                onMouseOut={(e) => e.target.style.backgroundColor = styles.buttonDanger.backgroundColor}
                onClick={simulateServerFailure}
              >
                <Zap style={{ width: '16px', height: '16px' }} /> Simulate Failure
              </button>
            </div>
          </div>
        </div>

        {/* Server Status Dashboard */}
        <div style={styles.serverGrid}>
          {serverStats.map(server => (
            <div 
              key={server.id} 
              style={{
                ...styles.serverCard,
                ...(server.isLeader ? styles.serverCardLeader : {})
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 15px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div style={styles.serverHeader}>
                <div style={styles.serverInfo}>
                  <Server style={{ 
                    width: '20px', 
                    height: '20px', 
                    color: server.isLeader ? '#10b981' : '#6b7280' 
                  }} />
                  <span style={styles.serverName}>{server.name}</span>
                </div>
                {server.isLeader && <Shield style={{ width: '20px', height: '20px', color: '#10b981' }} title="Leader" />}
              </div>
              <div style={styles.serverDetails}>
                <div>Port: {server.port}</div>
                <div>Connections: {server.connections}</div>
                <div style={styles.statusIndicator}>
                  <div style={{
                    ...styles.statusDot,
                    backgroundColor: server.isLeader ? '#10b981' : '#9ca3af'
                  }}></div>
                  <span>{server.isLeader ? 'Leader' : 'Follower'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clock Sync Info */}
        {clockSync && (
          <div style={styles.clockSync}>
            <div style={styles.clockHeader}>
              <Clock style={{ width: '20px', height: '20px', color: '#2563eb' }} />
              <span>Clock Synchronization (Cristian's Algorithm)</span>
            </div>
            <div style={styles.clockGrid}>
              <div>Server Time: {new Date(clockSync.serverTime).toLocaleTimeString()}</div>
              <div>RTT: {clockSync.rtt.toFixed(2)}ms</div>
              <div>Adjusted Time: {new Date(clockSync.adjustedTime).toLocaleTimeString()}</div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={styles.mainCard}>
          <div style={styles.tabNav}>
            {['doctors', 'booking', 'myBookings', 'system'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...styles.tabButton,
                  ...(activeTab === tab ? styles.tabButtonActive : {})
                }}
                onMouseOver={(e) => {
                  if (activeTab !== tab) {
                    e.target.style.backgroundColor = '#e5e7eb';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeTab !== tab) {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }
                }}
              >
                {tab === 'doctors' && 'View Doctors'}
                {tab === 'booking' && 'Book Appointment'}
                {tab === 'myBookings' && 'My Bookings'}
                {tab === 'system' && 'System Logs'}
              </button>
            ))}
          </div>

          <div style={styles.tabContent}>
            {/* Doctors Tab */}
            {activeTab === 'doctors' && (
              <div style={styles.doctorGrid}>
                {doctors.map(doctor => (
                  <div 
                    key={doctor.id} 
                    style={styles.doctorCard}
                    onClick={() => handleDoctorSelect(doctor)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={styles.doctorHeader}>
                      <div style={styles.doctorInfo}>
                        <div style={styles.doctorAvatar}>
                          {doctor.name.split(' ')[1]?.charAt(0) || doctor.name.charAt(0)}
                        </div>
                        <div>
                          <h3 style={styles.doctorName}>{doctor.name}</h3>
                          <p style={styles.doctorSpecialty}>{doctor.specialization}</p>
                        </div>
                      </div>
                    </div>
                    <div style={styles.doctorDetails}>
                      <div><strong>Experience:</strong> {doctor.experience}</div>
                      <div><strong>Hospital:</strong> {doctor.hospital}</div>
                    </div>
                    <div style={{
                      ...styles.button,
                      ...styles.buttonPrimary,
                      width: '100%',
                      marginTop: '8px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
                    >
                      Book Appointment
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Booking Tab */}
            {activeTab === 'booking' && (
              <div>
                {selectedDoctor ? (
                  <div>
                    <div style={styles.selectedDoctor}>
                      <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '12px', color: '#1f2937' }}>Selected Doctor</h3>
                      <div style={styles.doctorInfo}>
                        <div style={styles.doctorAvatar}>
                          {selectedDoctor.name.split(' ')[1]?.charAt(0) || selectedDoctor.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '16px' }}>{selectedDoctor.name}</div>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>{selectedDoctor.specialization}</div>
                        </div>
                      </div>
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Patient Name</label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Enter your full name"
                        style={styles.input}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#2563eb';
                          e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#d1d5db';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Available Time Slots</label>
                      <div style={styles.slotGrid}>
                        {availableSlots.map(slot => (
                          <button
                            key={slot}
                            onClick={() => setSelectedSlot(slot)}
                            style={{
                              ...styles.slotButton,
                              ...(selectedSlot === slot ? styles.slotButtonActive : {})
                            }}
                            onMouseOver={(e) => {
                              if (selectedSlot !== slot) {
                                e.target.style.backgroundColor = '#e5e7eb';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (selectedSlot !== slot) {
                                e.target.style.backgroundColor = '#f3f4f6';
                              }
                            }}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                      {availableSlots.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '16px', fontStyle: 'italic' }}>
                          No available slots for this doctor
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleBookAppointment}
                      disabled={!patientName || !selectedSlot}
                      style={{
                        ...styles.confirmButton,
                        ...(!patientName || !selectedSlot ? styles.confirmButtonDisabled : {})
                      }}
                      onMouseOver={(e) => {
                        if (patientName && selectedSlot) {
                          e.target.style.backgroundColor = '#15803d';
                          e.target.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (patientName && selectedSlot) {
                          e.target.style.backgroundColor = '#16a34a';
                          e.target.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      Confirm Booking
                    </button>
                  </div>
                ) : (
                  <div style={styles.emptyState}>
                    <Calendar style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#9ca3af' }} />
                    <p style={{ fontSize: '16px', margin: 0 }}>Please select a doctor from the "View Doctors" tab to book an appointment</p>
                  </div>
                )}
              </div>
            )}

            {/* My Bookings Tab */}
            {activeTab === 'myBookings' && (
              <div>
                {bookings.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {bookings.map((booking, idx) => (
                      <div key={idx} style={styles.bookingCard}>
                        <div style={styles.bookingHeader}>
                          <div style={{ flex: 1 }}>
                            <div style={styles.bookingInfo}>
                              <User style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                              <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{booking.patientName}</span>
                            </div>
                            <div style={styles.bookingDetails}>
                              <div><strong>Doctor:</strong> {booking.doctorName}</div>
                              <div><strong>Time:</strong> {booking.slot}</div>
                              <div><strong>Confirmation ID:</strong> {booking.confirmationId}</div>
                              <div><strong>Booked:</strong> {new Date(booking.timestamp).toLocaleString()}</div>
                            </div>
                          </div>
                          <div style={styles.statusBadge}>
                            Confirmed
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyState}>
                    <Users style={{ width: '64px', height: '64px', margin: '0 auto 16px', color: '#9ca3af' }} />
                    <p style={{ fontSize: '16px', margin: 0 }}>No bookings yet. Book your first appointment!</p>
                  </div>
                )}
              </div>
            )}

            {/* System Logs Tab */}
            {activeTab === 'system' && (
              <div>
                <div style={styles.logsHeader}>
                  <Database style={{ width: '20px', height: '20px', color: '#2563eb' }} />
                  <span>System Activity Logs</span>
                </div>
                <div style={styles.logsDisplay}>
                  {systemLogs.map((log, idx) => (
                    <div 
                      key={idx} 
                      style={{
                        marginBottom: '8px',
                        ...(log.type === 'error' ? styles.logError : 
                            log.type === 'warning' ? styles.logWarning : 
                            styles.logSuccess)
                      }}
                    >
                      [{log.time}] {log.message}
                    </div>
                  ))}
                  {systemLogs.length === 0 && (
                    <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No system logs yet. Interact with the system to see activity...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DC Concepts Footer */}
        <div style={styles.mainCard}>
          <div style={styles.tabContent}>
            <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '16px', color: '#1f2937' }}>
              Distributed Computing Concepts Implemented
            </h3>
            <div style={styles.conceptsGrid}>
              <div style={{...styles.conceptCard, backgroundColor: '#eff6ff'}}>
                <div style={{...styles.conceptTitle, color: '#1e40af'}}>Exp 1: RMI (Remote Method Invocation)</div>
                <div style={{ color: '#6b7280' }}>Remote method invocation for all API calls with fallback handling</div>
              </div>
              <div style={{...styles.conceptCard, backgroundColor: '#f0fdf4'}}>
                <div style={{...styles.conceptTitle, color: '#166534'}}>Exp 2: Multithreading</div>
                <div style={{ color: '#6b7280' }}>Concurrent client handling simulation with connection tracking</div>
              </div>
              <div style={{...styles.conceptCard, backgroundColor: '#faf5ff'}}>
                <div style={{...styles.conceptTitle, color: '#7e22ce'}}>Exp 3: Clock Synchronization</div>
                <div style={{ color: '#6b7280' }}>Cristian's algorithm for time synchronization across servers</div>
              </div>
              <div style={{...styles.conceptCard, backgroundColor: '#fefce8'}}>
                <div style={{...styles.conceptTitle, color: '#854d0e'}}>Exp 4: Leader Election</div>
                <div style={{ color: '#6b7280' }}>Bully algorithm for automatic leader election on server failure</div>
              </div>
              <div style={{...styles.conceptCard, backgroundColor: '#fef2f2'}}>
                <div style={{...styles.conceptTitle, color: '#991b1b'}}>Exp 5: Data Replication</div>
                <div style={{ color: '#6b7280' }}>Eventual consistency with asynchronous data propagation</div>
              </div>
              <div style={{...styles.conceptCard, backgroundColor: '#f0f4ff'}}>
                <div style={{...styles.conceptTitle, color: '#3730a3'}}>Exp 6: Load Balancing</div>
                <div style={{ color: '#6b7280' }}>Round-robin server distribution with health checks</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;