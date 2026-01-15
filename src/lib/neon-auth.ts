import { createAuthClient } from '@neondatabase/neon-js/auth';

export const neonAuthClient = createAuthClient(
    import.meta.env.VITE_NEON_AUTH_URL
);
