import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as settingsService from '../services/settings.service';
import { logAudit } from '../services/audit.service';

export async function get(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const settings = await settingsService.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = settingsService.settingsSchema.parse(req.body);
    const settings = await settingsService.updateSettings(data);
    await logAudit(req, {
      action: 'SETTINGS_UPDATED',
      entity: 'Setting',
      entityId: settings.id,
      details: `${settings.companyName} (${settings.currency} ${settings.currencySymbol})`,
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}
