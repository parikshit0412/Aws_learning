import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../db/schema';
import { JWT_SECRET } from '../middleware/auth';
import { UserPayload } from '../../types';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<any> => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [createdUser] = await db
      .insert(users)
      .values({ username, passwordHash })
      .returning({ id: users.id, username: users.username });

    return res.status(201).json({
      message: 'User registered successfully',
      user: createdUser,
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const payload: UserPayload = { userId: user.id, username: user.username };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });

    return res.json({ token, tokenType: 'Bearer' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

