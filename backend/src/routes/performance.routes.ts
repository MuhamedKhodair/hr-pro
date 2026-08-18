import { Router } from 'express';
import * as performanceController from '../controllers/performance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('Admin', 'HR'));

router.get('/', performanceController.list);
router.get('/stats', performanceController.stats);
router.get('/periods', performanceController.periods);
router.get('/criteria', performanceController.criteria);
router.post('/', performanceController.create);
router.put('/:id', performanceController.update);
router.post('/:id/complete', performanceController.complete);
router.delete('/:id', performanceController.remove);

export default router;