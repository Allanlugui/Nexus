
import http from 'http';

http.get('http://0.0.0.0:3000/api/system/setup-status', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status Response:', data);
  });
}).on('error', (err) => {
  console.error('Fetch failed:', err.message);
});
