export interface DocOperation {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  auth?: boolean;
  roles?: string[];
  params?: { name: string; in: 'path' | 'query'; required?: boolean; description?: string }[];
  requestBody?: string;
}

const operations: DocOperation[] = [
  // Health
  { method: 'get', path: '/health', summary: 'Health check' },

  // Auth
  { method: 'post', path: '/auth/login', summary: 'Sign in with email + password (may return needsTwoFactor)' },
  { method: 'post', path: '/auth/register', summary: 'Create a user account (Admin)', auth: true, roles: ['Admin'] },
  { method: 'post', path: '/auth/register/self', summary: 'Self-register when whitelist + public registration are enabled' },
  { method: 'post', path: '/auth/refresh', summary: 'Rotate the refresh token and issue a new session' },
  { method: 'get', path: '/auth/me', summary: 'Current user profile', auth: true },
  { method: 'put', path: '/auth/me/password', summary: 'Change own password', auth: true },
  { method: 'post', path: '/auth/logout', summary: 'Revoke current session', auth: true },
  { method: 'get', path: '/auth/sessions', summary: 'List active sessions', auth: true },
  { method: 'delete', path: '/auth/sessions/{id}', summary: 'Revoke a session', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/auth/2fa/setup', summary: 'Generate TOTP secret + QR for enrollment', auth: true },
  { method: 'post', path: '/auth/2fa/enable', summary: 'Verify a code and enable 2FA (returns backup codes)', auth: true },
  { method: 'post', path: '/auth/2fa/disable', summary: 'Disable 2FA after verification', auth: true },
  { method: 'post', path: '/auth/2fa/verify-login', summary: 'Complete two-factor login step' },
  { method: 'get', path: '/auth/ws-token', summary: 'Short-lived token for WebSocket connections', auth: true },

  // Users (Admin)
  { method: 'get', path: '/users', summary: 'List user accounts', auth: true, roles: ['Admin'] },
  { method: 'post', path: '/users', summary: 'Create a user account linked to an employee', auth: true, roles: ['Admin'] },
  { method: 'post', path: '/users/{id}/reset-password', summary: 'Admin password reset (forces change on next login)', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/users/{id}', summary: 'Delete a user account', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },

  // Employees
  { method: 'get', path: '/employees', summary: 'List employees (role-scoped)', auth: true, params: [{ name: 'page', in: 'query' }, { name: 'pageSize', in: 'query' }, { name: 'search', in: 'query' }, { name: 'departmentId', in: 'query' }, { name: 'status', in: 'query' }] },
  { method: 'get', path: '/employees/me', summary: 'Own employee profile', auth: true },
  { method: 'put', path: '/employees/me', summary: 'Update own profile (phone, birthdate)', auth: true },
  { method: 'get', path: '/employees/org-chart', summary: 'Organizational chart tree', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/employees/export/csv', summary: 'Export employees as CSV', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/employees/export/xlsx', summary: 'Export employees as XLSX', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/employees/import/template', summary: 'Download XLSX import template', auth: true, roles: ['Admin', 'HR'] },
  { method: 'post', path: '/employees/bulk-import', summary: 'Bulk import employees', auth: true, roles: ['Admin', 'HR'] },
  { method: 'post', path: '/employees', summary: 'Create employee', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/employees/{id}', summary: 'Get employee (own-profile guard)', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'put', path: '/employees/{id}', summary: 'Update employee', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/employees/{id}', summary: 'Delete employee', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },

  // Departments
  { method: 'get', path: '/departments', summary: 'List departments', auth: true },
  { method: 'get', path: '/departments/{id}', summary: 'Get department', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/departments', summary: 'Create department', auth: true, roles: ['Admin', 'HR'] },
  { method: 'put', path: '/departments/{id}', summary: 'Update department', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/departments/{id}', summary: 'Delete department (blocked if employees exist)', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },

  // Attendance
  { method: 'get', path: '/attendance/today', summary: 'Today attendance (own/team)', auth: true },
  { method: 'post', path: '/attendance/check-in', summary: 'Check in', auth: true },
  { method: 'post', path: '/attendance/check-out', summary: 'Check out (auto overtime)', auth: true },
  { method: 'get', path: '/attendance/range', summary: 'Attendance in a date range', auth: true, params: [{ name: 'start', in: 'query', required: true }, { name: 'end', in: 'query', required: true }, { name: 'employeeId', in: 'query' }] },
  { method: 'get', path: '/attendance/monthly/{employeeId}/{year}/{month}', summary: 'Monthly attendance for an employee', auth: true, params: [{ name: 'employeeId', in: 'path', required: true }, { name: 'year', in: 'path', required: true }, { name: 'month', in: 'path', required: true }] },
  { method: 'post', path: '/attendance/manual', summary: 'Manual attendance entry/override', auth: true, roles: ['Admin', 'HR'] },
  { method: 'post', path: '/attendance/bulk-import', summary: 'Bulk import attendance', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/attendance/export/csv', summary: 'Export attendance CSV', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/attendance/export/xlsx', summary: 'Export attendance XLSX', auth: true, roles: ['Admin', 'HR'] },

  // Leaves
  { method: 'get', path: '/leaves/my', summary: 'Own leave requests', auth: true },
  { method: 'get', path: '/leaves/balances', summary: 'Leave balances', auth: true, params: [{ name: 'employeeId', in: 'query' }] },
  { method: 'get', path: '/leaves', summary: 'List leave requests (role-scoped)', auth: true, params: [{ name: 'status', in: 'query' }, { name: 'employeeId', in: 'query' }, { name: 'page', in: 'query' }, { name: 'pageSize', in: 'query' }] },
  { method: 'get', path: '/leaves/{id}', summary: 'Get leave request', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/leaves', summary: 'Create leave request', auth: true },
  { method: 'put', path: '/leaves/{id}', summary: 'Update pending own request', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'patch', path: '/leaves/{id}/cancel', summary: 'Cancel own pending request', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'put', path: '/leaves/{id}/review', summary: 'Approve/reject (manager/HR/Admin)', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/leaves/export/csv', summary: 'Export leaves CSV', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/leaves/export/xlsx', summary: 'Export leaves XLSX', auth: true, roles: ['Admin', 'HR'] },

  // Holidays
  { method: 'get', path: '/holidays', summary: 'List public holidays', auth: true },
  { method: 'post', path: '/holidays', summary: 'Create holiday', auth: true, roles: ['Admin', 'HR'] },
  { method: 'delete', path: '/holidays/{id}', summary: 'Delete holiday', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },

  // Dashboard
  { method: 'get', path: '/dashboard/stats', summary: 'KPI statistics', auth: true },
  { method: 'get', path: '/dashboard/headcount', summary: 'Headcount by department', auth: true },
  { method: 'get', path: '/dashboard/upcoming', summary: 'Upcoming birthdays/anniversaries', auth: true },
  { method: 'get', path: '/dashboard/activity', summary: 'Recent activity feed', auth: true },

  // Salary / Payroll
  { method: 'get', path: '/salary/payroll/mine', summary: 'Own payroll records', auth: true },
  { method: 'get', path: '/salary/payroll/mine/{id}', summary: 'Own payslip detail (finalized/paid only)', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/salary/employees', summary: 'Employees with salary data (Admin)', auth: true, roles: ['Admin'] },
  { method: 'post', path: '/salary/salary-structure', summary: 'Create/update salary structure', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/salary-structure', summary: 'List salary structures', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/salary-structure/{employeeId}', summary: 'Get structure', auth: true, roles: ['Admin'], params: [{ name: 'employeeId', in: 'path', required: true }] },
  { method: 'get', path: '/salary/salary-structure/{employeeId}/history', summary: 'Structure history', auth: true, roles: ['Admin'], params: [{ name: 'employeeId', in: 'path', required: true }] },
  { method: 'post', path: '/salary/salary-components', summary: 'Add salary component', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/salary-components', summary: 'Active components', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/salary-components/{employeeId}', summary: 'Components per employee', auth: true, roles: ['Admin'], params: [{ name: 'employeeId', in: 'path', required: true }] },
  { method: 'delete', path: '/salary/salary-components/{id}', summary: 'Soft-delete component', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/salary/payroll/generate', summary: 'Generate payroll for a month', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/payroll/preview', summary: 'Preview payroll run', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/payroll/summary', summary: 'Payroll summary', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/payroll/trend', summary: 'Monthly payroll trend', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/payroll', summary: 'List payroll records', auth: true, roles: ['Admin'], params: [{ name: 'month', in: 'query' }, { name: 'year', in: 'query' }, { name: 'status', in: 'query' }] },
  { method: 'get', path: '/salary/payroll/{employeeId}/{month}/{year}', summary: 'Payroll record', auth: true, roles: ['Admin'], params: [{ name: 'employeeId', in: 'path', required: true }, { name: 'month', in: 'path', required: true }, { name: 'year', in: 'path', required: true }] },
  { method: 'get', path: '/salary/payroll/{id}', summary: 'Payroll by id (payslip)', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'patch', path: '/salary/payroll/{id}', summary: 'Adjust payroll record', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/salary/payroll/{id}/finalize', summary: 'Finalize payroll', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/salary/payroll/{id}/mark-paid', summary: 'Mark payroll as paid', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/salary/payroll/export/csv', summary: 'Export payroll CSV', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/salary/payroll/export/xlsx', summary: 'Export payroll XLSX', auth: true, roles: ['Admin'] },

  // Shifts
  { method: 'get', path: '/shifts', summary: 'List shifts', auth: true },
  { method: 'post', path: '/shifts', summary: 'Create shift', auth: true, roles: ['Admin', 'HR'] },
  { method: 'put', path: '/shifts/{id}', summary: 'Update shift', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/shifts/{id}', summary: 'Delete shift (blocked if assigned)', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/shifts/unassigned', summary: 'List employees with no shift', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/shifts/{id}/employees', summary: 'List employees assigned to a shift', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/shifts/{id}/assign', summary: 'Assign employees to a shift', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/shifts/{id}/employees/{employeeId}', summary: 'Remove an employee from a shift', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }, { name: 'employeeId', in: 'path', required: true }] },

  // Performance
  { method: 'get', path: '/performance', summary: 'List performance reviews', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/performance/stats', summary: 'Review statistics', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/performance/periods', summary: 'Distinct review periods', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/performance/criteria', summary: 'Default criteria', auth: true, roles: ['Admin', 'HR'] },
  { method: 'post', path: '/performance', summary: 'Create review', auth: true, roles: ['Admin', 'HR'] },
  { method: 'put', path: '/performance/{id}', summary: 'Update review (DRAFT only)', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/performance/{id}/complete', summary: 'Complete review', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/performance/{id}', summary: 'Delete review', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },

  // Recruitment
  { method: 'get', path: '/recruitment/stats', summary: 'Recruitment funnel stats', auth: true, roles: ['Admin', 'HR'] },
  { method: 'get', path: '/recruitment/jobs', summary: 'List job postings', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'status', in: 'query' }, { name: 'search', in: 'query' }, { name: 'page', in: 'query' }, { name: 'pageSize', in: 'query' }] },
  { method: 'get', path: '/recruitment/jobs/{id}', summary: 'Get job posting', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/recruitment/jobs', summary: 'Create job posting', auth: true, roles: ['Admin', 'HR'] },
  { method: 'put', path: '/recruitment/jobs/{id}', summary: 'Update job posting', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'patch', path: '/recruitment/jobs/{id}/status', summary: 'Publish / pause / close job', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/recruitment/jobs/{id}', summary: 'Delete job (blocked if candidates exist)', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/recruitment/candidates', summary: 'List candidates', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'status', in: 'query' }, { name: 'jobId', in: 'query' }, { name: 'search', in: 'query' }, { name: 'page', in: 'query' }, { name: 'pageSize', in: 'query' }] },
  { method: 'get', path: '/recruitment/candidates/{id}', summary: 'Get candidate with interviews', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/recruitment/candidates', summary: 'Create candidate', auth: true, roles: ['Admin', 'HR'] },
  { method: 'put', path: '/recruitment/candidates/{id}', summary: 'Update candidate', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'patch', path: '/recruitment/candidates/{id}/status', summary: 'Move candidate through pipeline (emails on OFFER/HIRED/REJECTED)', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/recruitment/candidates/{id}', summary: 'Delete candidate', auth: true, roles: ['Admin'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/recruitment/interviews', summary: 'List interviews (Employee sees own)', auth: true, params: [{ name: 'status', in: 'query' }, { name: 'candidateId', in: 'query' }, { name: 'interviewerId', in: 'query' }, { name: 'from', in: 'query' }, { name: 'to', in: 'query' }] },
  { method: 'post', path: '/recruitment/interviews', summary: 'Schedule interview (email + notify interviewer)', auth: true, roles: ['Admin', 'HR'] },
  { method: 'put', path: '/recruitment/interviews/{id}', summary: 'Reschedule interview', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'patch', path: '/recruitment/interviews/{id}/cancel', summary: 'Cancel interview', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/recruitment/interviews/{id}/feedback', summary: 'Submit interview feedback (interviewer)', auth: true, params: [{ name: 'id', in: 'path', required: true }] },

  // Onboarding
  { method: 'get', path: '/onboarding/tasks', summary: 'List onboarding template tasks', auth: true, roles: ['Admin', 'HR'] },
  { method: 'post', path: '/onboarding/tasks', summary: 'Create onboarding template task', auth: true, roles: ['Admin', 'HR'] },
  { method: 'put', path: '/onboarding/tasks/{id}', summary: 'Update onboarding template task', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/onboarding/tasks/{id}', summary: 'Deactivate onboarding template task', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/onboarding/assignments', summary: 'List assignments (role-scoped)', auth: true, params: [{ name: 'employeeId', in: 'query' }, { name: 'status', in: 'query' }] },
  { method: 'post', path: '/onboarding/assignments/generate-all', summary: 'Generate assignments for all active employees', auth: true, roles: ['Admin', 'HR'] },
  { method: 'post', path: '/onboarding/assignments/generate/{employeeId}', summary: 'Generate assignments for one employee', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'employeeId', in: 'path', required: true }] },
  { method: 'patch', path: '/onboarding/assignments/{id}/status', summary: 'Update assignment status (own for Employee)', auth: true, params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/onboarding/progress', summary: 'Onboarding progress per employee', auth: true, roles: ['Admin', 'HR'] },

  // Reports
  { method: 'get', path: '/reports/leave-summary', summary: 'Leave summary by type (query: month, year, format=csv)', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'month', in: 'query' }, { name: 'year', in: 'query' }, { name: 'format', in: 'query' }] },
  { method: 'get', path: '/reports/attendance-summary', summary: 'Attendance summary per employee (query: month, year, format=csv)', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'month', in: 'query' }, { name: 'year', in: 'query' }, { name: 'format', in: 'query' }] },
  { method: 'get', path: '/reports/headcount', summary: 'Headcount by department and status (query: format=csv)', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'format', in: 'query' }] },

  // Letters
  { method: 'get', path: '/letters/{type}/{employeeId}', summary: 'Render HR letter as printable HTML (type: employment|salary|leave)', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'type', in: 'path', required: true }, { name: 'employeeId', in: 'path', required: true }] },

  // Uploads
  { method: 'post', path: '/uploads/leave', summary: 'Upload leave attachment', auth: true },
  { method: 'post', path: '/uploads/employee-document/{employeeId}', summary: 'Upload employee document', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'employeeId', in: 'path', required: true }] },
  { method: 'get', path: '/uploads/employee-documents/{employeeId}', summary: 'List employee documents', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'employeeId', in: 'path', required: true }] },
  { method: 'delete', path: '/uploads/employee-document/{id}', summary: 'Delete employee document', auth: true, roles: ['Admin', 'HR'], params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/uploads/employees/import', summary: 'Import employees from XLSX', auth: true, roles: ['Admin', 'HR'] },
  { method: 'post', path: '/uploads/logo', summary: 'Upload brand logo', auth: true, roles: ['Admin'] },
  { method: 'get', path: '/uploads/files/{folder}/{filename}', summary: 'Download uploaded file', auth: true, params: [{ name: 'folder', in: 'path', required: true }, { name: 'filename', in: 'path', required: true }] },

  // Audit
  { method: 'get', path: '/audit-logs', summary: 'Audit trail', auth: true, roles: ['Admin'], params: [{ name: 'page', in: 'query' }, { name: 'pageSize', in: 'query' }, { name: 'action', in: 'query' }, { name: 'userEmail', in: 'query' }] },

  // Settings
  { method: 'get', path: '/settings', summary: 'Company settings', auth: true },
  { method: 'put', path: '/settings', summary: 'Update settings', auth: true, roles: ['Admin'] },

  // Notifications
  { method: 'get', path: '/notifications', summary: 'List own notifications', auth: true },
  { method: 'get', path: '/notifications/unread-count', summary: 'Unread count', auth: true },
  { method: 'patch', path: '/notifications/read-all', summary: 'Mark all as read', auth: true },
  { method: 'patch', path: '/notifications/{id}/read', summary: 'Mark one as read', auth: true, params: [{ name: 'id', in: 'path', required: true }] },

  // Search
  { method: 'get', path: '/search', summary: 'Global search (role-scoped)', auth: true, params: [{ name: 'q', in: 'query', required: true }] },
];

