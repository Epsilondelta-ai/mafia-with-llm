import { Router } from 'express';
import { getGameRecords, getGameRecord, deleteGameRecord, getGameStats } from '../db/history.js';

const router = Router();

router.get('/games', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const records = getGameRecords(limit, offset);
  res.json(records);
});

router.get('/games/stats', (_req, res) => {
  const stats = getGameStats();
  res.json(stats);
});

router.get('/games/:id', (req, res) => {
  const record = getGameRecord(req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json(record);
});

router.delete('/games/:id', (req, res) => {
  const deleted = deleteGameRecord(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
