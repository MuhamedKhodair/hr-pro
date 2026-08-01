import { Router } from 'express';
import * as leaveController from '../controllers/leave.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/my', leaveController.myLeaves);
router.get('/', authorize('Admin', 'HR'), leaveController.getAll);
router.get('/:id', leaveController.getById);
router.post('/', leaveController.create);
router.put('/:id/review', authorize('Admin', 'HR'), leaveController.review);

export default router;
