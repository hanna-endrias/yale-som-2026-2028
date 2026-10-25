import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email.' }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: 'Enter your password.' }),
});

export const signupSchema = z.object({
  email,
  password: z.string().min(8, { error: 'Password must be at least 8 characters.' }),
});
