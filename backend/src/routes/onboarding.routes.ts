import { Router } from 'express';
import * as onboardingController from '../controllers/onboarding.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Template tasks
router.get('/tasks', authorize('Admin', 'HR'), onboardingController.listTasks);
router.post('/tasks', authorize('Admin', 'HR'), onboardingController.createTask);
router.put('/tasks/:id', authorize('Admin', 'HR'), onboardingController.updateTask);
router.delete('/tasks/:id', authorize('Admin', 'HR'), onboardingController.deleteTask);

// Assignments (employees see only their own)
router.get('/assignments', onboardingController.listAssignments);
router.post('/assignments/generate-all', authorize('Admin', 'HR'), onboardingController.generateForAll);
router.post('/assignments/generate/:employeeId', authorize('Admin', 'HR'), onboardingController.generateForEmployee);
router.patch('/assignments/:id/status', onboardingController.setAssignmentStatus);

// Progress
router.get('/progress', authorize('Admin', 'HR'), onboardingController.progressOverview);

export default router;