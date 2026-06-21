const net = require('net');
const client = new net.Socket();
client.connect(4723, '127.0.0.1', () => {
  console.log('Connected to 127.0.0.1:4723!');
  client.write('GET /status HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
});
client.on('data', (data) => {
  console.log('Response:\n', data.toString());
  client.destroy();
});
client.on('error', (err) => {
  console.error('Error:', err);
});
