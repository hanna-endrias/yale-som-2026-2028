import { z } from 'zod';

export const sessionIdSchema = z.coerce.number().int().positive();

export const renameSessionSchema = z.object({
  title: z.string().trim().min(1, { error: 'Enter a title.' }).max(100, { error: 'Keep the title under 100 characters.' }),
});

// The client sends only the new turn's text; history is always loaded from the DB.
export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, { error: 'Type a message.' }).max(4000, { error: 'Message is too long.' }),
});
