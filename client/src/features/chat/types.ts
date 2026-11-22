export type ChatMessageSender = "me" | "other";

export type ChatMessage = {
  id: string;
  sender: ChatMessageSender;
  text: string;
  time: string;
};

export type ChatThreadKind = "ai" | "seller";

export type ChatThread = {
  id: string;
  kind: ChatThreadKind;
  name: string;
  subtitle: string;
  listingTitle?: string;
  listingPrice?: string;
  listingImage?: string;
  messages: ChatMessage[];
};
