import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/login', authController.login);
router.post('/register/self', authController.selfRegister);
router.post('/register', authenticate, authorize('Admin'), authController.register);
router.post('/refresh', authController.refresh);
router.get('/me', authenticate, authController.me);
router.put('/me/password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);
router.get('/sessions', authenticate, authController.sessions);
router.delete('/sessions/:id', authenticate, authController.revokeSession);
router.get('/2fa/setup', authenticate, authController.twoFactorSetup);
router.post('/2fa/enable', authenticate, authController.twoFactorEnable);
router.post('/2fa/disable', authenticate, authController.twoFactorDisable);
router.post('/2fa/verify-login', authController.twoFactorVerifyLogin);
router.get('/ws-token', authenticate, authController.wsToken);

export default router;
