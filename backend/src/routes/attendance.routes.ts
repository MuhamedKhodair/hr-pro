import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/today', attendanceController.getToday);
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/range', attendanceController.getDateRange);
router.get('/export/csv', authorize('Admin', 'HR'), attendanceController.exportCsv);
router.get('/export/xlsx', authorize('Admin', 'HR'), attendanceController.exportExcel);
router.post('/manual', authorize('Admin', 'HR'), attendanceController.manualEntry);
router.post('/bulk-import', authorize('Admin', 'HR'), attendanceController.bulkImport);
router.get('/monthly/:employeeId/:year/:month', attendanceController.getMonthly);

export default router;
