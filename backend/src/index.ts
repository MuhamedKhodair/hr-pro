import 'dotenv/config';
import { app } from './app';
import { checkSecretConfig } from './lib/secrets';
import { attachWebSocket } from './lib/ws';
import { startCron } from './lib/cron';

const PORT = process.env.PORT || 4000;

const secretProblems = checkSecretConfig();
if (process.env.NODE_ENV === 'production') {
  if (secretProblems.length > 0) {
    console.error('Refusing to start in production:');
    secretProblems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
} else if (secretProblems.length > 0) {
  console.warn('[secrets] Weak configuration detected (development only):');
  secretProblems.forEach((p) => console.warn(`  - ${p}`));
}

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    startCron();
    console.log('[cron] Scheduler started');
  }
});

attachWebSocket(server);
console.log('[ws] WebSocket server attached at /ws');
