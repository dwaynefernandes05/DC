const { spawn } = require('child_process');
const path = require('path');

class ServerManager {
  constructor() {
    this.servers = [
      { id: 1, port: 5001, process: null },
      { id: 2, port: 5002, process: null },
      { id: 3, port: 5003, process: null }
    ];
    this.isRunning = false;
  }

  async startAllServers() {
    console.log('🚀 Starting all server instances...');
    
    for (const server of this.servers) {
      await this.startServer(server);
      // Wait a bit between starting servers to avoid port conflicts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.isRunning = true;
    console.log('✅ All servers started successfully!');
    console.log('📡 Server URLs:');
    console.log('   - Server 1: http://localhost:5001');
    console.log('   - Server 2: http://localhost:5002');
    console.log('   - Server 3: http://localhost:5003');
    console.log('');
    console.log('🛑 Press Ctrl+C to stop all servers');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async startServer(server) {
    return new Promise((resolve, reject) => {
      console.log(`🖥️  Starting Server ${server.id} on port ${server.port}...`);
      
      const serverProcess = spawn('node', ['server.js'], {
        env: {
          ...process.env,
          PORT: server.port,
          SERVER_ID: server.id
        },
        stdio: 'inherit'
      });

      server.process = serverProcess;

      serverProcess.on('error', (error) => {
        console.error(`❌ Failed to start Server ${server.id}:`, error);
        reject(error);
      });

      serverProcess.on('spawn', () => {
        console.log(`✅ Server ${server.id} started on port ${server.port}`);
        resolve();
      });

      serverProcess.on('exit', (code) => {
        if (this.isRunning) {
          console.log(`⚠️  Server ${server.id} exited with code ${code}`);
        }
      });
    });
  }

  async shutdown() {
    console.log('\n🛑 Shutting down all servers...');
    this.isRunning = false;
    
    const shutdownPromises = this.servers.map(server => {
      if (server.process) {
        return new Promise((resolve) => {
          server.process.on('exit', () => {
            console.log(`✅ Server ${server.id} stopped`);
            resolve();
          });
          server.process.kill('SIGTERM');
        });
      }
      return Promise.resolve();
    });

    await Promise.all(shutdownPromises);
    console.log('👋 All servers stopped. Goodbye!');
    process.exit(0);
  }
}

// Start servers if this file is run directly
if (require.main === module) {
  const manager = new ServerManager();
  manager.startAllServers().catch(console.error);
}

module.exports = ServerManager;


