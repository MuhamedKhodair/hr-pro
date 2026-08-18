import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const clients = new Map<string, Set<WebSocket>>();

export function attachWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token') ?? '';

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      if (decoded.purpose !== 'ws' || !decoded.userId) throw new Error('invalid ws token');
    } catch {
      socket.close(4001, 'unauthorized');
      return;
    }

    const userId = decoded.userId;
    let userSockets = clients.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      clients.set(userId, userSockets);
    }
    userSockets.add(socket);

    socket.on('close', () => {
      userSockets!.delete(socket);
      if (userSockets!.size === 0) clients.delete(userId);
    });
    socket.on('error', () => {
      userSockets!.delete(socket);
      if (userSockets!.size === 0) clients.delete(userId);
    });
  });

  return wss;
}

/** Push a payload to every live connection of a user. Returns true if any socket received it. */
export function pushToUser(userId: string, payload: Record<string, unknown>): boolean {
  const userSockets = clients.get(userId);
  if (!userSockets || userSockets.size === 0) return false;
  const data = JSON.stringify({ type: 'push', ...payload });
  for (const socket of userSockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(data);
  }
  return true;
}