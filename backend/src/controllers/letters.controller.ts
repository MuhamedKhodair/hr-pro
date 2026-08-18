import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { renderLetter, LETTER_TYPES, LetterType } from '../services/letters.service';
import { AppError } from '../lib/errors';

export async function getLetter(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const type = String(req.params.type) as LetterType;
    if (!LETTER_TYPES.includes(type)) throw new AppError(400, `Letter type must be one of: ${LETTER_TYPES.join(', ')}`);
    const html = await renderLetter(type, String(req.params.employeeId));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  } catch (err) {
    next(err);
  }
}