import React, { useState } from 'react';
import { Cloud, Send, ShieldAlert, CheckCircle2, Terminal, Copy, Check } from 'lucide-react';

interface CloudflareSimulatorProps {
  onIngestSuccess: () => void;
}

export const CloudflareSimulator: React.FC<CloudflareSimulatorProps> = ({ onIngestSuccess }) => {
  const [from, setFrom] = useState('newtenant.kamau@gmail.com');
  const [to, setTo] = useState('payments@housika.co.ke');
  const [subject, setSubject] = useState('Water & Service Charge Payment Confirmation - Apt 4C');
  const [bodyText, setBodyText] = useState('Hi Accounts,\n\nAttached is my payment confirmation of KES 3,500 for water and service charge. Please verify and update my tenant portal.\n\nThank you,\nKamau');
  const [spfStatus, setSpfStatus] = useState<'pass' | 'fail'>('pass');
  const [dkimStatus, setDkimStatus] = useState<'pass' | 'fail'>('pass');
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setResult(null);

    try {
      const res = await fetch('/api/emails/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CF-Worker-Secret': 'cf_webhook_secret_key_housika_2026'
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          text: bodyText,
          spf: spfStatus,
          dkim: dkimStatus,
          headers: {
            'from-name': from.split('@')[0],
            'received-spf': spfStatus === 'pass' ? 'Pass (housika mail filter)' : 'Fail (spoofed)',
            'dkim-signature': dkimStatus === 'pass' ? 'v=1; a=rsa-sha256; ...' : undefined
          }
        })
      });

      const data = await res.json();
      setResult(data);
      if (data.success) {
        onIngestSuccess();
      }
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setIsSimulating(false);
    }
  };

  const workerCode = `// cloudflare-email-worker.ts (Wrangler ready)
export default {
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).text();
    
    // Ingest into Housika Hono Backend
    await fetch("https://api.housika.co.ke/api/emails/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CF-Worker-Secret": env.CF_EMAIL_WORKER_SECRET
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        headers: Object.fromEntries(message.headers.entries()),
        rawMime: rawEmail,
        spf: message.headers.get("received-spf") || "none",
        dkim: message.headers.get("dkim-signature") ? "pass" : "none"
      })
    });
  }
};`;

  const copyWorkerCode = () => {
    navigator.clipboard.writeText(workerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Cloud className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Cloudflare Email Routing Worker Simulator</h2>
        </div>
        <p className="text-xs text-slate-400">
          Simulate incoming emails caught by Cloudflare Email Routing on <code className="text-slate-300">housika.co.ke</code>, <code className="text-slate-300">housika.com</code>, and <code className="text-slate-300">housika.app</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Simulator Form */}
        <form onSubmit={handleSimulate} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            Dispatch Simulated Inbound Email
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Sender (From):</label>
            <input
              id="sim-from-input"
              type="email"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Destination Mailbox (To):</label>
            <div className="flex gap-2 mb-1.5">
              {['payments@housika.co.ke', 'help@housika.co.ke', 'ceo@housika.co.ke', 'collinsjuma@housika.co.ke'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTo(m)}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    to === m ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {m.split('@')[0]}
                </button>
              ))}
            </div>
            <input
              id="sim-to-input"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">SPF Result:</label>
              <select
                id="sim-spf-select"
                value={spfStatus}
                onChange={(e) => setSpfStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="pass">Pass (Authentic sender)</option>
                <option value="fail">Fail (Spoofed / Spam trigger)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">DKIM Result:</label>
              <select
                id="sim-dkim-select"
                value={dkimStatus}
                onChange={(e) => setDkimStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="pass">Pass (Valid crypto sign)</option>
                <option value="fail">Fail (Tampered / Invalid)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Subject:</label>
            <input
              id="sim-subject-input"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email Body:</label>
            <textarea
              id="sim-body-textarea"
              rows={4}
              required
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            id="simulate-ingest-btn"
            type="submit"
            disabled={isSimulating}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-orange-950"
          >
            <Send className="w-3.5 h-3.5" />
            {isSimulating ? 'Simulating Cloudflare Worker Intake...' : 'Trigger Cloudflare Inbound Event'}
          </button>

          {result && (
            <div className={`p-3 rounded-xl text-xs border ${
              result.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                {result.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
                {result.success ? 'Inbound Ingest Complete' : 'Ingest Failed'}
              </div>
              {result.meta && (
                <div className="text-[11px] space-y-0.5 mt-1 font-mono">
                  <div>Routed to Cosmos PK: <strong>{result.meta.routedToPartition}</strong></div>
                  <div>Status: <strong>{result.meta.status}</strong> (Spam Score: {result.meta.spamScore}%)</div>
                  <div>Cosmos Write RU: {result.meta.ruCharged} RU</div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Worker Script Snippet */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-orange-400" />
              Cloudflare Email Worker Script
            </h3>
            <button
              onClick={copyWorkerCode}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Paste this handler into your Cloudflare Worker linked to your domain in <strong>Cloudflare Dashboard &gt; Email Routing &gt; Email Workers</strong>.
          </p>
          <pre className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
            {workerCode}
          </pre>
        </div>

      </div>
    </div>
  );
};
