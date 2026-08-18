import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getLetter } from '../controllers/letters.controller';

const router = Router();

router.get('/:type/:employeeId', authenticate, authorize('Admin', 'HR'), getLetter);

export default router;