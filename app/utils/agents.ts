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
