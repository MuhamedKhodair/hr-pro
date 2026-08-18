import { Router } from 'express';
import * as recruitmentController from '../controllers/recruitment.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Jobs
router.get('/jobs', authorize('Admin', 'HR'), recruitmentController.listJobs);
router.get('/jobs/:id', authorize('Admin', 'HR'), recruitmentController.getJob);
router.post('/jobs', authorize('Admin', 'HR'), recruitmentController.createJob);
router.put('/jobs/:id', authorize('Admin', 'HR'), recruitmentController.updateJob);
router.patch('/jobs/:id/status', authorize('Admin', 'HR'), recruitmentController.setJobStatus);
router.delete('/jobs/:id', authorize('Admin'), recruitmentController.deleteJob);

// Candidates
router.get('/candidates', authorize('Admin', 'HR'), recruitmentController.listCandidates);
router.get('/candidates/:id', authorize('Admin', 'HR'), recruitmentController.getCandidate);
router.post('/candidates', authorize('Admin', 'HR'), recruitmentController.createCandidate);
router.put('/candidates/:id', authorize('Admin', 'HR'), recruitmentController.updateCandidate);
router.patch('/candidates/:id/status', authorize('Admin', 'HR'), recruitmentController.setCandidateStatus);
router.delete('/candidates/:id', authorize('Admin'), recruitmentController.deleteCandidate);

// Interviews (employees see only the ones they interview on)
router.get('/interviews', recruitmentController.listInterviews);
router.post('/interviews', authorize('Admin', 'HR'), recruitmentController.createInterview);
router.put('/interviews/:id', authorize('Admin', 'HR'), recruitmentController.updateInterview);
router.patch('/interviews/:id/cancel', authorize('Admin', 'HR'), recruitmentController.cancelInterview);
router.post('/interviews/:id/feedback', authorize('Admin', 'HR', 'Employee'), recruitmentController.submitFeedback);

// Stats
router.get('/stats', authorize('Admin', 'HR'), recruitmentController.getStats);

export default router;