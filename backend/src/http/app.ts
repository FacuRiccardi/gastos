import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { Repositories } from './types.js';
import { registerErrorHandler } from './error-handler.js';
import { identityRoutes } from './identity/routes.js';
import { catalogueRoutes } from './catalogue/routes.js';
import { expenseRoutes } from './expense/routes.js';
import { budgetRoutes } from './budget/routes.js';

export function buildApp(repos: Repositories) {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);

  app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Gastos API', version: '1.0.0' },
      components: {
        securitySchemes: {
          userId: { type: 'apiKey', in: 'header', name: 'x-user-id' },
          householdId: { type: 'apiKey', in: 'header', name: 'x-household-id' },
        },
      },
      security: [{ userId: [], householdId: [] }],
    },
  });
  app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  app.register(identityRoutes(repos), { prefix: '/api' });
  app.register(catalogueRoutes(repos), { prefix: '/api' });
  app.register(expenseRoutes(repos), { prefix: '/api' });
  app.register(budgetRoutes(repos), { prefix: '/api' });
  return app;
}
