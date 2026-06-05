import type { FastifyInstance, FastifyError } from 'fastify';
import { DomainError } from '../domain/shared/DomainError.js';
import { ApplicationError } from '../application/ApplicationError.js';
import { InfrastructureError } from '../infrastructure/InfrastructureError.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(422).send({ error: error.message });
    }
    if (error instanceof ApplicationError) {
      const status = /not found/i.test(error.message) ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
    if (error instanceof InfrastructureError) {
      return reply.code(500).send({ error: error.message });
    }
    if (error.statusCode) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    return reply.code(500).send({ error: 'Internal server error' });
  });
}
