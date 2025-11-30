import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth-options';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(200).json({ status: 'anonymous' });
  }
  return res.status(200).json({
    status: 'authenticated',
    user: session.user,
    error: session.error
  });
}

