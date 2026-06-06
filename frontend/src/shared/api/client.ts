import createClient from 'openapi-fetch';
import type { paths } from '@shared/api-types';

export const apiClient = createClient<paths>({ baseUrl: '' });
