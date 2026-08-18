import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApi } from '../lib/docs';
import { authenticate } from '../middleware/auth';

const router = Router();

const openApiDocument = buildOpenApi();

router.get('/docs.json', (_req, res) => {
  res.json(openApiDocument);
});

router.use('/docs', authenticate, swaggerUi.serve, swaggerUi.setup(openApiDocument));

export default router;
