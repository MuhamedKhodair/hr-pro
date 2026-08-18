import { Router } from 'express';
import * as salaryController from '../controllers/salary.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/payroll/mine', salaryController.myPayroll);
router.get('/payroll/mine/:id', salaryController.myPayrollDetail);
router.use(authorize('Admin'));

router.get('/employees', salaryController.getEmployees);

router.post('/salary-structure', salaryController.createOrUpdateStructure);
router.get('/salary-structure', salaryController.listAllStructures);
router.get('/salary-structure/:employeeId', salaryController.getStructure);
router.get('/salary-structure/:employeeId/history', salaryController.getStructureHistory);

router.post('/salary-components', salaryController.createComponent);
router.get('/salary-components', salaryController.getAllActiveComponents);
router.get('/salary-components/:employeeId', salaryController.getComponents);
router.delete('/salary-components/:id', salaryController.removeComponent);

router.post('/payroll/generate', salaryController.generatePayroll);
router.get('/payroll/preview', salaryController.previewPayroll);
router.get('/payroll/summary', salaryController.getPayrollSummary);
router.get('/payroll/trend', salaryController.getPayrollTrend);
router.get('/payroll/export/csv', salaryController.exportPayrollCsv);
router.get('/payroll/export/xlsx', salaryController.exportPayrollExcel);
router.get('/payroll', salaryController.listPayrolls);
router.get('/payroll/:employeeId/:month/:year', salaryController.getPayroll);
router.get('/payroll/:id', salaryController.getPayrollById);
router.patch('/payroll/:id', salaryController.adjustPayroll);
router.post('/payroll/:id/finalize', salaryController.finalizePayroll);
router.post('/payroll/:id/mark-paid', salaryController.markPayrollPaid);

export default router;
