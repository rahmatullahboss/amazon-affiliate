export interface EditableAgentLike {
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
}

export interface AgentFormValues {
  name: string;
  slug: string;
  email: string;
  phone: string;
}

export interface ActivityFilterableAgent {
  id: number;
  is_active: number;
}

export interface AgentProductCountLike {
  agent_id: number;
  tracking_marketplace: string;
}

export interface HomepageVisibilityLike {
  agent_id: number;
  show_on_homepage: number;
}

export type AgentActivityFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function buildAgentFormValues(agent: EditableAgentLike): AgentFormValues {
  return {
    name: agent.name,
    slug: agent.slug,
    email: agent.email || "",
    phone: agent.phone || "",
  };
}

export function isInlineEditingAgent(
  editingId: number | null,
  agentId: number
): boolean {
  return editingId === agentId;
}

export function filterAgentsByActivity<T extends ActivityFilterableAgent>(
  agents: T[],
  filter: AgentActivityFilter
): T[] {
  if (filter === "ACTIVE") {
    return agents.filter((agent) => agent.is_active === 1);
  }

  if (filter === "INACTIVE") {
    return agents.filter((agent) => agent.is_active !== 1);
  }

  return agents;
}

export function retainInlineEditingAgentId<T extends Pick<ActivityFilterableAgent, "id">>(
  editingId: number | null,
  agents: T[]
): number | null {
  if (editingId === null) {
    return null;
  }

  return agents.some((agent) => agent.id === editingId) ? editingId : null;
}

export function getHomepageProductCountForAgent<T extends HomepageVisibilityLike>(
  agentId: number,
  mappings: T[]
): number {
  return mappings.filter(
    (mapping) => mapping.agent_id === agentId && mapping.show_on_homepage === 1
  ).length;
}

export function getMarketplaceProductCountsForAgent<T extends AgentProductCountLike>(
  agentId: number,
  mappings: T[]
): Array<{ marketplace: string; count: number }> {
  const counts = new Map<string, number>();

  for (const mapping of mappings) {
    if (mapping.agent_id !== agentId) {
      continue;
    }

    counts.set(
      mapping.tracking_marketplace,
      (counts.get(mapping.tracking_marketplace) ?? 0) + 1
    );
  }

  return [...counts.entries()]
    .map(([marketplace, count]) => ({ marketplace, count }))
    .sort((left, right) => left.marketplace.localeCompare(right.marketplace));
}
