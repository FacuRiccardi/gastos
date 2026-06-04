import { buildApp } from './src/http/app.js';
import { makeRepos } from './src/infrastructure/repositories.js';

const app = buildApp(makeRepos());

app.listen({ port: 8080 }, (err, address) => {
    if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(`Server listening at ${address}`);
});
