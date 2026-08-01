/**
 * Stats and Search & Filter API Test
 * Run: npm run test:stats
 */

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function run() {
  console.log('\n=== Step 1: Testing GET /api/receipts/stats ===');
  const statsRes = await fetch(`${BASE_URL}/receipts/stats`);
  const statsData = await statsRes.json();

  console.log('Status:', statsRes.status);
  console.log('Stats Output:', JSON.stringify(statsData, null, 2));

  if (statsRes.status !== 200 || statsData.status !== 'success') {
    console.error('FAIL: Stats endpoint error');
    process.exit(1);
  }

  const { totalCount, todayCount, pendingCount, receivedCount, paidCount, toPayCount } = statsData.data;
  if (typeof totalCount !== 'number' || typeof pendingCount !== 'number') {
    console.error('FAIL: Missing required numeric count fields in stats response');
    process.exit(1);
  }
  console.log('✓ Stats endpoint verified!');

  // Create test receipts for search and filtering
  console.log('\n=== Step 2: Creating Test Receipts for Filter Tests ===');
  const testLr = `LR-FILTER-${Date.now()}`;
  const createRes = await fetch(`${BASE_URL}/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lrNumber: testLr,
      date: '2026-08-01',
      consignor: 'Filter Seller Corp',
      consignee: 'Filter Buyer LLC',
      destination: 'Hyderabad',
      freightType: 'To Pay',
      acknowledgementStatus: 'Pending',
    }),
  });

  const createData = await createRes.json();
  if (createRes.status !== 201) {
    console.error('FAIL: Failed to create test receipt', createData);
    process.exit(1);
  }
  console.log('✓ Created test receipt:', testLr);

  // Search by LR Number
  console.log('\n=== Step 3: Search Query Filter GET /api/receipts?search=... ===');
  const searchRes = await fetch(`${BASE_URL}/receipts?search=${encodeURIComponent(testLr)}`);
  const searchData = await searchRes.json();

  console.log('Search Status:', searchRes.status);
  console.log('Results Found:', searchData.count);

  if (searchRes.status !== 200 || searchData.count < 1) {
    console.error('FAIL: Search did not return created record');
    process.exit(1);
  }

  // Filter by acknowledgementStatus = Pending
  console.log('\n=== Step 4: Status Filter GET /api/receipts?acknowledgementStatus=Pending ===');
  const filterRes = await fetch(`${BASE_URL}/receipts?acknowledgementStatus=Pending&freightType=To%20Pay`);
  const filterData = await filterRes.json();

  console.log('Filter Status:', filterRes.status);
  console.log('Filtered Results Count:', filterData.count);

  if (filterRes.status !== 200) {
    console.error('FAIL: Multi-filter query failed');
    process.exit(1);
  }

  // Clean up test receipt
  const receiptId = createData.data._id;
  await fetch(`${BASE_URL}/receipts/${receiptId}`, { method: 'DELETE' });
  console.log('✓ Test receipt cleaned up.');

  console.log('\nPASS: Dashboard Stats & Search/Filter API test succeeded!');
}

run().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
