const axios = require('axios');
const Database = require('./database');

class DistributedManager {
  constructor(serverId, port) {
    this.serverId = serverId;
    this.port = port;
    this.db = new Database();
    this.servers = [
      { id: 1, name: 'Server-Mumbai', port: 5001 },
      { id: 2, name: 'Server-Delhi', port: 5002 },
      { id: 3, name: 'Server-Bangalore', port: 5003 }
    ];
    this.isLeader = false;
    this.connections = 0;
    this.clockOffset = 0;
    this.lastHeartbeat = Date.now();
    
    // Start periodic tasks
    this.startHeartbeat();
    this.startLeaderCheck();
  }

  // ============ LOAD BALANCING ============
  getNextServer() {
    // Round-robin load balancing
    const activeServers = this.servers.filter(s => s.id !== this.serverId);
    const randomIndex = Math.floor(Math.random() * activeServers.length);
    return activeServers[randomIndex];
  }

  // ============ LEADER ELECTION (Bully Algorithm) ============
  async performBullyElection() {
    console.log(`[LEADER ELECTION] Server ${this.serverId} initiating Bully election...`);
    
    try {
      // Get all servers with higher IDs
      const higherServers = this.servers.filter(s => s.id > this.serverId);
      
      if (higherServers.length === 0) {
        // This server has the highest ID, become leader
        await this.becomeLeader();
        return;
      }

      // Send election messages to higher servers
      let responses = 0;
      for (const server of higherServers) {
        try {
          const response = await axios.post(`http://localhost:${server.port}/api/servers/election`, {
            candidateId: this.serverId,
            timestamp: Date.now()
          }, { timeout: 2000 });
          
          if (response.data.success) {
            console.log(`[LEADER ELECTION] Server ${server.id} is alive, election aborted`);
            return;
          }
        } catch (error) {
          console.log(`[LEADER ELECTION] Server ${server.id} is down`);
        }
        responses++;
      }

      // If no higher server responded, become leader
      if (responses === higherServers.length) {
        await this.becomeLeader();
      }
    } catch (error) {
      console.error('[LEADER ELECTION] Error during election:', error);
    }
  }

  async becomeLeader() {
    console.log(`[LEADER ELECTION] Server ${this.serverId} becoming leader!`);
    this.isLeader = true;
    await this.db.setLeader(this.serverId);
    await this.db.updateServerStatus(this.serverId, this.connections, true, 'active');
    
    // Notify other servers
    await this.notifyServersOfNewLeader();
  }

  async notifyServersOfNewLeader() {
    const otherServers = this.servers.filter(s => s.id !== this.serverId);
    
    for (const server of otherServers) {
      try {
        await axios.post(`http://localhost:${server.port}/api/servers/leader-update`, {
          newLeaderId: this.serverId,
          timestamp: Date.now()
        }, { timeout: 1000 });
      } catch (error) {
        console.log(`[LEADER UPDATE] Failed to notify server ${server.id}`);
      }
    }
  }

  // ============ CLOCK SYNCHRONIZATION (Cristian's Algorithm) ============
  async performClockSync(clientTime) {
    console.log('[CLOCK SYNC] Performing Cristian\'s algorithm');
    
    const t0 = clientTime; // Request sent time
    const serverTime = Date.now() + this.clockOffset; // Server's current time
    const t1 = Date.now() + this.clockOffset; // Reply received time
    const rtt = t1 - t0; // Round Trip Time
    const adjustedTime = serverTime + (rtt / 2); // Client adjusted time
    
    console.log(`[CLOCK SYNC] t0: ${t0}, Server: ${serverTime}, t1: ${t1}`);
    console.log(`[CLOCK SYNC] RTT: ${rtt}ms, Adjusted: ${adjustedTime}`);
    
    return { 
      adjustedTime, 
      rtt, 
      serverTime,
      clockOffset: this.clockOffset
    };
  }

