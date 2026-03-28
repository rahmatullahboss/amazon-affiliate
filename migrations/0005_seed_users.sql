
-- Create default agents
INSERT INTO agents (slug, name, is_active)
VALUES
  ('demo-agent', 'Demo Agent', 1)
ON CONFLICT (slug) DO NOTHING;

-- Create admin user
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('admin', 'c5563307e3da53a38fbf54388943b3cf:2a72421ff3bfa3f1e955c315ea3ebf4de6052c0d99ced51ca8e9633681dd76b2', 'admin', 1)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash;

-- Create agent user linked to demo-agent
INSERT INTO users (username, password_hash, role, agent_id, is_active)
VALUES ('agent1', '47cb36040f1ee72b93df30a69179a7e3:38d6652ce278b4e7460228696286ddf4c144995c7b04b2595947e55a16fd2a9c', 'agent', (SELECT id FROM agents WHERE slug = 'demo-agent' LIMIT 1), 1)
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash;
  