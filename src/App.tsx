import React, { useState, useEffect, useCallback } from 'react';
import { Email, UserSession } from './types';
import { Header } from './components/Header';
import { MailboxView } from './components/MailboxView';
import { ComposeModal } from './components/ComposeModal';
import { CosmosDiagnostics } from './components/CosmosDiagnostics';
import { CloudflareSimulator } from './components/CloudflareSimulator';
import { DocumentationTab } from './components/DocumentationTab';
import { Mail, Database, Cloud, BookOpen, PenSquare } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'mailbox' | 'diagnostics' | 'simulator' | 'docs'>('mailbox');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authToken, setAuthToken] = useState<string>('');
  const [authMethod, setAuthMethod] = useState<'cookie' | 'header'>('header');
  const [selectedDomain, setSelectedDomain] = useState<string>('housika.co.ke');
  
  // Mailbox State
  const [activeStatus, setActiveStatus] = useState<string>('inbox');
  const [activePk, setActivePk] = useState<string>('payments');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queryMeta, setQueryMeta] = useState<any>(null);

  // Compose / Reply State
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [replyParent, setReplyParent] = useState<Email | null>(null);

  // Switch role and issue new JWT
  const handleSelectRole = useCallback(async (roleKey: string) => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: roleKey })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Authentication failed');
        if (roleKey === 'unauthorized') {
          setCurrentUser({
            accountId: 'acc_intern_50',
            name: 'Junior Intern (Blocked)',
            email: 'intern@housika.co.ke',
            role: 'employee',
            level: 50,
            domain: 'housika.co.ke'
          });
          setAuthToken('');
          setEmails([]);
          setSelectedEmail(null);
        }
        return;
      }

      setCurrentUser(data.user);
      setAuthToken(data.token);
      
      // If role changed, set default partition
      if (roleKey === 'ceo') setActivePk('ceo');
      else if (roleKey === 'manager') setActivePk('payments');
      else if (roleKey === 'customercare') setActivePk('help');

    } catch (err: any) {
      setErrorMessage(err.message || 'Token generation failed');
    }
  }, []);

  // Fetch emails from Hono backend
  const fetchEmails = useCallback(async () => {
    if (!currentUser || (currentUser.level < 70 && !authToken)) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const headers: Record<string, string> = {};
      if (authMethod === 'header' && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`/api/emails/list?pk=${encodeURIComponent(activePk)}&status=${activeStatus}`, {
        headers,
        credentials: 'include'
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error || 'Failed to query mailbox.');
        setEmails([]);
        setSelectedEmail(null);
        return;
      }

      setEmails(json.data || []);
      setQueryMeta(json.meta);

      if (json.data && json.data.length > 0) {
        setSelectedEmail(json.data[0]);
      } else {
        setSelectedEmail(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error fetching emails.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, authToken, authMethod, activePk, activeStatus]);

  // Initial load: log in as Manager (Level 85)
  useEffect(() => {
    handleSelectRole('manager');
  }, [handleSelectRole]);

  // Refetch emails when user, partition, status, or auth method changes
  useEffect(() => {
    if (currentUser && currentUser.level >= 70) {
      fetchEmails();
    }
  }, [currentUser, activePk, activeStatus, authMethod, fetchEmails]);

  // Select single email for viewing
  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    try {
      const headers: Record<string, string> = {};
      if (authMethod === 'header' && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`/api/emails/get?id=${encodeURIComponent(email.id)}&pk=${encodeURIComponent(email.pk)}`, {
        headers,
        credentials: 'include'
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSelectedEmail(json.data);
          setEmails(prev => prev.map(e => (e.id === json.data.id ? json.data : e)));
        }
      }
    } catch (err) {
      console.warn('Point read failed', err);
    }
  };

  // Dispatch Send or Reply Email
  const handleSendEmail = async (payload: {
    to: string;
    from?: string;
    subject: string;
    bodyText: string;
    attachments?: Array<{ filename: string; contentType: string; base64Content: string }>;
  }) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authMethod === 'header' && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (replyParent) {
      const res = await fetch('/api/emails/reply', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          parentEmailId: replyParent.id,
          parentPk: replyParent.pk,
          bodyText: payload.bodyText,
          subject: payload.subject,
          from: payload.from,
          attachments: payload.attachments
        })
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error?.message || data.error || 'Failed to dispatch reply.');
      }
    } else {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error?.message || data.error || 'Failed to send email.');
      }
    }

    await fetchEmails();
  };

  // Dispatch Reply Email
  const handleReplyEmail = async (parentEmail: Email) => {
    setReplyParent(parentEmail);
    setIsComposeOpen(true);
  };

  // Dispatch Delete Email
  const handleDeleteEmail = async (email: Email, permanent = false) => {
    const confirmText = permanent
      ? `Permanently purge email "${email.subject}" from Cosmos DB and delete attachments from R2?`
      : `Move "${email.subject}" to Trash?`;

    if (!window.confirm(confirmText)) return;

    try {
      const headers: Record<string, string> = {};
      if (authMethod === 'header' && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`/api/emails/delete?id=${encodeURIComponent(email.id)}&pk=${encodeURIComponent(email.pk)}&permanent=${permanent}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Delete failed.');
        return;
      }

      await fetchEmails();
    } catch (err: any) {
      alert(err.message || 'Delete operation failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Header & Role Control */}
      <Header
        currentUser={currentUser}
        authToken={authToken}
        authMethod={authMethod}
        selectedDomain={selectedDomain}
        onSelectRole={handleSelectRole}
        onToggleAuthMethod={setAuthMethod}
        onSelectDomain={setSelectedDomain}
      />

      {/* Main Tab Navigation & Actions */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex gap-1 py-2">
            <button
              id="tab-mailbox"
              onClick={() => setActiveTab('mailbox')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'mailbox'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Mailbox Explorer
            </button>

            <button
              id="tab-diagnostics"
              onClick={() => setActiveTab('diagnostics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'diagnostics'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Cosmos DB & R2 Diagnostics
            </button>

            <button
              id="tab-simulator"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              Cloudflare Inbound Simulator
            </button>

            <button
              id="tab-docs"
              onClick={() => setActiveTab('docs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'docs'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              API Docs (/docs)
            </button>
          </div>

          {/* Quick Compose Button */}
          <button
            id="open-compose-btn"
            onClick={() => {
              setReplyParent(null);
              setIsComposeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Dynamic Tab Body */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'mailbox' && (
          <MailboxView
            emails={emails}
            selectedEmail={selectedEmail}
            onSelectEmail={handleSelectEmail}
            activeStatus={activeStatus}
            onChangeStatus={setActiveStatus}
            activePk={activePk}
            onChangePk={setActivePk}
            onRefresh={fetchEmails}
            onReply={handleReplyEmail}
            onDelete={handleDeleteEmail}
            currentUser={currentUser}
            queryMeta={queryMeta}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        )}

        {activeTab === 'diagnostics' && <CosmosDiagnostics />}

        {activeTab === 'simulator' && (
          <CloudflareSimulator
            onIngestSuccess={() => {
              fetchEmails();
              setActiveTab('mailbox');
            }}
          />
        )}

        {activeTab === 'docs' && <DocumentationTab />}
      </main>

      {/* Compose / Reply Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false);
          setReplyParent(null);
        }}
        onSend={handleSendEmail}
        defaultTo={replyParent ? replyParent.sender : ''}
        senderEmail={currentUser?.email || 'staff@housika.co.ke'}
        currentUser={currentUser}
      />
    </div>
  );
}
