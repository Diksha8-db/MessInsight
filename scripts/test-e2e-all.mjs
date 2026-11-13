const BASE_URL = 'http://localhost:3000';

const results = [];

function record(name, passed, message = '', details = null) {
  results.push({ name, passed, message, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}${message ? ` - ${message}` : ''}`);
  if (!passed && details) {
    console.error('Details:', details);
  }
}

async function run() {
  console.log('====================================================');
  console.log('Starting Complete Functional End-to-End Test Suite');
  console.log('====================================================\n');

  // Helper for requests
  async function api(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      Origin: BASE_URL,
      ...options.headers,
    };
    const res = await globalThis.fetch(url, { ...options, headers });
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    const cookie = res.headers.get('set-cookie');
    return { status: res.status, headers: res.headers, cookie, data };
  }

  // 1. Health API
  try {
    const res = await api('/api/health');
    const isUp = res.data?.data?.status === 'UP' || res.data?.status === 'UP';
    if (res.status === 200 && isUp) {
      record('1. Health Check API', true);
    } else {
      record('1. Health Check API', false, `Status ${res.status}`, res.data);
    }
  } catch (err) {
    record('1. Health Check API', false, err.message);
  }

  // 2. Auth - Validation checks on Registration
  try {
    // 2a. Weak password test
    const weakRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weak User',
        instituteEmail: 'weak@example.com',
        password: 'password123', // missing uppercase, symbol
      }),
    });
    if (weakRes.status === 422 || weakRes.status === 400) {
      record('2a. Register with weak password rejected', true, `Rejected with status ${weakRes.status}`);
    } else {
      record('2a. Register with weak password rejected', false, `Expected 422/400 but got ${weakRes.status}`, weakRes.data);
    }

    // 2b. Accept any email domain
    const testEmail = `tester_${Date.now()}@gmail.com`;
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Valid Tester',
        instituteEmail: testEmail,
        password: 'Password@123',
      }),
    });
    if (regRes.status === 200 || regRes.status === 201) {
      record('2b. Register with non-institutional email (gmail.com)', true, `Registered ${testEmail}`);
    } else {
      record('2b. Register with non-institutional email (gmail.com)', false, `Status ${regRes.status}`, regRes.data);
    }
  } catch (err) {
    record('2. Auth Registration tests', false, err.message);
  }

  // 3. Login - Invalid credentials test
  try {
    const badLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteEmail: 'admin@nitp.ac.in',
        password: 'WrongPassword999!',
      }),
    });
    if (badLogin.status === 401) {
      record('3. Invalid credentials rejected with 401', true, badLogin.data?.message);
    } else {
      record('3. Invalid credentials rejected with 401', false, `Got status ${badLogin.status}`);
    }
  } catch (err) {
    record('3. Invalid credentials rejected', false, err.message);
  }

  // 4. Admin Workflow
  let adminCookie = '';
  let studentId = '';
  try {
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteEmail: 'admin@nitp.ac.in',
        password: 'Password@123',
      }),
    });
    if (loginRes.status === 200 && loginRes.cookie) {
      adminCookie = loginRes.cookie.split(';')[0];
      record('4a. Admin login successful', true, `Role: ${loginRes.data?.data?.role}`);
    } else {
      record('4a. Admin login successful', false, `Status ${loginRes.status}`, loginRes.data);
    }

    // 4b. Admin Stats
    const statsRes = await api('/api/admin/stats', {
      headers: { Cookie: adminCookie },
    });
    if (statsRes.status === 200 && statsRes.data?.success) {
      record('4b. Admin get system stats', true, `Total users: ${statsRes.data?.data?.totalUsers}`);
    } else {
      record('4b. Admin get system stats', false, `Status ${statsRes.status}`, statsRes.data);
    }

    // 4c. Admin List Users
    const usersRes = await api('/api/admin/users', {
      headers: { Cookie: adminCookie },
    });
    if (usersRes.status === 200 && usersRes.data?.data?.users?.length > 0) {
      record('4c. Admin list users', true, `Found ${usersRes.data.data.users.length} users`);
      const stu = usersRes.data.data.users.find(u => u.role === 'STUDENT');
      if (stu) studentId = stu.id;
    } else {
      record('4c. Admin list users', false, `Status ${usersRes.status}`, usersRes.data);
    }

    // 4d. Admin promote student to Manager (Make Manager)
    if (studentId) {
      const promoteRes = await api(`/api/admin/users/${studentId}/assign-manager`, {
        method: 'PATCH',
        headers: { Cookie: adminCookie },
        body: JSON.stringify({}),
      });
      if (promoteRes.status === 200 && promoteRes.data?.success) {
        record('4d. Admin Make Manager without manual messId', true, promoteRes.data?.message);
        // revert back
        await api(`/api/admin/users/${studentId}/remove-manager`, {
          method: 'PATCH',
          headers: { Cookie: adminCookie },
        });
      } else {
        record('4d. Admin Make Manager without manual messId', false, `Status ${promoteRes.status}`, promoteRes.data);
      }
    }

    // 4e. Admin Audit Logs
    const auditRes = await api('/api/admin/audit-logs', {
      headers: { Cookie: adminCookie },
    });
    if (auditRes.status === 200 && auditRes.data?.success) {
      record('4e. Admin view audit logs', true, `Retrieved audit entries: ${auditRes.data?.data?.logs?.length ?? 0}`);
    } else {
      record('4e. Admin view audit logs', false, `Status ${auditRes.status}`, auditRes.data);
    }
  } catch (err) {
    record('4. Admin workflows', false, err.message);
  }

  // 5. Manager Workflow
  let managerCookie = '';
  let managerMessId = '';
  let createdMenuId = '';
  try {
    const mgrLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteEmail: 'manager.hostela@nitp.ac.in',
        password: 'Password@123',
      }),
    });
    if (mgrLogin.status === 200 && mgrLogin.cookie) {
      managerCookie = mgrLogin.cookie.split(';')[0];
      managerMessId = mgrLogin.data?.data?.messId;
      record('5a. Manager login successful', true, `Mess ID: ${managerMessId}`);
    } else {
      record('5a. Manager login successful', false, `Status ${mgrLogin.status}`, mgrLogin.data);
    }

    // 5b. Manager Create Menu (test future date to prevent collision with today)
    const testDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    const createMenuRes = await api('/api/manager/menu', {
      method: 'POST',
      headers: { Cookie: managerCookie },
      body: JSON.stringify({
        messId: managerMessId,
        serviceDate: testDate,
        mealType: 'DINNER',
        dishes: [
          { name: 'Paneer Tikka Masala', category: 'MAIN_COURSE', isAvailable: true },
          { name: 'Butter Naan', category: 'BREAD', isAvailable: true },
          { name: 'Rasgulla', category: 'DESSERT', isAvailable: true }
        ],
      }),
    });
    if (createMenuRes.status === 200 || createMenuRes.status === 201) {
      createdMenuId = createMenuRes.data?.data?.id || createMenuRes.data?.data?._id;
      record('5b. Manager create menu for date ' + testDate, true, `Menu ID: ${createdMenuId}`);
    } else if (createMenuRes.status === 409) {
      record('5b. Manager create menu (exists)', true, `Menu already exists for ${testDate}`);
    } else {
      record('5b. Manager create menu', false, `Status ${createMenuRes.status}`, createMenuRes.data);
    }

    // 5c. Manager Publish Menu
    if (createdMenuId) {
      const pubRes = await api('/api/manager/menu/publish', {
        method: 'POST',
        headers: { Cookie: managerCookie },
        body: JSON.stringify({
          messId: managerMessId,
          menuId: createdMenuId,
        }),
      });
      if (pubRes.status === 200) {
        record('5c. Manager publish menu for today', true, pubRes.data?.message);
      } else {
        record('5c. Manager publish menu for today', false, `Status ${pubRes.status}`, pubRes.data);
      }
    }

    // 5d. Manager Complaints List
    const compRes = await api(`/api/manager/complaints?messId=${managerMessId}`, {
      headers: { Cookie: managerCookie },
    });
    if (compRes.status === 200 && compRes.data?.success) {
      record('5d. Manager view complaints list', true, `Total complaints: ${compRes.data?.data?.length ?? 0}`);
    } else {
      record('5d. Manager view complaints list', false, `Status ${compRes.status}`, compRes.data);
    }
  } catch (err) {
    record('5. Manager workflows', false, err.message);
  }

  // 6. Student Workflow
  let studentCookie = '';
  let studentCreatedComplaintId = '';
  try {
    const stuLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        instituteEmail: 'aarav.sharma@nitp.ac.in',
        password: 'Password@123',
      }),
    });
    if (stuLogin.status === 200 && stuLogin.cookie) {
      studentCookie = stuLogin.cookie.split(';')[0];
      record('6a. Student login successful', true);
    } else {
      record('6a. Student login successful', false, `Status ${stuLogin.status}`, stuLogin.data);
    }

    // 6b. Student check today's published menu
    let publishedMenuId = '';
    const menuRes = await api('/api/menu/today', {
      headers: { Cookie: studentCookie },
    });
    if (menuRes.status === 200 && menuRes.data?.success) {
      const menuList = menuRes.data?.data || [];
      if (menuList.length > 0) {
        publishedMenuId = menuList[0].id || menuList[0]._id;
      }
      record('6b. Student fetch today menu', true, `Found ${menuList.length} published menu(s)`);
    } else {
      record('6b. Student fetch today menu', false, `Status ${menuRes.status}`, menuRes.data);
    }

    // 6c. Student submit feedback on today's newly created menu
    const targetMenuId = createdMenuId || publishedMenuId;
    if (targetMenuId) {
      const fbRes = await api('/api/student/feedback', {
        method: 'POST',
        headers: { Cookie: studentCookie },
        body: JSON.stringify({
          menuId: targetMenuId,
          overallRating: 5,
          comments: 'Delicious meal! Paneer was fresh and naan was crispy.',
          isAnonymous: false,
        }),
      });
      if (fbRes.status === 200 || fbRes.status === 201) {
        record('6c. Student submit meal feedback', true, `Rating: 5 stars for menu ${targetMenuId}`);
      } else if (fbRes.status === 409) {
        record('6c. Student submit meal feedback (idempotent)', true, '409 Conflict: user already reviewed this menu');
      } else {
        record('6c. Student submit meal feedback', false, `Status ${fbRes.status}`, fbRes.data);
      }
    }

    // 6d. Student submit a complaint
    const newCompRes = await api('/api/student/complaints', {
      method: 'POST',
      headers: { Cookie: studentCookie },
      body: JSON.stringify({
        title: 'Water cooler filtration issue near Hall A',
        description: 'Water dispenser water is lukewarm and flow is very slow.',
        category: 'WATER_QUALITY',
        priority: 'MEDIUM',
      }),
    });
    if (newCompRes.status === 200 || newCompRes.status === 201) {
      studentCreatedComplaintId = newCompRes.data?.data?.id || newCompRes.data?.data?._id;
      record('6c. Student file mess grievance complaint', true, `Complaint ID: ${studentCreatedComplaintId}`);
    } else {
      record('6c. Student file mess grievance complaint', false, `Status ${newCompRes.status}`, newCompRes.data);
    }

    // 6d. Student notifications
    const notifRes = await api('/api/student/notifications', {
      headers: { Cookie: studentCookie },
    });
    if (notifRes.status === 200 && notifRes.data?.success) {
      record('6d. Student fetch notifications', true);
    } else {
      record('6d. Student fetch notifications', false, `Status ${notifRes.status}`, notifRes.data);
    }
  } catch (err) {
    record('6. Student workflows', false, err.message);
  }

  // 7. Manager Updates Complaint Status
  try {
    if (studentCreatedComplaintId && managerCookie) {
      const updateCompRes = await api(`/api/manager/complaints/${studentCreatedComplaintId}/status`, {
        method: 'PATCH',
        headers: { Cookie: managerCookie },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          resolutionNote: 'Maintenance team dispatched to check water cooler filter.',
        }),
      });
      if (updateCompRes.status === 200 && updateCompRes.data?.success) {
        record('7. Manager resolve/update student complaint', true, `Status changed to IN_PROGRESS`);
      } else {
        record('7. Manager resolve/update student complaint', false, `Status ${updateCompRes.status}`, updateCompRes.data);
      }
    }
  } catch (err) {
    record('7. Manager update complaint status', false, err.message);
  }

  // 8. Page Rendering Checks (Frontend SSR/RSC)
  const pages = [
    { path: '/', name: 'Landing Page' },
    { path: '/login', name: 'Login Page' },
    { path: '/register', name: 'Register Page' },
    { path: '/student', name: 'Student Dashboard', cookie: studentCookie },
    { path: '/student/complaints', name: 'Student Complaints Page', cookie: studentCookie },
    { path: '/student/feedback', name: 'Student Feedback Page', cookie: studentCookie },
    { path: '/manager', name: 'Manager Dashboard', cookie: managerCookie },
    { path: '/manager/complaints', name: 'Manager Complaints Page', cookie: managerCookie },
    { path: '/manager/analytics', name: 'Manager Analytics Page', cookie: managerCookie },
    { path: '/admin', name: 'Admin Dashboard', cookie: adminCookie },
    { path: '/admin/users', name: 'Admin Users Page', cookie: adminCookie },
    { path: '/admin/audit-logs', name: 'Admin Audit Logs Page', cookie: adminCookie },
  ];

  for (const p of pages) {
    try {
      const res = await api(p.path, {
        headers: p.cookie ? { Cookie: p.cookie } : {},
      });
      if (res.status === 200) {
        record(`8. Render ${p.name} (${p.path})`, true, 'HTTP 200 OK');
      } else {
        record(`8. Render ${p.name} (${p.path})`, false, `Status ${res.status}`);
      }
    } catch (err) {
      record(`8. Render ${p.name} (${p.path})`, false, err.message);
    }
  }

  // Summary
  console.log('\n====================================================');
  console.log('TEST SUITE SUMMARY');
  console.log('====================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  if (failedCount === 0) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    console.log('⚠️ Some tests failed. Details logged above.');
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