export function buildOpenApi() {
  const paths: Record<string, unknown> = {};
  for (const op of operations) {
    const tags = ['/' + op.path.split('/')[1]];
    paths[op.path] = paths[op.path] || {};
    (paths[op.path] as Record<string, unknown>)[op.method] = {
      tags,
      summary: op.summary,
      security: op.auth ? [{ bearerAuth: [] }, { cookieAuth: [] }] : [],
      ...(op.roles ? { 'x-roles': op.roles } : {}),
      ...(op.params
        ? { parameters: op.params.map((p) => ({ name: p.name, in: p.in, required: p.required ?? false, schema: { type: 'string' }, description: p.description })) }
        : {}),
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'HR Pro API',
      version: '1.0.0',
      description: 'HR Management System — employee, attendance, leave, payroll, performance and recruitment APIs. All responses use `{ success: boolean, data?: T, error?: string }`.',
    },
    servers: [{ url: '/api' }],
    tags: [
      { name: 'auth', description: 'Authentication, sessions and two-factor' },
      { name: 'users', description: 'User account administration (Admin)' },
      { name: 'employees', description: 'Employee records, org chart, import/export' },
      { name: 'departments', description: 'Departments' },
      { name: 'attendance', description: 'Attendance and overtime' },
      { name: 'leaves', description: 'Leave requests, balances and approvals' },
      { name: 'holidays', description: 'Public holidays' },
      { name: 'dashboard', description: 'Dashboard KPIs and activity' },
      { name: 'salary', description: 'Salary structures, components and payroll' },
      { name: 'shifts', description: 'Work shifts' },
      { name: 'performance', description: 'Performance reviews' },
      { name: 'uploads', description: 'File uploads and downloads' },
      { name: 'audit-logs', description: 'Audit trail' },
      { name: 'settings', description: 'Company settings' },
      { name: 'notifications', description: 'In-app notifications' },
      { name: 'reports', description: 'Report summaries and exports' },
      { name: 'letters', description: 'HR letters and certificates' },
      { name: 'search', description: 'Global search' },
      { name: 'health', description: 'Operational endpoints' },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'hrpro_access' },
      },
    },
  };
}