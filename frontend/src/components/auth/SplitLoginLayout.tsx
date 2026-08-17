import React from 'react';

interface SplitLoginLayoutProps {
  brandBadge: string;
  children: React.ReactNode;
  portalHint?: React.ReactNode;
}

/* ── Inline SVG icons (no lucide dependency for layout) ── */
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconMsg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconShieldSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const FEATURES = [
  { Icon: IconUsers,    title: 'Client Management',      desc: 'Organize client data and track every interaction in one place.' },
  { Icon: IconClipboard,title: 'Project & Task Tracking', desc: 'Plan, assign and monitor tasks to keep your projects on track.' },
  { Icon: IconFile,     title: 'Billing & Invoices',      desc: 'Create, send and track invoices with real-time payment status.' },
  { Icon: IconMsg,      title: 'Team Communication',      desc: 'Collaborate with your team and clients seamlessly.' },
];

/* ── Floating dashboard mockup ── */
const DashboardMockup: React.FC = () => (
  <div style={{
    position: 'absolute',
    right: '-100px',
    top: '50%',
    transform: 'translateY(-50%) perspective(900px) rotateY(-12deg) rotateX(3deg)',
    transformOrigin: 'left center',
    width: '360px',
    zIndex: 5,
    filter: 'drop-shadow(0 28px 40px rgba(15,40,25,.22))',
  }} aria-hidden="true">
    <div style={{
      background: '#fff',
      border: '1px solid #dde6de',
      borderRadius: '20px',
      overflow: 'hidden',
      fontSize: '11px',
    }}>
      {/* topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 18px', borderBottom:'1px solid #e4e8e6', background:'#fff' }}>
        <div style={{ width:'34px', height:'34px', border:'2px solid #1c6b3a', borderRadius:'8px', background:'#f2f8f4', fontFamily:'Georgia,serif', fontWeight:700, fontSize:'18px', color:'#1c6b3a', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>S</div>
        <span style={{ fontWeight:800, fontSize:'16px', color:'#12181a', letterSpacing:'-0.3px' }}>Dashboard</span>
      </div>
      {/* body */}
      <div style={{ display:'flex', height:'500px' }}>
        {/* sidebar */}
        <nav style={{ width:'90px', borderRight:'1px solid #e4e8e6', padding:'10px 0', display:'flex', flexDirection:'column', gap:0, background:'#fff' }}>
          {[
            { label:'Dashboard', active:true,  icon:<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
            { label:'Clients',   active:false, icon:<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
            { label:'Projects',  active:false, icon:<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
            { label:'Tasks',     active:false, icon:<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg> },
            { label:'Invoices',  active:false, icon:<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
            { label:'Documents', active:false, icon:<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
            { label:'Messages',  active:false, icon:<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
          ].map(({ label, active, icon }) => (
            <div key={label} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
              padding:'9px 5px', fontSize:'10px', lineHeight:1.3, textAlign:'center',
              borderRadius:'8px', margin:'0 5px', cursor:'pointer',
              color: active ? '#1c6b3a' : '#9aa4a6',
              background: active ? '#f2f8f4' : 'transparent',
              fontWeight: active ? 700 : 400,
            }}>
              {icon}{label}
            </div>
          ))}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
            padding:'9px 5px', fontSize:'10px', lineHeight:1.3, textAlign:'center',
            borderRadius:'8px', margin:'auto 5px 0', cursor:'pointer', color:'#9aa4a6',
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Settings
          </div>
        </nav>
        {/* main */}
        <div style={{ flex:1, padding:'14px 14px 10px', display:'flex', flexDirection:'column', gap:'12px', overflow:'hidden', background:'#fff' }}>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {[{ lbl:'Total Clients', val:'248', pct:'+12%' },{ lbl:'Total Projects', val:'36', pct:'+8%' }].map(k => (
              <div key={k.lbl} style={{ background:'#f7fbf8', border:'1px solid #e4ede6', borderRadius:'12px', padding:'11px 13px' }}>
                <div style={{ fontSize:'10px', color:'#9aa4a6', marginBottom:'5px', fontWeight:500 }}>{k.lbl}</div>
                <div style={{ fontSize:'26px', fontWeight:800, color:'#12181a', display:'flex', alignItems:'center', gap:'6px', lineHeight:1 }}>
                  {k.val}
                  <span style={{ fontSize:'9px', fontWeight:700, background:'#e8f5e9', color:'#2e7d32', padding:'3px 6px', borderRadius:'10px' }}>{k.pct}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Chart */}
          <div style={{ background:'#fff', border:'1px solid #e4e8e6', borderRadius:'12px', padding:'11px 12px 9px' }}>
            <div style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'10px', color:'#9aa4a6', fontWeight:500 }}>Revenue Overview</div>
              <div style={{ fontSize:'18px', fontWeight:800, color:'#12181a', display:'flex', alignItems:'center', gap:'7px' }}>
                ₹ 24,50,000
                <span style={{ fontSize:'9px', fontWeight:700, background:'#e8f5e9', color:'#2e7d32', padding:'3px 6px', borderRadius:'10px' }}>+15%</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', fontSize:'8px', color:'#ccc', paddingBottom:'16px', minWidth:'22px', textAlign:'right' }}>
                <span>30L</span><span>20L</span><span>10L</span><span>0</span>
              </div>
              <div style={{ flex:1 }}>
                <svg viewBox="0 0 210 75" preserveAspectRatio="none" width="100%" height="75">
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4caf50" stopOpacity="0.28"/>
                      <stop offset="100%" stopColor="#4caf50" stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  {[1,26,51,75].map(y => <line key={y} x1="0" y1={y} x2="210" y2={y} stroke="#f0f0f0" strokeWidth="0.8"/>)}
                  <path d="M0,68 C35,62 55,54 85,46 S130,33 160,22 S190,10 210,5 L210,75 L0,75 Z" fill="url(#grad)"/>
                  <path d="M0,68 C35,62 55,54 85,46 S130,33 160,22 S190,10 210,5" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                  <circle cx="210" cy="5" r="3" fill="#4caf50"/>
                </svg>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'8px', color:'#bbb', marginTop:'4px', padding:'0 2px' }}>
                  {['Jan','Feb','Mar','Apr','May'].map(m => <span key={m}>{m}</span>)}
                </div>
              </div>
            </div>
          </div>
          {/* Activity */}
          <div>
            <div style={{ fontSize:'12px', fontWeight:800, color:'#12181a', marginBottom:'10px' }}>Recent Activities</div>
            {[
              { name:'New client onboarded',              time:'2 min ago' },
              { name:'Invoice #INV-2456 paid',            time:'1 hour ago' },
              { name:'Project "Website Redesign" updated',time:'3 hours ago' },
            ].map(a => (
              <div key={a.name} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                <div style={{ width:'30px', height:'30px', minWidth:'30px', borderRadius:'50%', background:'#1c6b3a', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="#fff" fill="none" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:'11px', fontWeight:600, color:'#12181a' }}>{a.name}</div>
                  <div style={{ fontSize:'9.5px', color:'#9aa4a6' }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ── Plant SVG ── */
const Plant: React.FC = () => (
  <svg
    aria-hidden="true"
    style={{ position:'absolute', bottom:0, left:0, width:'150px', pointerEvents:'none', zIndex:0 }}
    viewBox="0 0 140 200" fill="none"
  >
    <path d="M44 165 L50 195 Q70 202 90 195 L96 165 Z" fill="#ddd0b8"/>
    <rect x="38" y="158" width="64" height="12" rx="4" fill="#c9b898"/>
    <ellipse cx="70" cy="159" rx="32" ry="6" fill="#b8a075"/>
    <line x1="70" y1="158" x2="70" y2="95" stroke="#3a7a30" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M70 140 Q28 120 18 82 Q55 96 70 132 Z" fill="#2d6b25"/>
    <path d="M70 132 Q112 108 118 68 Q82 86 70 124 Z" fill="#3a7a30"/>
    <path d="M70 118 Q32 105 24 72 Q58 88 70 112 Z" fill="#3a7a30"/>
    <path d="M70 110 Q108 96 112 62 Q78 80 70 104 Z" fill="#2d6b25"/>
    <path d="M70 98 Q44 76 46 44 Q66 66 70 94 Z" fill="#234f1e"/>
    <path d="M70 95 Q96 72 92 40 Q72 64 70 90 Z" fill="#2d6b25"/>
  </svg>
);

export const SplitLoginLayout: React.FC<SplitLoginLayoutProps> = ({ brandBadge: _badge, children, portalHint }) => {
  return (
    <>
      <style>{`
        .split-login-grid {
          display: grid;
          grid-template-columns: 58% 42%;
          min-height: 100vh;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        }
        .split-login-left {
          position: relative;
          background: #f4f7f5;
          padding: 52px 60px 0 60px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          overflow: hidden;
        }
        .split-login-left-brand { display: flex; align-items: center; gap: 14px; }
        .split-login-left-brand-text span:first-child {
          display: block; font-family: 'Playfair Display', Georgia, serif;
          font-weight: 700; font-size: 20px; letter-spacing: 3px; color: #12181a; line-height: 1.1;
        }
        .split-login-left-brand-text span:last-child {
          display: block; font-size: 10px; letter-spacing: 4px; color: #6b7678;
          border-top: 1px solid #9aa4a6; padding-top: 4px; margin-top: 4px; font-weight: 500;
        }
        .split-login-left-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: #f2f8f4; border: 1px solid #e7f3ec; color: #14532d;
          font-size: 10.5px; font-weight: 700; letter-spacing: 1.4px;
          padding: 6px 13px; border-radius: 20px; width: fit-content;
        }
        .split-login-left-headline {
          font-weight: 800; font-size: clamp(26px, 2.6vw, 36px); line-height: 1.22;
          letter-spacing: -0.8px; color: #12181a; max-width: 440px; margin: 0;
        }
        .split-login-left-lede {
          font-size: 13.5px; line-height: 1.68; color: #6b7678; max-width: 400px; margin: 0;
        }
        .split-login-left-lede br { display: none; }
        .split-login-right {
          background: #ffffff; border-left: 1px solid #e4e8e6;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 56px 52px;
        }
        .split-login-right-inner { width: 100%; max-width: 380px; }
        .split-login-mobile-brand {
          display: none; align-items: center; justify-content: center; gap: 10px;
          padding: 20px 20px 0; text-align: center;
        }
        .split-login-mobile-brand svg { flex-shrink: 0; }
        .split-login-mobile-brand-text span:first-child {
          display: block; font-family: 'Playfair Display', Georgia, serif;
          font-weight: 700; font-size: 16px; letter-spacing: 2px; color: #12181a; line-height: 1.1;
        }
        .split-login-mobile-brand-text span:last-child {
          display: block; font-size: 9px; letter-spacing: 3px; color: #6b7678;
          border-top: 1px solid #9aa4a6; padding-top: 3px; margin-top: 3px; font-weight: 500;
        }
        .split-login-mobile-badge {
          display: none; align-items: center; gap: 6px; justify-content: center;
          background: #f2f8f4; border: 1px solid #e7f3ec; color: #14532d;
          font-size: 9.5px; font-weight: 700; letter-spacing: 1.2px;
          padding: 5px 11px; border-radius: 20px; margin: 10px auto 0; width: fit-content;
        }

        /* ── Mobile hero section (hidden on desktop) ── */
        .split-login-mobile-hero { display: none; }
        .split-login-mobile-hero-headline {
          font-weight: 800; font-size: 22px; line-height: 1.25; letter-spacing: -0.5px;
          color: #12181a; text-align: center; margin: 16px 0 4px;
        }
        .split-login-mobile-hero-headline span { color: #1c6b3a; }
        .split-login-mobile-hero-lede {
          font-size: 12.5px; line-height: 1.55; color: #6b7678;
          text-align: center; margin: 0 0 18px; padding: 0 8px;
        }
        .split-login-mobile-features {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px;
        }
        .split-login-mobile-feature-card {
          background: #fff; border: 1px solid #e4e8e6; border-radius: 10px;
          padding: 12px 10px; text-align: center; display: flex; flex-direction: column;
          align-items: center; gap: 7px;
        }
        .split-login-mobile-feature-icon {
          width: 34px; height: 34px; min-width: 34px; border-radius: 8px;
          background: #e7f3ec; display: flex; align-items: center; justify-content: center;
          color: #14532d;
        }
        .split-login-mobile-feature-title {
          font-size: 11px; font-weight: 700; color: #12181a; line-height: 1.2;
        }
        .split-login-mobile-stats {
          display: flex; justify-content: center; gap: 20px; margin-bottom: 20px;
          padding: 12px 0; border-top: 1px solid #e4e8e6; border-bottom: 1px solid #e4e8e6;
        }
        .split-login-mobile-stat { text-align: center; }
        .split-login-mobile-stat-val {
          font-size: 20px; font-weight: 800; color: #1c6b3a; line-height: 1;
        }
        .split-login-mobile-stat-label {
          font-size: 10px; color: #6b7678; font-weight: 500; margin-top: 3px;
        }
        .split-login-mobile-chart {
          margin-bottom: 20px; background: #f7fbf8; border: 1px solid #e4ede6;
          border-radius: 10px; padding: 12px 14px;
        }
        .split-login-mobile-chart-header {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
        }
        .split-login-mobile-chart-label { font-size: 10px; color: #9aa4a6; font-weight: 500; }
        .split-login-mobile-chart-value {
          font-size: 16px; font-weight: 800; color: #12181a; display: flex; align-items: center; gap: 6px;
        }
        .split-login-mobile-chart-value span {
          font-size: 9px; font-weight: 700; background: #e8f5e9; color: #2e7d32;
          padding: 2px 6px; border-radius: 10px;
        }
        .split-login-mobile-activity { margin-bottom: 16px; }
        .split-login-mobile-activity-title {
          font-size: 11px; font-weight: 700; color: #12181a; margin-bottom: 8px;
        }
        .split-login-mobile-activity-item {
          display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
        }
        .split-login-mobile-activity-dot {
          width: 26px; height: 26px; min-width: 26px; border-radius: 50%;
          background: #1c6b3a; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .split-login-mobile-activity-name { font-size: 11px; font-weight: 600; color: #12181a; }
        .split-login-mobile-activity-time { font-size: 9.5px; color: #9aa4a6; }

        @media (max-width: 768px) {
          .split-login-grid {
            grid-template-columns: 1fr !important;
          }
          .split-login-left {
            display: none !important;
          }
          .split-login-right {
            border-left: none !important;
            padding: 0 20px 24px !important;
            justify-content: flex-start !important;
          }
          .split-login-mobile-brand {
            display: flex !important;
          }
          .split-login-mobile-badge {
            display: flex !important;
          }
          .split-login-mobile-hero {
            display: block !important;
          }
          .split-login-right-inner {
            max-width: 100% !important;
          }
          .split-login-right .split-login-shield {
            display: none !important;
          }
          .split-login-right .split-login-form-card {
            padding: 24px 18px !important;
            border-radius: 14px !important;
            box-shadow: 0 8px 30px rgba(15,40,25,.06) !important;
          }
          .split-login-right .split-login-form-card h2 {
            font-size: 20px !important;
          }
          .split-login-right .split-login-trust-badges {
            gap: 14px !important;
          }
          .split-login-right .split-login-trust-badge-item {
            font-size: 10px !important;
          }
          .split-login-right .split-login-secure-line {
            margin: 16px 0 12px !important;
            font-size: 11px !important;
          }
        }

        @media (max-width: 380px) {
          .split-login-right {
            padding: 16px 14px !important;
          }
          .split-login-right .split-login-form-card {
            padding: 22px 16px !important;
          }
          .split-login-right .split-login-trust-badges {
            gap: 10px !important;
          }
        }
      `}</style>

      <div className="split-login-grid">

        {/* ══ LEFT PANEL ══ */}
        <div className="split-login-left">
          {/* Dotted grid decoration */}
          <div aria-hidden="true" style={{
            position:'absolute', top:'36px', left:'54%',
            width:'140px', height:'140px',
            backgroundImage:'radial-gradient(#9aa4a6 1px, transparent 1.5px)',
            backgroundSize:'13px 13px',
            opacity:0.28, pointerEvents:'none',
          }}/>

          {/* Brand */}
          <div className="split-login-left-brand">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M32 10C25 8 16 10 16 17C16 23 24 24.5 24 24.5C24 24.5 32 26 32 32C32 39 22 40 15 38" stroke="#12181a" strokeWidth="3" strokeLinecap="round"/>
              <path d="M16 38C23 40.5 32 38 32 31C32 25 24 23.5 24 23.5C24 23.5 16 22 16 16C16 9 26 8 33 10" stroke="#1c6b3a" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <div className="split-login-left-brand-text">
              <span>SUI GENERIS</span>
              <span>— CONSULTING —</span>
            </div>
          </div>

          {/* CRM Badge */}
          <div className="split-login-left-badge">
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#4caf50', flexShrink:0 }}/>
            CRM SYSTEM
          </div>

          {/* Headline */}
          <h1 className="split-login-left-headline">
            Smarter Relationships.<br/>
            Better <span style={{ color:'#1c6b3a' }}>Collaboration</span>.<br/>
            Stronger Business.
          </h1>

          {/* Lede */}
          <p className="split-login-left-lede">
            Your all-in-one CRM to manage clients, projects, tasks,<br/>
            billing and communication — designed to help you<br/>
            work smarter and grow faster.
          </p>

          {/* Feature cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxWidth:'420px', zIndex:2 }}>
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} style={{
                display:'flex', alignItems:'center', gap:'14px',
                background:'#ffffff', border:'1px solid #e4e8e6',
                borderRadius:'12px', padding:'14px 16px', cursor:'pointer',
                transition:'transform .15s, box-shadow .2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateX(4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 18px rgba(20,83,45,.09)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=''; (e.currentTarget as HTMLDivElement).style.boxShadow=''; }}
              >
                <div style={{ width:'38px', height:'38px', minWidth:'38px', borderRadius:'9px', background:'#e7f3ec', display:'flex', alignItems:'center', justifyContent:'center', color:'#14532d' }}>
                  <Icon />
                </div>
                <div style={{ flex:1 }}>
                  <h3 style={{ fontSize:'13.5px', fontWeight:700, color:'#12181a', margin:'0 0 2px 0' }}>{title}</h3>
                  <p style={{ fontSize:'12px', color:'#6b7678', lineHeight:1.45, margin:0 }}>{desc}</p>
                </div>
                <span style={{ color:'#9aa4a6', fontSize:'20px', lineHeight:1, flexShrink:0 }}>›</span>
              </div>
            ))}
          </div>

          {/* Floating dashboard mockup */}
          <DashboardMockup />

          {/* Plant */}
          <Plant />
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div className="split-login-right">
          {/* Mobile-only compact brand */}
          <div className="split-login-mobile-brand">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <path d="M32 10C25 8 16 10 16 17C16 23 24 24.5 24 24.5C24 24.5 32 26 32 32C32 39 22 40 15 38" stroke="#12181a" strokeWidth="3" strokeLinecap="round"/>
              <path d="M16 38C23 40.5 32 38 32 31C32 25 24 23.5 24 23.5C24 23.5 16 22 16 16C16 9 26 8 33 10" stroke="#1c6b3a" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <div className="split-login-mobile-brand-text">
              <span>SUI GENERIS</span>
              <span>— CONSULTING —</span>
            </div>
          </div>
          <div className="split-login-mobile-badge">
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#4caf50', flexShrink:0 }}/>
            CRM SYSTEM
          </div>

          {/* ══ Mobile-only hero section ══ */}
          <div className="split-login-mobile-hero">
            <h1 className="split-login-mobile-hero-headline">
              Smarter Relationships.<br/>
              Better <span>Collaboration</span>.<br/>
              Stronger Business.
            </h1>
            <p className="split-login-mobile-hero-lede">
              Your all-in-one CRM to manage clients, projects, tasks, billing and communication — designed to help you work smarter and grow faster.
            </p>

            {/* Feature cards 2×2 grid */}
            <div className="split-login-mobile-features">
              {FEATURES.map(({ Icon, title }) => (
                <div key={title} className="split-login-mobile-feature-card">
                  <div className="split-login-mobile-feature-icon">
                    <Icon />
                  </div>
                  <div className="split-login-mobile-feature-title">{title}</div>
                </div>
              ))}
            </div>

            {/* Stats bar */}
            <div className="split-login-mobile-stats">
              <div className="split-login-mobile-stat">
                <div className="split-login-mobile-stat-val">248+</div>
                <div className="split-login-mobile-stat-label">Clients</div>
              </div>
              <div className="split-login-mobile-stat">
                <div className="split-login-mobile-stat-val">36+</div>
                <div className="split-login-mobile-stat-label">Projects</div>
              </div>
              <div className="split-login-mobile-stat">
                <div className="split-login-mobile-stat-val">98%</div>
                <div className="split-login-mobile-stat-label">Satisfaction</div>
              </div>
              <div className="split-login-mobile-stat">
                <div className="split-login-mobile-stat-val">24/7</div>
                <div className="split-login-mobile-stat-label">Support</div>
              </div>
            </div>

            {/* Mini revenue chart */}
            <div className="split-login-mobile-chart">
              <div className="split-login-mobile-chart-header">
                <div>
                  <div className="split-login-mobile-chart-label">Revenue Overview</div>
                  <div className="split-login-mobile-chart-value">
                    ₹ 24,50,000 <span>+15%</span>
                  </div>
                </div>
              </div>
              <svg viewBox="0 0 280 55" preserveAspectRatio="none" width="100%" height="55" style={{ display:'block' }}>
                <defs>
                  <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4caf50" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#4caf50" stopOpacity="0.02"/>
                  </linearGradient>
                </defs>
                {[1,16,31,46].map(y => <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="#f0f0f0" strokeWidth="0.7"/>)}
                <path d="M0,48 C40,42 65,36 100,28 S155,18 200,12 S245,5 280,2 L280,55 L0,55 Z" fill="url(#mobileGrad)"/>
                <path d="M0,48 C40,42 65,36 100,28 S155,18 200,12 S245,5 280,2" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                <circle cx="280" cy="2" r="3" fill="#4caf50"/>
              </svg>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'8px', color:'#bbb', marginTop:'4px' }}>
                {['Jan','Feb','Mar','Apr','May','Jun'].map(m => <span key={m}>{m}</span>)}
              </div>
            </div>

            {/* Recent activity */}
            <div className="split-login-mobile-activity">
              <div className="split-login-mobile-activity-title">Recent Activities</div>
              {[
                { name:'New client onboarded', time:'2 min ago' },
                { name:'Invoice #INV-2456 paid', time:'1 hour ago' },
                { name:'Project "Website Redesign" updated', time:'3 hours ago' },
              ].map(a => (
                <div key={a.name} className="split-login-mobile-activity-item">
                  <div className="split-login-mobile-activity-dot">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="#fff" fill="none" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div>
                    <div className="split-login-mobile-activity-name">{a.name}</div>
                    <div className="split-login-mobile-activity-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="split-login-right-inner">

            {/* Shield */}
            <div className="split-login-shield" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', marginBottom:'28px' }}>
              <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'#f2f8f4', display:'flex', alignItems:'center', justifyContent:'center', color:'#1c6b3a' }}>
                <IconShield />
              </div>
              <p style={{ fontSize:'12.5px', color:'#6b7678', fontWeight:500, textAlign:'center', margin:0 }}>
                Secure. Reliable. Built for your business.
              </p>
            </div>

            {/* Form card */}
            <div className="split-login-form-card" style={{
              background:'#ffffff',
              border:'1px solid #e4e8e6',
              borderRadius:'16px',
              boxShadow:'0 20px 56px rgba(15,40,25,.07)',
              padding:'36px 32px',
            }}>
              <h2 style={{ fontSize:'24px', fontWeight:800, letterSpacing:'-0.4px', color:'#12181a', marginBottom:'5px', display:'flex', alignItems:'center', gap:'8px' }}>
                Welcome back <span>👋</span>
              </h2>
              <p style={{ fontSize:'13px', color:'#6b7678', marginBottom:'26px', marginTop:0 }}>Sign in to your account to continue</p>

              {children}

              {portalHint && (
                <div style={{ marginTop:'24px', paddingTop:'16px', borderTop:'1px solid #e4e8e6', textAlign:'center' }}>
                  {portalHint}
                </div>
              )}
            </div>

            {/* Secure line */}
            <div className="split-login-secure-line" style={{ display:'flex', alignItems:'center', gap:'8px', margin:'24px 0 16px', fontSize:'12px', color:'#6b7678' }}>
              <span style={{ flex:1, height:'1px', background:'#e4e8e6', display:'block' }}/>
              <span style={{ display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap' }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign:'middle' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Your data is secure and encrypted
              </span>
              <span style={{ flex:1, height:'1px', background:'#e4e8e6', display:'block' }}/>
            </div>

            {/* Trust badges */}
            <div className="split-login-trust-badges" style={{ display:'flex', justifyContent:'center', gap:'24px', flexWrap:'wrap' }}>
              {[
                { Icon: IconLock,     label: 'SSL Encrypted' },
                { Icon: IconShieldSm, label: 'Data Protected' },
                { Icon: IconEye,      label: 'Privacy Focused' },
              ].map(({ Icon, label }) => (
                <div key={label} className="split-login-trust-badge-item" style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11.5px', color:'#6b7678', fontWeight:500 }}>
                  <span style={{ width:'20px', height:'20px', borderRadius:'50%', background:'#f2f8f4', display:'flex', alignItems:'center', justifyContent:'center', color:'#1c6b3a' }}>
                    <Icon />
                  </span>
                  {label}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </>
  );
};
