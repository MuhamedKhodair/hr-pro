import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', employeeController.getAll);
router.get('/:id', employeeController.getById);
router.post('/', authorize('Admin', 'HR'), employeeController.create);
router.put('/:id', authorize('Admin', 'HR'), employeeController.update);
router.delete('/:id', authorize('Admin'), employeeController.remove);

export default router;
