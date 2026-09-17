import React, { useState } from 'react';
import { Email, UserSession } from '../types';
import {
  Inbox,
  Send,
  AlertOctagon,
  Trash2,
  Paperclip,
  CheckCircle2,
  Clock,
  Shield,
  User,
  CornerUpLeft,
  FileText,
  Download,
  AlertTriangle,
  RefreshCw,
  Search,
  Database
} from 'lucide-react';

interface MailboxViewProps {
  emails: Email[];
  selectedEmail: Email | null;
  onSelectEmail: (email: Email) => void;
  activeStatus: string;
  onChangeStatus: (status: string) => void;
  activePk: string;
  onChangePk: (pk: string) => void;
  onRefresh: () => void;
  onReply: (parentEmail: Email) => void;
  onDelete: (email: Email, permanent?: boolean) => void;
  currentUser: UserSession | null;
  queryMeta?: {
    partitionKey?: string;
    queryType?: string;
    ruCharged?: number;
    count?: number;
  };
  isLoading: boolean;
  errorMessage?: string | null;
}

export const MailboxView: React.FC<MailboxViewProps> = ({
  emails,
  selectedEmail,
  onSelectEmail,
  activeStatus,
  onChangeStatus,
  activePk,
  onChangePk,
  onRefresh,
  onReply,
  onDelete,
  currentUser,
  queryMeta,
  isLoading,
  errorMessage
}) => {
  const [searchFilter, setSearchFilter] = useState('');

  const filteredEmails = emails.filter(e => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      e.subject.toLowerCase().includes(q) ||
      e.sender.toLowerCase().includes(q) ||
      e.receiver.toLowerCase().includes(q) ||
      (e.bodyText && e.bodyText.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full min-h-[600px] bg-slate-950 overflow-hidden">
      
      {/* Sidebar / Mailbox & Folder Navigator */}
      <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-5 shrink-0">
        
        {/* Status Folders */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Folders</div>
          <div className="space-y-1">
            {[
              { id: 'inbox', label: 'Inbox', icon: Inbox, color: 'text-blue-400' },
              { id: 'sent', label: 'Sent', icon: Send, color: 'text-emerald-400' },
              { id: 'spam', label: 'Spam', icon: AlertOctagon, color: 'text-amber-400' },
              { id: 'trash', label: 'Trash', icon: Trash2, color: 'text-rose-400' },
            ].map(folder => {
              const Icon = folder.icon;
              const isActive = activeStatus === folder.id;
              return (
                <button
                  key={folder.id}
                  id={`folder-${folder.id}`}
                  onClick={() => onChangeStatus(folder.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${folder.color}`} />
                    <span>{folder.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Partition Key Selector (Department vs Staff) */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <span>Cosmos DB Partition (pk)</span>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 px-1 mb-1">Shared Inboxes (PK: short name)</div>
            {[
              { pk: 'payments', label: 'payments (Finance)', tag: 'Shared PK' },
              { pk: 'help', label: 'help (Customer Care)', tag: 'Shared PK' },
              { pk: 'ceo', label: 'ceo (Executive L100)', tag: 'Restricted' },
            ].map(item => (
              <button
                key={item.pk}
                id={`pk-${item.pk}`}
                onClick={() => onChangePk(item.pk)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
                  activePk === item.pk
                    ? 'bg-slate-800 text-blue-300 border border-slate-700 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="text-[10px] font-mono text-slate-500">{item.tag}</span>
              </button>
            ))}

            <div className="text-[10px] text-slate-500 px-1 pt-2 mb-1">Staff Inboxes (PK: email address)</div>
            {[
              { pk: 'collinsjuma@housika.co.ke', label: 'collinsjuma@ (Manager L85)' },
              { pk: 'movinjuma@housika.co.ke', label: 'movinjuma@ (Agent L75)' },
            ].map(item => (
              <button
                key={item.pk}
                id={`pk-${item.pk.split('@')[0]}`}
                onClick={() => onChangePk(item.pk)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
                  activePk === item.pk
                    ? 'bg-slate-800 text-purple-300 border border-slate-700 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Query Metric Banner */}
        <div className="mt-auto p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <Database className="w-3.5 h-3.5" />
            <span>Single-Partition Query</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Cosmos DB Route: <code className="text-blue-300">WHERE c.pk = '{activePk}'</code>
          </div>
          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/80">
            <span>Cosmos Request Units:</span>
            <span className="font-mono text-emerald-400 font-semibold">{queryMeta?.ruCharged ?? 2.8} RU</span>
          </div>
        </div>
      </div>

      {/* Email List Column */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col bg-slate-900/40">
        
        {/* List Header & Filter */}
        <div className="p-3 border-b border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span className="capitalize">{activeStatus}</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                {filteredEmails.length}
              </span>
            </div>
            <button
              id="refresh-emails-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="Refresh inbox via Cosmos DB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              id="search-emails-input"
              type="text"
              placeholder="Search sender, subject..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Error message if unauthorized */}
        {errorMessage && (
          <div className="m-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <div className="font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Cosmos DB Authorization Rejection
            </div>
            <p className="text-[11px] leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {isLoading && emails.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span>Querying Cosmos DB partition...</span>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No emails found in this partition with status "{activeStatus}".
            </div>
          ) : (
            filteredEmails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              return (
                <div
                  key={email.id}
                  id={`email-item-${email.id}`}
                  onClick={() => onSelectEmail(email)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-l-4 border-l-blue-500'
                      : 'hover:bg-slate-850 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-xs truncate ${email.isRead ? 'text-slate-400' : 'text-slate-100 font-semibold'}`}>
                      {email.senderName || email.sender}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className={`text-xs truncate mb-1 ${email.isRead ? 'text-slate-300' : 'text-slate-100 font-medium'}`}>
                    {email.subject}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-1.5">
                    {email.textPreview || email.bodyText}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {email.attachments && email.attachments.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700">
                        <Paperclip className="w-2.5 h-2.5" />
                        {email.attachments.length} {email.attachments.length === 1 ? 'file (R2)' : 'files (R2)'}
                      </span>
                    )}

                    {email.attribution && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {email.attribution.agentName.split(' ')[0]} (Attributed)
                      </span>
                    )}

                    {email.spamScore > 40 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Spam: {email.spamScore}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Email Reader View */}
      <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
        {selectedEmail ? (
          <div className="p-6 max-w-4xl flex flex-col gap-6">
            
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  id="email-reply-btn"
                  onClick={() => onReply(selectedEmail)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  Reply with Attribution
                </button>
                <button
                  id="email-trash-btn"
                  onClick={() => onDelete(selectedEmail, false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 flex items-center gap-1.5 transition-all"
                  title="Soft-delete to trash"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  Move to Trash
                </button>
                {currentUser?.level && currentUser.level >= 85 && (
                  <button
                    id="email-purge-btn"
                    onClick={() => onDelete(selectedEmail, true)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/30 flex items-center gap-1.5 transition-all"
                    title="Permanently purge from Cosmos DB & R2 (Level 85+ required)"
                  >
                    Purge from R2 & DB
                  </button>
                )}
              </div>

              {/* Cosmos RU Point Read indicator */}
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                  Point Read: 1.0 RU
                </span>
                <span>ID: {selectedEmail.id}</span>
              </div>
            </div>

            {/* Email Header */}
            <div>
              <h2 className="text-xl font-bold text-slate-100 mb-3">{selectedEmail.subject}</h2>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">From:</span>
                    <strong className="text-slate-100">{selectedEmail.senderName}</strong>
                    <span className="font-mono text-slate-400">&lt;{selectedEmail.sender}&gt;</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">To:</span>
                    <span className="font-mono text-blue-300">{selectedEmail.receiver}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">Cosmos PK:</span>
                    <code className="text-emerald-400 font-mono font-semibold">{selectedEmail.pk}</code>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs text-slate-400 flex items-center justify-end gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(selectedEmail.createdAt).toLocaleString()}</span>
                  </div>
                  
                  {/* Security / Deliverability Badge */}
                  <div className="flex items-center justify-end gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      SPF: {selectedEmail.spfResult.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      DKIM: {selectedEmail.dkimResult.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Care Attribution Banner */}
              {selectedEmail.attribution && (
                <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-blue-900/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-slate-200 font-medium">
                        Customer Care Agent Attribution: {selectedEmail.attribution.agentName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {selectedEmail.attribution.agentEmail} (Level {selectedEmail.attribution.agentLevel}) • Action: {selectedEmail.attribution.action}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(selectedEmail.attribution.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* Email Body */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
              <div className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {selectedEmail.bodyText}
              </div>
            </div>

            {/* Attachments Section (Cloudflare R2 Object Storage) */}
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Paperclip className="w-4 h-4 text-blue-400" />
                    <span>Cloudflare R2 Storage Attachments ({selectedEmail.attachments.length})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Zero Egress Fees • S3-Compatible</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedEmail.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <div className="truncate">
                          <div className="text-slate-200 font-medium truncate">{att.filename}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {(att.sizeBytes / 1024).toFixed(1)} KB • {att.contentType}
                          </div>
                        </div>
                      </div>
                      <a
                        href={att.downloadUrl || att.url || `/api/emails/attachments/download?key=${encodeURIComponent(att.key)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1 font-medium text-[11px] shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw MIME Info */}
            {selectedEmail.r2MimeKey && (
              <div className="text-[11px] text-slate-500 flex items-center gap-2 font-mono">
                <span>Raw EML MIME Key in R2:</span>
                <code className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded">{selectedEmail.r2MimeKey}</code>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">No Email Selected</p>
              <p className="text-xs text-slate-500 mt-0.5">Select a message from the list to read its contents and attachments.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
