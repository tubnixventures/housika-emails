import React, { useEffect, useState } from 'react';
import { Database, Server, HardDrive, ShieldCheck, Zap, Info, Layers, RefreshCw } from 'lucide-react';
import { CosmosPartitionStat } from '../types';

export const CosmosDiagnostics: React.FC = () => {
  const [partitions, setPartitions] = useState<CosmosPartitionStat[]>([]);
  const [r2Items, setR2Items] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDiagnostics = async () => {
    setIsLoading(true);
    try {
      const [cosmosRes, r2Res] = await Promise.all([
        fetch('/api/cosmos/stats').then(r => r.json()),
        fetch('/api/r2/items').then(r => r.json())
      ]);

      if (cosmosRes.partitions) {
        setPartitions(cosmosRes.partitions);
      }
      if (r2Res.items) {
        setR2Items(r2Res.items);
      }
    } catch (err) {
      console.error('Failed to load diagnostics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      
      {/* Overview & Quick Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Azure Cosmos DB & Cloudflare R2 Infrastructure
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Database: <strong className="text-slate-200">emails</strong> • Container: <strong className="text-slate-200">emails</strong> • Partition Key: <code className="text-emerald-400 font-mono">/pk</code>
          </p>
        </div>
        <button
          onClick={loadDiagnostics}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Partitions & R2 Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Active Partitions in emails container */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Active Logical Partitions ({partitions.length})
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Single-PK Enforced
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {partitions.map(p => (
              <div key={p.pk} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-mono text-slate-200 font-medium">{p.pk}</span>
                  <span className="text-[10px] text-slate-500">
                    ({p.pk.includes('@') ? 'Staff Mailbox' : 'Department Queue'})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">{p.count} messages</span>
                  {p.unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                      {p.unreadCount} unread
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cloudflare R2 Storage Explorer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              Cloudflare R2 Object Store ({r2Items.length} objects)
            </h3>
            <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              Zero Egress Fee
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {r2Items.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center">No objects in R2 store yet.</p>
            ) : (
              r2Items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                  <div className="truncate max-w-[240px]">
                    <div className="text-slate-200 font-mono truncate">{item.filename}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{item.key}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono text-slate-400">{(item.sizeBytes / 1024).toFixed(1)} KB</span>
                    <div className="text-[10px] text-slate-500">{item.contentType}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Official Cosmos DB GSI Guidelines & Cross-PK Avoidance Reference */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Cosmos DB GSI Guidelines: Eliminating Cross-Partition Queries</h3>
            <p className="text-xs text-slate-400">Why cross-partition queries ruin performance and how to keep Request Units below 3.0 RU.</p>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Query Pattern</th>
                <th className="p-3">Execution Mechanism</th>
                <th className="p-3">RU Cost</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr className="bg-emerald-950/20">
                <td className="p-3 font-medium text-emerald-300">Point Read (ID + PK)</td>
                <td className="p-3 font-mono text-[11px]">container.item(id, pk).read()</td>
                <td className="p-3 font-mono font-bold text-emerald-400">1.0 RU</td>
                <td className="p-3 text-emerald-400">Optimal (Used in /api/emails/get)</td>
              </tr>
              <tr className="bg-blue-950/20">
                <td className="p-3 font-medium text-blue-300">Single-Partition Query</td>
                <td className="p-3 font-mono text-[11px]">WHERE c.pk = @pk AND c.status = 'inbox'</td>
                <td className="p-3 font-mono font-bold text-blue-400">2.5 - 4.0 RU</td>
                <td className="p-3 text-blue-400">Optimal (Used in /api/emails/list)</td>
              </tr>
              <tr className="bg-rose-950/20">
                <td className="p-3 font-medium text-rose-300">Cross-Partition Fan-Out</td>
                <td className="p-3 font-mono text-[11px]">WHERE c.sender = @sender (No PK specified!)</td>
                <td className="p-3 font-mono font-bold text-rose-400">40 - 250+ RU</td>
                <td className="p-3 text-rose-400">Restricted to CEO (90) or Change Feed</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Change Feed Materialized View Pattern */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
            <Info className="w-4 h-4 text-blue-400" />
            The Cosmos DB "GSI" Equivalent: Change Feed Materialized Views
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            In AWS DynamoDB, developers create a GSI on <code>sender</code>. In Azure Cosmos DB, creating an index does <em>not</em> eliminate cross-partition query fan-out.
            To query by sender across millions of emails without paying cross-partition RU fees:
          </p>
          <ul className="text-xs text-slate-400 list-disc list-inside space-y-1 pl-2">
            <li>An Azure Function or Cloudflare Worker listens to the <strong className="text-slate-200">Cosmos DB Change Feed</strong> on container <code className="text-slate-300">emails</code>.</li>
            <li>It projects a lightweight copy into a secondary container: <code className="text-emerald-400">emails_by_sender</code> with Partition Key <code className="text-emerald-400">/sender</code>.</li>
            <li>Queries by sender now execute as a <strong>single-partition query (2.5 - 2.8 RU)</strong> instead of scanning every mailbox in the company!</li>
          </ul>
        </div>

        {/* Live Materialized Search & Rate Limiter Tester */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Live Materialized View & Session Revocation Verification
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Active Security Guard
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-1">Cosmos DB Automatic 30-Day TTL</div>
              <p className="text-[11px] text-slate-400">
                Spam and deleted emails in Trash automatically have <code className="text-emerald-300 font-mono">ttl = 2592000</code> attached, purging documents automatically at 0 RU cost.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="font-semibold text-purple-400 mb-1">Outbound Tier Rate Limiter</div>
              <p className="text-[11px] text-slate-400">
                Outbound throttling protects domain reputation: Level 75 (100/hr), Level 85 (250/hr), Level 90 CEO (1000/hr). Anonymous limited to 20/hr.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
