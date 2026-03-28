import { faker } from "@faker-js/faker";

export const createAgentFactory = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  role: "agent",
  createdAt: faker.date.recent().toISOString(),
  ...overrides,
});
