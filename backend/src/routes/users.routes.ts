import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('Admin'));

router.get('/', usersController.list);
router.post('/', usersController.create);
router.post('/:id/reset-password', usersController.resetPassword);
router.delete('/:id', usersController.remove);

export default router;
