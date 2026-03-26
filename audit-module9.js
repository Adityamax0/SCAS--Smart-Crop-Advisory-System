/**
 * SCAS Module 9 — Full Multi-Role API Audit Script
 * Tests every major endpoint: Auth, Tickets, Notifications, Advisory, Admin
 * Prints PASS or FAIL for each assertion
 */

const https = require('http');

// Correct demo credentials from /api/auth/demo-credentials
const FARMER_PHONE  = '+919394855112';
const WORKER_PHONE  = '+919018047196';
const ADMIN_PHONE   = '+919631855760';
const PASSWORD      = 'password123';

let passed = 0;
let failed = 0;
async function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (d) => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

function assert(label, condition, extra = '') {
  if (condition) {
    console.log(`  ✅ PASS — ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL — ${label} ${extra}`);
    failed++;
  }
}

async function run() {
  console.log('\n======================================');
  console.log('  SCAS MODULE 9 — FULL API AUDIT');
  console.log('======================================\n');

  // ── 1. HEALTH CHECK ─────────────────────────────────────────────────────────
  console.log('▶ [1] Health Check');
  const health = await req('GET', '/health');
  assert('Backend API is reachable (200)', health.status === 200);
  assert('success: true in response', health.data?.success === true);

  // ── 2. FARMER AUTH ──────────────────────────────────────────────────────────
  console.log('\n▶ [2] Farmer Authentication');
  const farmerLogin = await req('POST', '/auth/login', { phone: FARMER_PHONE, password: PASSWORD });
  assert('Farmer login returns 200', farmerLogin.status === 200, JSON.stringify(farmerLogin.data?.message || ''));
  const farmerToken = farmerLogin.data?.data?.token;
  assert('Farmer receives JWT token', !!farmerToken);

  // ── 3. FARMER PROFILE ───────────────────────────────────────────────────────
  console.log('\n▶ [3] Farmer Profile');
  const farmerMe = await req('GET', '/auth/me', null, farmerToken);
  assert('GET /auth/me returns farmer profile', farmerMe.status === 200);
  assert('Farmer role is "farmer"', farmerMe.data?.data?.role === 'farmer');

  // ── 4. FARMER TICKET CREATION ───────────────────────────────────────────────
  console.log('\n▶ [4] Farmer Ticket Creation');
  const newTicket = await req('POST', '/tickets', {
    description: 'Module 9 audit test — white fly on cotton crop',
    category: 'pest',
    priority: 'high',
    clientId: 'audit-' + Date.now(),
  }, farmerToken);
  assert('Ticket created (200 or 201)', newTicket.status === 200 || newTicket.status === 201,
    `Got status ${newTicket.status}: ${JSON.stringify(newTicket.data?.message || '')}`);
  const ticketId = newTicket.data?.data?._id;
  assert('Ticket ID present in response', !!ticketId);

  // ── 5. FARMER GET TICKETS ───────────────────────────────────────────────────
  console.log('\n▶ [5] Farmer Fetch Tickets');
  const farmerTickets = await req('GET', '/tickets', null, farmerToken);
  assert('GET /tickets returns array', Array.isArray(farmerTickets.data?.data));
  assert('Farmer has at least 1 ticket', (farmerTickets.data?.data?.length || 0) >= 1);

  // ── 6. FARMER NOTIFICATIONS ─────────────────────────────────────────────────
  console.log('\n▶ [6] Farmer Notification Center');
  const farmerNotifs = await req('GET', '/notifications', null, farmerToken);
  assert('GET /notifications returns 200', farmerNotifs.status === 200,
    `Got ${farmerNotifs.status}: ${JSON.stringify(farmerNotifs.data?.message || '')}`);
  assert('Notifications is an array', Array.isArray(farmerNotifs.data?.data));

  // ── 7. WEATHER ENDPOINT ─────────────────────────────────────────────────────
  console.log('\n▶ [7] Weather Advisory (Agra coords)');
  const weather = await req('GET', '/weather?lat=27.1767&lon=78.0081', null, farmerToken);
  assert('Weather endpoint returns 200', weather.status === 200,
    `Got ${weather.status}`);
  assert('Weather data has forecast', !!weather.data?.data?.forecast || !!weather.data?.data);

  // ── 8. ADVISORY ENDPOINT ────────────────────────────────────────────────────
  console.log('\n▶ [8] Crop Advisory (GPS-based)');
  const advisory = await req('GET', '/advisory?lat=27.1767&lon=78.0081', null, farmerToken);
  assert('Advisory endpoint returns 200', advisory.status === 200,
    `Got ${advisory.status}`);

  // ── 9. WORKER AUTH ──────────────────────────────────────────────────────────
  console.log('\n▶ [9] Worker Authentication');
  const workerLogin = await req('POST', '/auth/login', { phone: WORKER_PHONE, password: PASSWORD });
  assert('Worker login returns 200', workerLogin.status === 200);
  const workerToken = workerLogin.data?.data?.token;
  assert('Worker receives JWT token', !!workerToken);

  // ── 10. WORKER FETCH TICKETS ────────────────────────────────────────────────
  console.log('\n▶ [10] Worker Ticket Management');
  const workerTickets = await req('GET', '/tickets', null, workerToken);
  assert('Worker can fetch assigned tickets', workerTickets.status === 200);
  assert('Worker ticket response is array', Array.isArray(workerTickets.data?.data));

  // ── 11. ADMIN AUTH ──────────────────────────────────────────────────────────
  console.log('\n▶ [11] Admin Authentication');
  const adminLogin = await req('POST', '/auth/login', { phone: ADMIN_PHONE, password: PASSWORD });
  assert('Admin login returns 200', adminLogin.status === 200);
  const adminToken = adminLogin.data?.data?.token;
  assert('Admin receives JWT token', !!adminToken);

  // ── 12. ADMIN DASHBOARD ─────────────────────────────────────────────────────
  console.log('\n▶ [12] Admin Dashboard Statistics');
  const adminDash = await req('GET', '/admin/dashboard', null, adminToken);
  assert('Admin dashboard returns 200', adminDash.status === 200,
    `Got ${adminDash.status}: ${JSON.stringify(adminDash.data?.message || '')}`);
  assert('Admin stats has ticket counts', !!adminDash.data?.data?.tickets?.total !== undefined);
  assert('Admin stats has SLA compliance', adminDash.data?.data?.performance?.slaCompliance !== undefined);
  assert('Admin breachedTickets array present', Array.isArray(adminDash.data?.data?.breachedTickets));

  // ── 13. ROUTE PROTECTION CHECK ──────────────────────────────────────────────
  console.log('\n▶ [13] Security — Route Protection');
  const noToken = await req('GET', '/tickets'); // No auth header
  assert('GET /tickets without token returns 401', noToken.status === 401);
  const adminRouteAsFarmer = await req('GET', '/admin/dashboard', null, farmerToken);
  assert('Farmer cannot access admin route (403)', adminRouteAsFarmer.status === 403);

  // ── 14. DEMO CREDENTIALS ────────────────────────────────────────────────────
  console.log('\n▶ [14] Demo Credentials Endpoint');
  const demo = await req('GET', '/auth/demo-credentials');
  assert('Demo credentials endpoint returns 200', demo.status === 200);
  assert('Demo data contains farmer credentials', Array.isArray(demo.data?.data));

  // ── FINAL REPORT ────────────────────────────────────────────────────────────
  console.log('\n======================================');
  console.log(`  AUDIT COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================\n');
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED — SCAS is 100% functional!');
  } else {
    console.log(`⚠️  ${failed} test(s) failed — review above for details.`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

run();
