import { z } from 'zod';

export const sessionIdSchema = z.coerce.number().int().positive();

export const renameSessionSchema = z.object({
  title: z.string().trim().min(1, { error: 'Enter a title.' }).max(100, { error: 'Keep the title under 100 characters.' }),
});

// The client sends only the new turn's text; history is always loaded from the DB.
export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, { error: 'Type a message.' }).max(4000, { error: 'Message is too long.' }),
});

// What a fetch plan card started (PATCH /api/chat-sessions/:id/fetch-plan), saved on its planFetchRun message
// so the card shows those runs after a reload. toolCallId names the card's tool part.
export const fetchPlanStartSchema = z.object({
  toolCallId: z.string().trim().min(1).max(200),
  runIds: z.array(z.number().int().positive()).min(1).max(100),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  criteriaLabel: z.string().max(2000),
  edited: z.boolean(), // false: started as planned
});

export type FetchPlanStart = z.output<typeof fetchPlanStartSchema>;
