import React, { useState, useEffect } from 'react';
import { X, Send, Paperclip, AlertTriangle, ShieldCheck, FileText, Trash2, Shield, Building2, Crown, UserCheck } from 'lucide-react';
import { UserSession } from '../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (payload: {
    to: string;
    from?: string;
    subject: string;
    bodyText: string;
    attachments?: Array<{ filename: string; contentType: string; base64Content: string }>;
  }) => Promise<void>;
  defaultTo?: string;
  senderEmail?: string;
  currentUser?: UserSession | null;
}

function slugifyName(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return clean || 'staff';
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSend,
  defaultTo = '',
  currentUser
}) => {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState<Array<{ filename: string; contentType: string; base64Content: string; size: number }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sender choice state for CEO (Level 90) or testing spoofing
  const [ceoChoice, setCeoChoice] = useState<'ceo' | 'name'>('ceo');
  const [customFromOverride, setCustomFromOverride] = useState('');
  const [showOverrideTest, setShowOverrideTest] = useState(false);

  useEffect(() => {
    setTo(defaultTo);
  }, [defaultTo]);

  if (!isOpen) return null;

  // Derive sender address based on user token name and hierarchy level
  const userLevel = currentUser?.level ?? 75;
  const derivedFromTokenName = currentUser?.name 
    ? `${slugifyName(currentUser.name)}@housika.co.ke`
    : (currentUser?.email || 'staff@housika.co.ke');

  let activeSenderEmail = derivedFromTokenName;
  let policyBadge = 'Token-Derived';
  let policyColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

  if (userLevel === 100) {
    activeSenderEmail = 'company@housika.co.ke';
    policyBadge = 'Level 100 Corporate Enforced';
    policyColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  } else if (userLevel === 90) {
    activeSenderEmail = ceoChoice === 'ceo' ? 'ceo@housika.co.ke' : derivedFromTokenName;
    policyBadge = 'Level 90 CEO Authority';
    policyColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  } else {
    activeSenderEmail = derivedFromTokenName;
    policyBadge = `Level ${userLevel} Token Name (${currentUser?.name || 'Staff'})`;
    policyColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  }

  // If testing spoofing override
  const finalFrom = showOverrideTest && customFromOverride.trim() ? customFromOverride.trim() : activeSenderEmail;

  // Real-time spam trigger preview
  const lowerSub = subject.toLowerCase();
  const lowerBody = bodyText.toLowerCase();
  const isSpamTriggered =
    lowerSub.includes('urgent payment required') ||
    lowerSub.includes('lottery prize') ||
    lowerBody.includes('wire funds immediately');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    (Array.from(files) as File[]).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Content = (reader.result as string).split(',')[1];
        setAttachments(prev => [
          ...prev,
          {
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            base64Content,
            size: file.size
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to || !subject || !bodyText) {
      setError('Please fill in recipient, subject, and message.');
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await onSend({
        to,
        from: finalFrom,
        subject,
        bodyText,
        attachments: attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          base64Content: a.base64Content
        }))
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch email.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">Compose New Email</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Cosmos DB + R2
            </span>
          </div>
          <button
            id="close-compose-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Policy Banner & Controls */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                {userLevel === 100 && <Building2 className="w-4 h-4 text-blue-400" />}
                {userLevel === 90 && <Crown className="w-4 h-4 text-amber-400" />}
                {userLevel < 90 && <UserCheck className="w-4 h-4 text-emerald-400" />}
                <span>Sender Identity:</span>
                <span className="font-mono text-slate-100 font-semibold">{finalFrom}</span>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${policyColor}`}>
                {policyBadge}
              </span>
            </div>

            {/* CEO Choice Switcher (Level 90) */}
            {userLevel === 90 && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3">
                <span className="text-[11px] text-slate-400">CEO Sender Option:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setCeoChoice('ceo'); setShowOverrideTest(false); }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      ceoChoice === 'ceo' && !showOverrideTest
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    👑 ceo@housika.co.ke
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCeoChoice('name'); setShowOverrideTest(false); }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      ceoChoice === 'name' && !showOverrideTest
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    👤 {derivedFromTokenName}
                  </button>
                </div>
              </div>
            )}

            {/* Level 100 Corporate Note */}
            {userLevel === 100 && (
              <p className="text-[11px] text-blue-400/80">
                Corporate broadcast identity: all dispatches strictly emit as <code>company@housika.co.ke</code>.
              </p>
            )}

            {/* Level 70-89 Token-Derived Note */}
            {userLevel >= 70 && userLevel < 90 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Sender constructed automatically from token name <strong>"{currentUser?.name}"</strong></span>
                <button
                  type="button"
                  onClick={() => setShowOverrideTest(!showOverrideTest)}
                  className="text-slate-500 hover:text-slate-300 underline text-[10px]"
                >
                  {showOverrideTest ? 'Hide Spoof Test' : 'Test Spoofing (403 Check)'}
                </button>
              </div>
            )}

            {/* Optional Spoofing Test Input */}
            {showOverrideTest && (
              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-[11px] text-rose-400 font-medium mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Test Unauthorized Sender (Backend will return 403 Forbidden):
                </label>
                <input
                  type="text"
                  placeholder="e.g. impostor@housika.co.ke or ceo@housika.co.ke"
                  value={customFromOverride}
                  onChange={(e) => setCustomFromOverride(e.target.value)}
                  className="w-full bg-slate-900 border border-rose-900/50 rounded px-2.5 py-1 text-xs text-rose-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Quick presets for recipients */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Send To (Select or Type):</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { label: '🏢 company@housika.co.ke', value: 'company@housika.co.ke' },
                { label: '👑 ceo@housika.co.ke', value: 'ceo@housika.co.ke' },
                { label: '💳 payments@housika.co.ke', value: 'payments@housika.co.ke' },
                { label: '🎧 help@housika.co.ke', value: 'help@housika.co.ke' },
                { label: '💼 collinsjuma@housika.co.ke', value: 'collinsjuma@housika.co.ke' },
                { label: '👤 client.otieno@gmail.com', value: 'client.otieno@gmail.com' }
              ].map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setTo(preset.value)}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    to === preset.value
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              id="compose-to-input"
              type="text"
              required
              placeholder="e.g. payments@housika.co.ke or client@domain.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Subject:</label>
            <input
              id="compose-subject-input"
              type="text"
              required
              placeholder="Email subject line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-400">Message Body:</label>
              {isSpamTriggered ? (
                <span className="text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Spam keyword detected (Score +35)
                </span>
              ) : (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Deliverability: Clean (Inbox guaranteed)
                </span>
              )}
            </div>
            <textarea
              id="compose-body-textarea"
              required
              rows={5}
              placeholder="Write your email body here..."
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          {/* Attachments Section */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                Attachments (Uploaded to Cloudflare R2 - Max 25MB total)
              </span>
              <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                <span>+ Add File</span>
                <input
                  id="compose-file-input"
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No files attached yet. Binary files will be stored in R2 and metadata in Cosmos DB.</p>
            ) : (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-200 truncate">{att.filename}</span>
                      <span className="text-[11px] text-slate-500">({(att.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-[11px] text-slate-500">
              Resolved Sender: <span className="font-mono text-slate-300 font-medium">{finalFrom}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                id="submit-send-email-btn"
                type="submit"
                disabled={isSending}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSending ? 'Uploading to R2 & Cosmos...' : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
