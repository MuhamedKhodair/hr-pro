import { Router } from 'express';
import * as departmentController from '../controllers/department.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', departmentController.getAll);
router.get('/:id', departmentController.getById);
router.post('/', authorize('Admin', 'HR'), departmentController.create);
router.put('/:id', authorize('Admin', 'HR'), departmentController.update);
router.delete('/:id', authorize('Admin'), departmentController.remove);

export default router;
