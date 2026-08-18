import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/me', employeeController.me);
router.put('/me', employeeController.updateMe);
router.get('/', employeeController.getAll);
router.get('/org-chart', authorize('Admin', 'HR'), employeeController.orgChart);
router.get('/import/template', authorize('Admin', 'HR'), employeeController.exportTemplate);
router.get('/export/csv', authorize('Admin', 'HR'), employeeController.exportCsv);
router.get('/export/xlsx', authorize('Admin', 'HR'), employeeController.exportExcel);
router.post('/bulk-import', authorize('Admin', 'HR'), employeeController.bulkImport);
router.get('/:id', employeeController.getById);
router.post('/', authorize('Admin', 'HR'), employeeController.create);
router.put('/:id', authorize('Admin', 'HR'), employeeController.update);
router.delete('/:id', authorize('Admin'), employeeController.remove);

export default router;
