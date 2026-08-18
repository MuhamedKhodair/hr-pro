import { Router } from 'express';
import * as shiftController from '../controllers/shift.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', shiftController.getAll);
router.get('/mine', shiftController.myShift);
router.get('/unassigned', authorize('Admin', 'HR'), shiftController.listUnassigned);
router.get('/:id/employees', authorize('Admin', 'HR'), shiftController.getShiftEmployees);
router.post('/:id/assign', authorize('Admin', 'HR'), shiftController.assign);
router.delete('/:id/employees/:employeeId', authorize('Admin', 'HR'), shiftController.unassign);
router.post('/', authorize('Admin', 'HR'), shiftController.create);
router.put('/:id', authorize('Admin', 'HR'), shiftController.update);
router.delete('/:id', authorize('Admin'), shiftController.remove);

export default router;
