import fs from 'node:fs';
import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltHex = Array.from(salt).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

async function main() {
  const adminPassword = 'AdminPassword123!';
  const agentPassword = 'AgentPassword123!';
  
  const adminHash = await hashPassword(adminPassword);
  const agentHash = await hashPassword(agentPassword);

  const sql = `
-- Create default agents
INSERT INTO agents (slug, name, is_active)
VALUES
  ('demo-agent', 'Demo Agent', 1)
ON CONFLICT (slug) DO NOTHING;

-- Create admin user
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('admin', '${adminHash}', 'admin', 1)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash;

-- Create agent user linked to demo-agent
INSERT INTO users (username, password_hash, role, agent_id, is_active)
VALUES ('agent1', '${agentHash}', 'agent', (SELECT id FROM agents WHERE slug = 'demo-agent' LIMIT 1), 1)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash;
  `;

  fs.writeFileSync('migrations/seed_users.sql', sql);
  console.log('Generated migrations/seed_users.sql');
  console.log('Admin user: admin / ' + adminPassword);
  console.log('Agent user: agent1 / ' + agentPassword);
}

main().catch(console.error);
