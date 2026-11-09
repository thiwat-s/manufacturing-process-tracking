'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, ClipboardList, Factory, Gauge, Layers3, Menu, X } from 'lucide-react';
import { useState } from 'react';
const links = [
  { href: '/', label: 'Dashboard', Icon: Gauge },
  { href: '/production', label: 'Production Board', Icon: Layers3 },
  { href: '/orders', label: 'Orders', Icon: ClipboardList },
  { href: '/resources', label: 'Resources', Icon: Boxes },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="shell">
      <aside className="sidebar" data-mobile-open={mobileOpen}>
        <div className="brand">
          <span className="brandmark">
            <Factory size={17} />
          </span>{' '}
          Forge Operations
          <button
            className="nav-toggle"
            type="button"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav id="workspace-navigation" className="navitems" aria-label="Workspace">
          <div className="navlabel">Workspace</div>
          {links.map(({ href, label, Icon }) => (
            <Link
              key={href}
              className={`navlink ${path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}`}
              href={href}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div
          style={{
            marginTop: 'auto',
            borderTop: '1px solid #394757',
            padding: '16px 10px 0',
            color: '#9aa5b1',
            fontSize: 10,
            lineHeight: 1.7,
          }}
        >
          MANUFACTURING OPERATIONS
          <br />
          Prototype workspace
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            Operations workspace&nbsp; / &nbsp;
            <b style={{ color: '#344454' }}>Demo environment</b>
          </span>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
