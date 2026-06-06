import type { FastifyRequest, FastifyReply } from 'fastify';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireUserId(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = request.headers['x-user-id'];
  if (!userId || Array.isArray(userId) || !UUID_REGEX.test(userId)) {
    return reply.code(400).send({ error: 'Missing or invalid X-User-Id header' });
  }
  (request as FastifyRequest & { userId: string }).userId = userId;
}

export async function requireHouseholdId(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const householdId = request.headers['x-household-id'];
  if (!householdId || Array.isArray(householdId) || !UUID_REGEX.test(householdId)) {
    return reply.code(400).send({ error: 'Missing or invalid X-Household-Id header' });
  }
  (request as FastifyRequest & { householdId: string }).householdId = householdId;
}
