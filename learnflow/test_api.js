async function test() {
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'salut' }], className: '10A' })
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Data:', data);
}
test();
