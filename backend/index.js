import { buildApp } from './src/http/app.js';
import { makeRepos } from './src/infrastructure/repositories.js';

const app = buildApp(makeRepos());
const port = process.env.PORT ? Number(process.env.PORT) : 8080;

try {
    await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
