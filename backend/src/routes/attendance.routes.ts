import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/today', attendanceController.getToday);
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/monthly/:employeeId/:year/:month', attendanceController.getMonthly);

export default router;
