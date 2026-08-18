import { Router } from 'express';
import * as holidayController from '../controllers/holiday.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', holidayController.list);
router.post('/', authorize('Admin', 'HR'), holidayController.create);
router.delete('/:id', authorize('Admin', 'HR'), holidayController.remove);

export default router;
