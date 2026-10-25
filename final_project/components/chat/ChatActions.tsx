'use client';

import { createContext, useContext } from 'react';
import type { SearchCriteria } from '@/lib/searchCriteria';

// Pre-fills a client-side FetchSetupCard (addSetupCard). Missing fields use the card's defaults.
export type SetupPrefill = {
  startDate?: string;
  endDate?: string;
  cadence?: 'daily' | 'weekly' | 'monthly';
  promptId?: number; // a saved search criteria of this tracker
  criteria?: SearchCriteria; // one-time criteria (ignored when promptId is set)
};

// What cards and panels inside a chat can do to it. Provided by ChatWindow (via ChatActionsProvider),
// read with useChatActions(); cards inside ChatMessageBubble only get their tool output, so they use this.
export type ChatActions = {
  sessionId: number; // the open chat (a fetch plan card records what it started on its message)
  sendQuestion: (text: string) => void; // send a user turn now (ignored while a reply streams)
  setDraft: (text: string) => void; // put text in the chat box, focused, without sending
  addSetupCard: (prefill?: SetupPrefill) => void; // append a FetchSetupCard at the bottom of the chat
  // Call once a card's runs are all done. Sends `followUp`, else the question remembered from a starter
  // prompt, as the next user turn, once per set of runs. Returns whether a question was sent.
  onRunsDone: (runIds: number[], followUp?: string) => boolean;
  runsChanged: () => void; // a card started runs: the side panel's Fetches tab reloads
  runsVersion: number; // bumped by runsChanged and onRunsDone
};

const ChatActionsContext = createContext<ChatActions | null>(null);

export function ChatActionsProvider({ value, children }: { value: ChatActions; children: React.ReactNode }) {
  return <ChatActionsContext.Provider value={value}>{children}</ChatActionsContext.Provider>;
}

export function useChatActions(): ChatActions {
  const actions = useContext(ChatActionsContext);
  if (!actions) throw new Error('useChatActions must be used inside ChatActionsProvider.');
  return actions;
}
