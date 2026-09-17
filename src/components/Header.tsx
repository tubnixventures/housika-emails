import React from 'react';
import { UserSession } from '../types';
import { ShieldCheck, User, Key, Globe, ShieldAlert, Cpu } from 'lucide-react';

interface HeaderProps {
  currentUser: UserSession | null;
  authToken: string;
  authMethod: 'cookie' | 'header';
  selectedDomain: string;
  onSelectRole: (roleKey: string) => void;
  onToggleAuthMethod: (method: 'cookie' | 'header') => void;
  onSelectDomain: (domain: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  authToken,
  authMethod,
  selectedDomain,
  onSelectRole,
  onToggleAuthMethod,
  onSelectDomain,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Brand & Stack Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">Housika Email Backend</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Hono + R2 + Cosmos
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cloudflare Email Routing • Azure Cosmos DB (PK: /pk) • Strict Level 70–100 RBAC
              </p>
            </div>
          </div>

          {/* Controls: Domain, Auth Switcher & Presets */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            
            {/* Domain Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <select
                id="domain-select"
                value={selectedDomain}
                onChange={(e) => onSelectDomain(e.target.value)}
                className="bg-transparent border-none text-slate-200 text-xs focus:ring-0 focus:outline-none cursor-pointer"
              >
                <option value="housika.co.ke" className="bg-slate-900">housika.co.ke (Primary)</option>
                <option value="housika.com" className="bg-slate-900">housika.com (Global)</option>
                <option value="housika.app" className="bg-slate-900">housika.app (Mobile API)</option>
              </select>
            </div>

            {/* Auth Method Toggle */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-lg p-0.5 text-xs">
              <button
                id="auth-method-cookie"
                onClick={() => onToggleAuthMethod('cookie')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  authMethod === 'cookie'
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Web browser client: JWT sent via HttpOnly cookie"
              >
                Cookie
              </button>
              <button
                id="auth-method-header"
                onClick={() => onToggleAuthMethod('header')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  authMethod === 'header'
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="API / Worker / Mobile client: Authorization: Bearer <token>"
              >
                Bearer Header
              </button>
            </div>

            {/* Preset Roles */}
            <div className="flex items-center gap-1">
              <button
                id="role-company-btn"
                onClick={() => onSelectRole('company')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  currentUser?.role === 'company'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
                title="Company (Level 100): Corporate broadcast identity company@housika.co.ke"
              >
                🏢 Company (100)
              </button>
              <button
                id="role-ceo-btn"
                onClick={() => onSelectRole('ceo')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  currentUser?.role === 'ceo'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
                title="CEO (Level 90): Can choose ceo@housika.co.ke or personal name address"
              >
                👑 CEO (90)
              </button>
              <button
                id="role-mgr-btn"
                onClick={() => onSelectRole('manager')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  currentUser?.role === 'manager'
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
                title="Collins Juma (Level 85): Manager access to department & subordinates"
              >
                💼 Manager (85)
              </button>
              <button
                id="role-agent-btn"
                onClick={() => onSelectRole('customercare')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  currentUser?.role === 'customercare'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
                title="Movin Juma (Level 75): Customer care agent with attribution"
              >
                🎧 Agent (75)
              </button>
              <button
                id="role-unauth-btn"
                onClick={() => onSelectRole('unauthorized')}
                className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                  currentUser?.level && currentUser.level < 70
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-rose-400 hover:border-rose-900'
                }`}
                title="Level 50: Security test (Level < 70 strictly forbidden!)"
              >
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Test &lt;70
                </span>
              </button>
            </div>

          </div>
        </div>

        {/* Active Session Info Pill */}
        {currentUser && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                {currentUser.name}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-mono">{currentUser.email}</span>
              <span className="text-slate-500">•</span>
              <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                currentUser.level >= 100
                  ? 'bg-amber-500/20 text-amber-300'
                  : currentUser.level >= 80
                  ? 'bg-purple-500/20 text-purple-300'
                  : currentUser.level >= 70
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                Level {currentUser.level} ({currentUser.role.toUpperCase()})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                Assigned Queues: <strong className="text-slate-200">{(currentUser.assignedMailboxes || []).join(', ') || 'None'}</strong>
              </span>
              <span className="text-slate-500">|</span>
              <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
                <Key className="w-3 h-3 text-emerald-400" />
                Token: {authToken ? `${authToken.slice(0, 14)}...` : 'None'}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
