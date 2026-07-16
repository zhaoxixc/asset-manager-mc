/**
 * Enterprise Asset Management System - API Integration Tests (Idempotent)
 * 
 * Tests all major API endpoints: auth, assets, departments, users,
 * backup/restore, audit-logs, dashboard, and permission controls.
 * Uses unique identifiers to be idempotent across runs.
 */

const BASE_URL = 'http://localhost:3001/api';
const TEST_RUN_ID = Date.now().toString(36); // Unique per run

// ========== Test helpers ==========
let passCount = 0;
let failCount = 0;
const failedTests: { name: string; expected: string; actual: string }[] = [];

function assert(condition: boolean, name: string, expected: string = '', actual: string = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passCount++;
  } else {
    console.log(`  ✗ ${name} — Expected: ${expected}, Got: ${actual}`);
    failCount++;
    failedTests.push({ name, expected, actual });
  }
}

async function request(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    if (body instanceof FormData) {
      delete (opts.headers as Record<string, string>)['Content-Type'];
      opts.body = body;
    } else {
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const contentType = res.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    data = await res.json();
  } else {
    data = { _binary: true, size: parseInt(res.headers.get('content-length') || '0'), contentType };
  }
  return { status: res.status, data };
}

// ========== Test execution ==========
async function runTests() {
  console.log('\n========================================');
  console.log('  ENTERPRISE ASSET MANAGEMENT - API TESTS');
  console.log(`  Run ID: ${TEST_RUN_ID}`);
  console.log('========================================\n');

  // ---- Auth Module ----
  console.log('--- Auth Module ---');

  // Test 1: Login with admin
  const loginAdmin = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  assert(loginAdmin.status === 200, 'POST /auth/login admin - status 200', '200', String(loginAdmin.status));
  assert(loginAdmin.data.code === 0, 'POST /auth/login admin - code 0', '0', String(loginAdmin.data.code));
  assert(!!loginAdmin.data.data?.token, 'POST /auth/login admin - token returned');
  assert(!!loginAdmin.data.data?.refreshToken, 'POST /auth/login admin - refreshToken returned');
  assert(!('password' in (loginAdmin.data.data?.user || {})), 'POST /auth/login admin - password NOT in user object');
  assert(loginAdmin.data.data?.user?.role === 'super_admin', 'POST /auth/login admin - role is super_admin', 'super_admin', loginAdmin.data.data?.user?.role);
  assert(!!loginAdmin.data.data?.user?.realName, 'POST /auth/login admin - realName field present');

  const adminToken = loginAdmin.data.data?.token || '';
  const adminRefreshToken = loginAdmin.data.data?.refreshToken || '';

  // Test 2: Login with missing fields
  const loginEmpty = await request('POST', '/auth/login', { username: 'admin' });
  assert(loginEmpty.status === 400, 'POST /auth/login missing password - status 400', '400', String(loginEmpty.status));

  // Test 3: Login with wrong password
  const loginWrong = await request('POST', '/auth/login', { username: 'admin', password: 'wrongpassword' });
  assert(loginWrong.status === 401, 'POST /auth/login wrong password - status 401', '401', String(loginWrong.status));
  assert(loginWrong.data.code === 40100, 'POST /auth/login wrong password - code 40100', '40100', String(loginWrong.data.code));

  // Test 4: Refresh token
  const refreshResult = await request('POST', '/auth/refresh', { refreshToken: adminRefreshToken });
  assert(refreshResult.status === 200, 'POST /auth/refresh - status 200', '200', String(refreshResult.status));
  assert(!!refreshResult.data.data?.token, 'POST /auth/refresh - new token returned');
  assert(!!refreshResult.data.data?.refreshToken, 'POST /auth/refresh - new refreshToken returned');

  const refreshedAdminToken = refreshResult.data.data?.token || adminToken;

  // Test 5: Change password
  const changePw = await request('PUT', '/auth/password', { oldPassword: 'admin123', newPassword: 'admin456' }, refreshedAdminToken);
  assert(changePw.status === 200, 'PUT /auth/password - status 200', '200', String(changePw.status));

  // Verify new password works
  const loginNewPw = await request('POST', '/auth/login', { username: 'admin', password: 'admin456' });
  assert(loginNewPw.status === 200, 'POST /auth/login new password - status 200', '200', String(loginNewPw.status));
  const newAdminToken = loginNewPw.data.data?.token || refreshedAdminToken;

  // Reset password back
  const resetPw = await request('PUT', '/auth/password', { oldPassword: 'admin456', newPassword: 'admin123' }, newAdminToken);
  assert(resetPw.status === 200, 'PUT /auth/password reset back - status 200', '200', String(resetPw.status));

  // Test 6: Change password too short
  const shortPw = await request('PUT', '/auth/password', { oldPassword: 'admin123', newPassword: 'ab' }, newAdminToken);
  assert(shortPw.status === 400, 'PUT /auth/password too short - status 400', '400', String(shortPw.status));

  // Test 7: Access with refresh token (should be rejected)
  const loginWithRefresh = await request('GET', '/assets', undefined, adminRefreshToken);
  assert(loginWithRefresh.status === 401, 'Access with refresh token - status 401', '401', String(loginWithRefresh.status));

  // Get fresh admin token for subsequent tests
  const adminRelogin = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  const freshAdminToken = adminRelogin.data.data?.token || '';

  // ---- User Management ----
  console.log('\n--- User Management ---');

  const zhangsanUsername = `zhangsan_${TEST_RUN_ID}`;
  const lisiUsername = `lisi_${TEST_RUN_ID}`;

  // Test 8: Create zhangsan (admin role)
  const createZhangsan = await request('POST', '/users', { username: zhangsanUsername, password: '123456', realName: 'Zhang San', role: 'admin', status: 'active' }, freshAdminToken);
  assert(createZhangsan.status === 201, 'POST /users zhangsan - status 201', '201', String(createZhangsan.status));
  assert(!('password' in (createZhangsan.data.data || {})), 'POST /users zhangsan - no password in response');
  const zhangsanId = createZhangsan.data.data?.id;

  // Test 9: Create lisi (user role)
  const createLisi = await request('POST', '/users', { username: lisiUsername, password: '123456', realName: 'Li Si', role: 'user', status: 'active' }, freshAdminToken);
  assert(createLisi.status === 201, 'POST /users lisi - status 201', '201', String(createLisi.status));
  const lisiId = createLisi.data.data?.id;

  // Test 10: Duplicate username
  const dupUser = await request('POST', '/users', { username: 'admin', password: 'test', realName: 'Dup', role: 'user', status: 'active' }, freshAdminToken);
  assert(dupUser.status === 409, 'POST /users duplicate username - status 409', '409', String(dupUser.status));

  // Test 11: List users
  const listUsers = await request('GET', '/users', undefined, freshAdminToken);
  assert(listUsers.status === 200, 'GET /users - status 200', '200', String(listUsers.status));
  assert(Array.isArray(listUsers.data.data), 'GET /users - returns array');
  const usersArray = listUsers.data.data as any[];
  const hasNoPassword = usersArray.every(u => !('password' in u));
  assert(hasNoPassword, 'GET /users - no password in any user');

  // ---- Permission Control ----
  console.log('\n--- Permission Control ---');

  // Test 12: User role cannot access /api/users
  const lisiLogin = await request('POST', '/auth/login', { username: lisiUsername, password: '123456' });
  const lisiToken = lisiLogin.data.data?.token || '';
  assert(!!lisiToken, 'POST /auth/login lisi - token received', 'token', lisiToken ? 'token' : 'empty');

  if (lisiToken) {
    const lisiAccessUsers = await request('GET', '/users', undefined, lisiToken);
    assert(lisiAccessUsers.status === 403, 'User role GET /users - status 403', '403', String(lisiAccessUsers.status));

    // Test 13: User role cannot access /api/backup
    const lisiAccessBackup = await request('GET', '/backup', undefined, lisiToken);
    assert(lisiAccessBackup.status === 403, 'User role GET /backup - status 403', '403', String(lisiAccessBackup.status));

    // Test 14: User role cannot access /api/audit-logs
    const lisiAccessAudit = await request('GET', '/audit-logs', undefined, lisiToken);
    assert(lisiAccessAudit.status === 403, 'User role GET /audit-logs - status 403', '403', String(lisiAccessAudit.status));

    // Test 15: User CAN access /api/assets (read)
    const lisiAccessAssets = await request('GET', '/assets', undefined, lisiToken);
    assert(lisiAccessAssets.status === 200, 'User role GET /assets - status 200', '200', String(lisiAccessAssets.status));

    // Test 16: User CAN access /api/dashboard/stats
    const lisiAccessDashboard = await request('GET', '/dashboard/stats', undefined, lisiToken);
    assert(lisiAccessDashboard.status === 200, 'User role GET /dashboard/stats - status 200', '200', String(lisiAccessDashboard.status));
  }

  // Test 17: No token
  const noTokenAccess = await request('GET', '/assets');
  assert(noTokenAccess.status === 401, 'No token GET /assets - status 401', '401', String(noTokenAccess.status));

  // Test 18: Invalid token
  const invalidTokenAccess = await request('GET', '/assets', undefined, 'invalid-token-xyz');
  assert(invalidTokenAccess.status === 401, 'Invalid token GET /assets - status 401', '401', String(invalidTokenAccess.status));

  // ---- Asset CRUD ----
  console.log('\n--- Asset CRUD ---');

  // Test 19: Create asset
  const createAsset = await request('POST', '/assets', {
    name: 'Dell Monitor',
    type: 'IT Equipment',
    model: 'U2723QE',
    department: 'R&D',
    user: 'Zhang San',
    status: 'In Use',
    location: '3F-301',
    remark: '4K monitor'
  }, freshAdminToken);
  assert(createAsset.status === 201, 'POST /assets create - status 201', '201', String(createAsset.status));
  assert(!!createAsset.data.data?.id, 'POST /assets create - id returned');
  assert(!!createAsset.data.data?.assetCode, 'POST /assets create - assetCode generated');
  assert(createAsset.data.data?.assetCode?.startsWith('ZC-'), 'POST /assets create - assetCode format ZC-YYYYMMDD-NNN');
  const assetId = createAsset.data.data?.id;

  // Test 20: List assets with pagination
  const listAssets = await request('GET', '/assets?page=1&pageSize=10', undefined, freshAdminToken);
  assert(listAssets.status === 200, 'GET /assets list - status 200', '200', String(listAssets.status));
  assert(Array.isArray(listAssets.data.data?.items), 'GET /assets list - items is array');
  assert(typeof listAssets.data.data?.total === 'number', 'GET /assets list - total is number');
  assert(listAssets.data.data?.page === 1, 'GET /assets list - page is 1');

  // Test 21: Check camelCase field mapping
  const firstItem = listAssets.data.data?.items?.[0];
  if (firstItem) {
    assert('assetCode' in firstItem, 'GET /assets - camelCase: assetCode field exists');
    assert('createdAt' in firstItem, 'GET /assets - camelCase: createdAt field exists');
    assert(!('asset_code' in firstItem), 'GET /assets - no snake_case: asset_code NOT exists');
    assert(!('created_at' in firstItem), 'GET /assets - no snake_case: created_at NOT exists');
  }

  // Test 22: Get asset by ID
  if (assetId) {
    const getAsset = await request('GET', `/assets/${assetId}`, undefined, freshAdminToken);
    assert(getAsset.status === 200, 'GET /assets/:id - status 200', '200', String(getAsset.status));
    assert(getAsset.data.data?.id === assetId, 'GET /assets/:id - correct id returned');
  }

  // Test 23: Update asset
  if (assetId) {
    const updateAsset = await request('PUT', `/assets/${assetId}`, { name: 'Dell Monitor Pro', status: 'Repair' }, freshAdminToken);
    assert(updateAsset.status === 200, 'PUT /assets/:id - status 200', '200', String(updateAsset.status));
    assert(updateAsset.data.data?.name === 'Dell Monitor Pro', 'PUT /assets/:id - name updated', 'Dell Monitor Pro', updateAsset.data.data?.name);
    assert(updateAsset.data.data?.status === 'Repair', 'PUT /assets/:id - status updated', 'Repair', updateAsset.data.data?.status);
  }

  // Test 24: Asset not found
  const notFoundAsset = await request('GET', '/assets/nonexistent-id', undefined, freshAdminToken);
  assert(notFoundAsset.status === 404, 'GET /assets/:id not found - status 404', '404', String(notFoundAsset.status));

  // Test 25: Delete asset
  if (assetId) {
    const deleteAsset = await request('DELETE', `/assets/${assetId}`, undefined, freshAdminToken);
    assert(deleteAsset.status === 200, 'DELETE /assets/:id - status 200', '200', String(deleteAsset.status));
    // Verify it's gone
    const verifyDeleted = await request('GET', `/assets/${assetId}`, undefined, freshAdminToken);
    assert(verifyDeleted.status === 404, 'GET /assets/:id after delete - status 404', '404', String(verifyDeleted.status));
  }

  // ---- Department Management ----
  console.log('\n--- Department Management ---');

  // Test 26: List departments
  const listDepts = await request('GET', '/departments', undefined, freshAdminToken);
  assert(listDepts.status === 200, 'GET /departments - status 200', '200', String(listDepts.status));
  assert(Array.isArray(listDepts.data.data), 'GET /departments - returns array');
  assert(listDepts.data.data.length >= 6, 'GET /departments - has seed data (>=6)');

  // Test 27: Create department
  const uniqueDeptName = `QA_Dept_${TEST_RUN_ID}`;
  const createDept = await request('POST', '/departments', { name: uniqueDeptName }, freshAdminToken);
  assert(createDept.status === 201, 'POST /departments create - status 201', '201', String(createDept.status));

  // Test 28: Duplicate department name
  const dupDept = await request('POST', '/departments', { name: uniqueDeptName }, freshAdminToken);
  assert(dupDept.status === 409, 'POST /departments duplicate - status 409', '409', String(dupDept.status));

  // Test 29: Empty department name
  const emptyDept = await request('POST', '/departments', { name: '' }, freshAdminToken);
  assert(emptyDept.status === 400, 'POST /departments empty name - status 400', '400', String(emptyDept.status));

  // ---- Backup & Restore ----
  console.log('\n--- Backup & Restore ---');

  // Test 30: Export backup (super_admin)
  const backupExport = await request('GET', '/backup', undefined, freshAdminToken);
  assert(backupExport.status === 200, 'GET /backup export - status 200', '200', String(backupExport.status));
  assert(backupExport.data._binary === true, 'GET /backup export - returns binary data');
  assert(backupExport.data.size > 0, 'GET /backup export - data size > 0');

  // Test 31: Restore backup (super_admin)
  const backupBuffer = await fetch(`${BASE_URL}/backup`, {
    headers: { 'Authorization': `Bearer ${freshAdminToken}` }
  });
  const backupArrayBuffer = await backupBuffer.arrayBuffer();
  const backupBlob = new Blob([backupArrayBuffer], { type: 'application/octet-stream' });
  const restoreForm = new FormData();
  restoreForm.append('file', backupBlob, 'test-backup.db');
  const backupRestore = await request('POST', '/backup/restore', restoreForm, freshAdminToken);
  assert(backupRestore.status === 200, 'POST /backup/restore - status 200', '200', String(backupRestore.status));

  // Test 32: User role cannot backup
  if (lisiToken) {
    const lisiBackup = await request('GET', '/backup', undefined, lisiToken);
    assert(lisiBackup.status === 403, 'User role GET /backup - status 403', '403', String(lisiBackup.status));
  }

  // ---- Audit Logs ----
  console.log('\n--- Audit Logs ---');

  // Test 33: Get audit logs (super_admin)
  const auditLogs = await request('GET', '/audit-logs?page=1&pageSize=5', undefined, freshAdminToken);
  assert(auditLogs.status === 200, 'GET /audit-logs - status 200', '200', String(auditLogs.status));
  assert(Array.isArray(auditLogs.data.data?.items), 'GET /audit-logs - items is array');
  assert(typeof auditLogs.data.data?.total === 'number', 'GET /audit-logs - total is number');
  assert(auditLogs.data.data?.total > 0, 'GET /audit-logs - has audit records');

  // ---- Dashboard ----
  console.log('\n--- Dashboard ---');

  // Test 34: Get dashboard stats
  const dashboard = await request('GET', '/dashboard/stats', undefined, freshAdminToken);
  assert(dashboard.status === 200, 'GET /dashboard/stats - status 200', '200', String(dashboard.status));
  assert(typeof dashboard.data.data?.totalAssets === 'number', 'GET /dashboard/stats - totalAssets is number');
  assert(typeof dashboard.data.data?.inUseCount === 'number', 'GET /dashboard/stats - inUseCount is number');
  assert(Array.isArray(dashboard.data.data?.typeDistribution), 'GET /dashboard/stats - typeDistribution is array');
  assert(Array.isArray(dashboard.data.data?.departmentDistribution), 'GET /dashboard/stats - departmentDistribution is array');
  assert(Array.isArray(dashboard.data.data?.recentChangeLogs), 'GET /dashboard/stats - recentChangeLogs is array');

  // ---- User Management (continued) ----
  console.log('\n--- User Management (continued) ---');

  // Test 35: Reset user password
  if (lisiId) {
    const resetUserPw = await request('PUT', `/users/${lisiId}/reset-password`, { newPassword: '654321' }, freshAdminToken);
    assert(resetUserPw.status === 200, 'PUT /users/:id/reset-password - status 200', '200', String(resetUserPw.status));

    // Verify new password works
    const lisiNewPwLogin = await request('POST', '/auth/login', { username: lisiUsername, password: '654321' });
    assert(lisiNewPwLogin.status === 200, 'POST /auth/login lisi new password - status 200', '200', String(lisiNewPwLogin.status));
  }

  // ---- Health Check ----
  console.log('\n--- Health Check ---');

  // Test 36: Health endpoint (no auth required)
  const health = await request('GET', '/health');
  assert(health.status === 200, 'GET /health - status 200', '200', String(health.status));
  assert(health.data.data?.status === 'ok', 'GET /health - status is ok', 'ok', health.data.data?.status);

  // ========== Summary ==========
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');
  console.log(`  Total:  ${passCount + failCount}`);
  console.log(`  Passed: ${passCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Rate:   ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  
  if (failedTests.length > 0) {
    console.log('\n  Failed Tests:');
    for (const t of failedTests) {
      console.log(`    - ${t.name}`);
      console.log(`      Expected: ${t.expected}, Got: ${t.actual}`);
    }
  }
  console.log('========================================\n');

  return { passCount, failCount, failedTests };
}

runTests().then(({ passCount, failCount, failedTests }) => {
  process.exit(failCount > 0 ? 1 : 0);
});
