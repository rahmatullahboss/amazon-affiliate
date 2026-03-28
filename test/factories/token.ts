import { createTestJwt } from '../utils/auth-test-helper';

export async function generateAdminToken(secret = 'test-secret'): Promise<string> {
  return createTestJwt(
    {
      sub: 1, // Admin ID
      role: 'admin',
      username: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
    secret
  );
}

export async function generateAgentToken(
  agentId: number,
  username: string,
  secret = 'test-secret'
): Promise<string> {
  return createTestJwt(
    {
      sub: agentId + 100, // Usually user ID
      role: 'agent',
      agentId,
      username,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret
  );
}
