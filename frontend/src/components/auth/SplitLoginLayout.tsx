import React from 'react';
import {
  Users,
  ClipboardList,
  FileText,
  MessageSquare,
  Sparkles,
  Lock,
  ShieldCheck,
  KeyRound,
  EyeOff,
} from 'lucide-react';

interface SplitLoginLayoutProps {
  brandBadge: string;
  children: React.ReactNode;
  portalHint?: React.ReactNode;
}

const FEATURES = [
  { icon: Users, title: 'Client Management', desc: '360° client profiles, contacts and history in one view.' },
  { icon: ClipboardList, title: 'Project & Task Tracking', desc: 'Deadlines, deliverables and progress, always on track.' },
  { icon: FileText, title: 'Billing & Invoices', desc: 'Accurate invoices, payments and billing status, simplified.' },
  { icon: MessageSquare, title: 'Team Communication', desc: 'Centralized discussions and client updates, together.' },
];

const CHART_BARS = [42, 64, 48, 78, 56, 90, 62, 96];

const DashboardPreview: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none select-none bg-white rounded-2xl border border-white/10 shadow-2xl shadow-[#15271E]/50 p-4 lg:p-5 max-w-xl"
  >
    <div className="flex items-center gap-1.5 mb-4">
      <span className="w-2.5 h-2.5 rounded-full bg-[#E8A317]/90" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#BFD6C3]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#5E8C61]" />
      <div className="ml-3 flex-1 h-5 rounded-md bg-[#F2F5F2] border border-[#E3E8E3] flex items-center px-2.5">
        <div className="w-24 h-1.5 rounded-full bg-[#C8D5CA]" />
      </div>
    </div>

    <div className="flex gap-4">
      <div className="hidden sm:flex flex-col gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#2F4F3A] mb-1" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`w-8 h-2 rounded ${i === 3 ? 'bg-[#5E8C61]' : 'bg-[#C8D5CA]'}`} />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="w-28 h-3 rounded bg-[#27332B] mb-1.5" />
            <div className="w-16 h-2 rounded bg-[#9FB0A3]" />
          </div>
          <div className="w-7 h-7 rounded-full bg-[#DCE9DE] flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#5E8C61]" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Clients', value: '128' },
            { label: 'Projects', value: '42' },
            { label: 'Revenue', value: '$86K' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-[#E3E8E3] bg-[#FAFBFA] p-2">
              <div className="w-8 h-1.5 rounded bg-[#C8D5CA] mb-1" />
              <div className="text-sm font-extrabold text-[#27332B] leading-none">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 rounded-lg border border-[#E3E8E3] p-3">
            <div className="w-14 h-2 rounded bg-[#C8D5CA] mb-3" />
            <div className="flex items-end gap-1.5 h-16">
              {CHART_BARS.map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t ${i === 5 ? 'bg-[#2F4F3A]' : 'bg-[#BFD6C3]'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          <div className="hidden sm:block w-32 rounded-lg border border-[#E3E8E3] p-3">
            <div className="w-16 h-2 rounded bg-[#C8D5CA] mb-3" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2 mb-2.5">
                <div className="w-2 h-2 rounded-full bg-[#5E8C61]" />
                <div className="flex-1">
                  <div className="w-full h-1.5 rounded bg-[#E0E8E1] mb-1" />
                  <div className="w-2/3 h-1.5 rounded bg-[#EEF2EE]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const SplitLoginLayout: React.FC<SplitLoginLayoutProps> = ({ brandBadge, children, portalHint }) => {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F7F9F6]">
      <aside className="lg:w-[55%] bg-[#2F4F3A] text-white relative overflow-hidden">
        <div aria-hidden="true" className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#3A5F47]/70 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-36 -left-24 w-96 h-96 rounded-full bg-[#1B2F23]/80 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-12 min-h-0 sm:min-h-[420px] lg:min-h-screen">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-[#2F4F3A]" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-extrabold tracking-tight">SUI GENERIS</p>
              <p className="text-[10px] font-semibold tracking-[0.3em] text-[#DCE9DE]">CONSULTING</p>
            </div>
            <span className="ml-auto hidden sm:inline-flex text-[10px] font-bold tracking-wider uppercase bg-white/10 border border-white/15 text-[#DCE9DE] px-3 py-1 rounded-full">
              {brandBadge}
            </span>
          </div>

          <div className="mt-10 lg:mt-16 max-w-xl">
            <h1 className="text-3xl lg:text-[40px] leading-tight font-extrabold tracking-tight">
              Smarter Relationships.
              <span className="block">Better <span className="text-[#DCE9DE]">Collaboration</span>.</span>
              <span className="block">Stronger Business.</span>
            </h1>
            <p className="mt-4 text-sm lg:text-base text-white/75 max-w-md leading-relaxed">
              One unified workspace to manage clients, projects, billing and team collaboration — everything your firm
              needs to run and grow with confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 lg:mt-12 max-w-2xl">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3 bg-white/[0.06] border border-white/10 rounded-xl p-4"
              >
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#DCE9DE]" />
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-snug">{title}</p>
                  <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 lg:mt-14 hidden md:block">
            <DashboardPreview />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-[440px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#E4EDE6] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[#2F4F3A]" />
            </div>
            <p className="text-sm font-bold text-[#27332B]">Secure. Reliable. Built for your business.</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E3E8E3] shadow-[0_8px_30px_rgba(47,79,58,0.08)] p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-[#27332B] tracking-tight">Welcome back 👋</h2>
              <p className="text-xs text-[#6B7280] mt-1">Sign in to your account to continue</p>
            </div>

            {children}

            {portalHint && (
              <div className="mt-6 pt-4 border-t border-[#E3E8E3] text-center">{portalHint}</div>
            )}
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold text-[#27332B] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#5E8C61]" />
              Your data is secure and encrypted
            </p>
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {[
                { icon: Lock, label: 'SSL Encrypted' },
                { icon: KeyRound, label: 'Data Protected' },
                { icon: EyeOff, label: 'Privacy Focused' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#6B7280] bg-white border border-[#E3E8E3] rounded-full px-3 py-1"
                >
                  <Icon className="w-3 h-3 text-[#5E8C61]" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