  async syncWithLeader() {
    if (this.isLeader) return;
    
    try {
      const leader = this.servers.find(s => s.id !== this.serverId);
      if (!leader) return;

      const startTime = Date.now();
      const response = await axios.get(`http://localhost:${leader.port}/api/clock-sync`, {
        params: { clientTime: startTime },
        timeout: 2000
      });
      
      const endTime = Date.now();
      const rtt = endTime - startTime;
      const serverTime = response.data.serverTime;
      const adjustedTime = serverTime + (rtt / 2);
      
      this.clockOffset = adjustedTime - Date.now();
      console.log(`[CLOCK SYNC] Synced with leader. Offset: ${this.clockOffset}ms`);
      
    } catch (error) {
      console.log('[CLOCK SYNC] Failed to sync with leader');
    }
  }

  // ============ DATA REPLICATION ============
  async replicateBooking(bookingData) {
    console.log('[REPLICATION] Replicating booking data to other servers');
    
    const otherServers = this.servers.filter(s => s.id !== this.serverId);
    
    for (const server of otherServers) {
      try {
        await axios.post(`http://localhost:${server.port}/api/replicate/booking`, bookingData, {
          timeout: 2000
        });
        console.log(`[REPLICATION] Successfully replicated to server ${server.id}`);
      } catch (error) {
        console.log(`[REPLICATION] Failed to replicate to server ${server.id}`);
      }
    }
  }

  async replicateSlotUpdate(doctorId, slotTime) {
    console.log('[REPLICATION] Replicating slot update to other servers');
    
    const otherServers = this.servers.filter(s => s.id !== this.serverId);
    
    for (const server of otherServers) {
      try {
        await axios.post(`http://localhost:${server.port}/api/replicate/slot`, {
          doctorId,
          slotTime
        }, { timeout: 2000 });
        console.log(`[REPLICATION] Successfully replicated slot update to server ${server.id}`);
      } catch (error) {
        console.log(`[REPLICATION] Failed to replicate slot update to server ${server.id}`);
      }
    }
  }

  // ============ CONCURRENT HANDLING ============
  async handleConcurrentRequests(requests) {
    console.log(`[CONCURRENT] Handling ${requests.length} concurrent requests`);
    
    // Process requests in parallel with connection tracking
    this.connections += requests.length;
    
    try {
      const results = await Promise.all(
        requests.map(async (request, index) => {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return { requestId: index, processedBy: this.serverId };
        })
      );
      
      this.connections -= requests.length;
      return results;
    } catch (error) {
      this.connections -= requests.length;
      throw error;
    }
  }

  // ============ HEARTBEAT & MONITORING ============
  startHeartbeat() {
    setInterval(async () => {
      this.lastHeartbeat = Date.now();
      await this.db.updateServerHeartbeat(this.serverId);
    }, 5000); // Update every 5 seconds
  }

  startLeaderCheck() {
    setInterval(async () => {
      if (!this.isLeader) return;
      
      // Check if other servers are responding
      const otherServers = this.servers.filter(s => s.id !== this.serverId);
      
      for (const server of otherServers) {
        try {
          await axios.get(`http://localhost:${server.port}/api/health`, { timeout: 2000 });
        } catch (error) {
          console.log(`[MONITORING] Server ${server.id} appears to be down`);
          // Could trigger re-election here if needed
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // ============ SERVER STATUS ============
  async getServerStatus() {
    const servers = await this.db.getAllServers();
    return servers.map(server => ({
      id: server.id,
      name: server.name,
      port: server.port,
      connections: server.id === this.serverId ? this.connections : server.connections,
      isLeader: server.is_leader === 1,
      lastHeartbeat: server.last_heartbeat,
      status: server.status,
      clockOffset: server.id === this.serverId ? this.clockOffset : 0
    }));
  }

  // ============ CLEANUP ============
  async shutdown() {
    console.log(`[SHUTDOWN] Server ${this.serverId} shutting down...`);
    await this.db.updateServerStatus(this.serverId, 0, false, 'inactive');
    
    if (this.isLeader) {
      // Trigger election for new leader
      setTimeout(async () => {
        try {
          const otherServers = this.servers.filter(s => s.id !== this.serverId);
          if (otherServers.length > 0) {
            await axios.post(`http://localhost:${otherServers[0].port}/api/servers/election`);
          }
        } catch (error) {
          console.log('[SHUTDOWN] Could not trigger election');
        }
      }, 1000);
    }
    
    await this.db.close();
  }
}

module.exports = DistributedManager;


