import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, settingsController.get);
router.put('/', authenticate, authorize('Admin'), settingsController.update);

export default router;
