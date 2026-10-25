import { sendMessageSchema } from '@/lib/validation/chat';

export { parseSessionId } from '../request';

export async function parseSendMessageRequest(req: Request) {
  const result = sendMessageSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
