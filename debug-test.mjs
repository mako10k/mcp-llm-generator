import { spawn } from 'child_process';

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Initialize
const initMsg = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  }
};

server.stdin.write(JSON.stringify(initMsg) + '\n');

// Test with debug
setTimeout(() => {
  const testMsg = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "shared-memory-create",
      arguments: {
        title: "Test Memory",
        content: "This is a test memory",
        permission_level: "edit",
        creator_persona_id: "test-persona"
      }
    }
  };
  
  console.log('Sending test message:', JSON.stringify(testMsg, null, 2));
  server.stdin.write(JSON.stringify(testMsg) + '\n');
  
  setTimeout(() => {
    server.kill();
  }, 3000);
}, 1000);

server.stdout.on('data', (data) => {
  console.log('===== STDOUT =====');
  console.log(data.toString());
});

server.stderr.on('data', (data) => {
  console.log('===== STDERR =====');
  console.log(data.toString());
});

server.on('close', (code) => {
  console.log('Server closed with code:', code);
});
