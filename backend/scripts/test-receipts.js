/**
 * Receipt CRUD API test script
 * Run: npm run test:receipts
 * Requires backend running on PORT (default 5000)
 */

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

let passed = 0;
let failed = 0;
let createdId = null;

function log(label, detail = '') {
  const icon = label === 'PASS' ? '✓' : label === 'FAIL' ? '✗' : '→';
  console.log(`${icon} ${detail}`);
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function assert(condition, message) {
  if (condition) {
    passed++;
    log('PASS', message);
  } else {
    failed++;
    log('FAIL', message);
  }
}

const sampleReceipt = {
  lrNumber: `LR-TEST-${Date.now()}`,
  date: '2026-08-01',
  consignor: 'ABC Traders',
  consignee: 'XYZ Stores',
  destination: 'Chennai',
  articles: '10 boxes',
  description: 'Electronics goods',
  invoiceNumber: 'INV-001',
  freightType: 'Paid',
  acknowledgementStatus: 'Pending',
  remarks: 'Handle with care',
  enteredBy: 'test-script',
  verificationStatus: 'Pending',
};

async function runTests() {
  console.log('\n=== Receipt CRUD API Tests ===\n');
  log('INFO', `Target: ${BASE_URL}/receipts\n`);

  // Health check
  const health = await request('GET', '/health');
  assert(health.status === 200, 'GET /health returns 200');

  // CREATE
  const create = await request('POST', '/receipts', sampleReceipt);
  assert(create.status === 201, 'POST /receipts returns 201');
  assert(create.data?.status === 'success', 'POST response has status success');
  assert(create.data?.data?.lrNumber === sampleReceipt.lrNumber, 'POST returns created receipt');
  createdId = create.data?.data?._id;

  // CREATE duplicate LR (warn, don't block)
  const duplicate = await request('POST', '/receipts', {
    ...sampleReceipt,
    consignor: 'Different Consignor',
  });
  assert(duplicate.status === 201, 'POST duplicate LR still returns 201');
  assert(
    Array.isArray(duplicate.data?.warnings) && duplicate.data.warnings.length > 0,
    'POST duplicate LR includes warnings',
  );

  // Validation error
  const invalid = await request('POST', '/receipts', { lrNumber: 'LR-ONLY' });
  assert(invalid.status === 400, 'POST missing fields returns 400');
  assert(invalid.data?.errors?.length > 0, 'POST validation returns errors array');

  // LIST
  const list = await request('GET', '/receipts');
  assert(list.status === 200, 'GET /receipts returns 200');
  assert(list.data?.count >= 2, 'GET /receipts returns receipts');

  // GET BY ID
  const getOne = await request('GET', `/receipts/${createdId}`);
  assert(getOne.status === 200, 'GET /receipts/:id returns 200');
  assert(getOne.data?.data?._id === createdId, 'GET /receipts/:id returns correct receipt');

  // GET invalid ID
  const notFound = await request('GET', '/receipts/000000000000000000000000');
  assert(notFound.status === 404, 'GET /receipts/:id returns 404 for missing');

  // UPDATE
  const update = await request('PUT', `/receipts/${createdId}`, {
    destination: 'Bangalore',
    freightType: 'To Pay',
  });
  assert(update.status === 200, 'PUT /receipts/:id returns 200');
  assert(update.data?.data?.destination === 'Bangalore', 'PUT updates fields');
  assert(update.data?.data?.freightType === 'To Pay', 'PUT updates enum field');

  // DELETE duplicate created in duplicate test
  if (duplicate.data?.data?._id) {
    await request('DELETE', `/receipts/${duplicate.data.data._id}`);
  }

  // DELETE
  const del = await request('DELETE', `/receipts/${createdId}`);
  assert(del.status === 200, 'DELETE /receipts/:id returns 200');

  const gone = await request('GET', `/receipts/${createdId}`);
  assert(gone.status === 404, 'GET after DELETE returns 404');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test run failed:', err.message);
  process.exit(1);
});
