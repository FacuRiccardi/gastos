import createClient from 'openapi-fetch';
import type { paths } from '@shared/api-types';

export const apiClient = createClient<paths>({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });
