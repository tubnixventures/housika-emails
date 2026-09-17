export interface EmailAttachment {
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  url?: string;
  downloadUrl?: string;
}

export interface EmailAttribution {
  agentId: string;
  agentName: string;
  agentEmail: string;
  agentLevel: number;
  action: 'sent' | 'replied' | 'forwarded' | 'assigned';
  timestamp: string;
}

export interface Email {
  id: string;
  pk: string; // Cosmos DB Partition Key
  domain: string;
  sender: string;
  senderName: string;
  receiver: string;
  receiverName: string;
  receiverLevel?: number;
  cc?: string[];
  bcc?: string[];
  subject: string;
  textPreview: string;
  bodyText: string;
  bodyHtml?: string;
  r2MimeKey?: string;
  attachments: EmailAttachment[];
  threadId: string;
  inReplyTo?: string;
  references?: string[];
  status: 'inbox' | 'sent' | 'spam' | 'trash' | 'archived';
  isRead: boolean;
  isStarred: boolean;
  spamScore: number;
  spamReasons: string[];
  spfResult: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none';
  dkimResult: 'pass' | 'fail' | 'none';
  dmarcResult: 'pass' | 'fail' | 'none';
  attribution?: EmailAttribution;
  ttl?: number; // Automatic Cosmos DB 30-day Time-To-Live
  syntheticPk?: string; // High-volume partition scaling
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface UserSession {
  accountId: string;
  name: string;
  email: string;
  role: 'company' | 'ceo' | 'manager' | 'admin' | 'customercare' | 'employee';
  level: number;
  domain: string;
  assignedMailboxes?: string[];
}

export interface CosmosPartitionStat {
  pk: string;
  count: number;
  unreadCount: number;
}
