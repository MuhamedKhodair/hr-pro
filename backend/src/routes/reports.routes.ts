import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('Admin', 'HR'));
router.get('/leave-summary', reportsController.leaveSummary);
router.get('/attendance-summary', reportsController.attendanceSummary);
router.get('/headcount', reportsController.headcount);

export default router;