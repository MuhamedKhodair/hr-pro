import { Router } from 'express';
import * as leaveController from '../controllers/leave.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/my', leaveController.myLeaves);
router.get('/balances', leaveController.getBalances);
router.get('/', leaveController.getAll);
router.get('/export/csv', authorize('Admin', 'HR'), leaveController.exportCsv);
router.get('/export/xlsx', authorize('Admin', 'HR'), leaveController.exportExcel);
router.get('/:id', leaveController.getById);
router.post('/', leaveController.create);
router.put('/:id', leaveController.update);
router.patch('/:id/cancel', leaveController.cancel);
router.put('/:id/review', authorize('Admin', 'HR'), leaveController.review);

export default router;
