import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  ChartLineUp,
  Sparkle,
  EnvelopeSimple,
  Calculator,
  Trophy,
} from '@phosphor-icons/react';
import { Sidebar, type SidebarItem } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

const items: SidebarItem[] = [
  { to: '/', label: 'Insikter', icon: ChartLineUp, tone: 'brand' },
  { to: '/ai-analys', label: 'ELvis', icon: Sparkle, tone: 'violet' },
  { to: '/mail', label: 'Mail-assistent', icon: EnvelopeSimple, badge: 'NY', tone: 'emerald' },
  { to: '/kalkylator', label: 'Avgifts-kalkylator', icon: Calculator, badge: 'NY', tone: 'amber' },
  { to: '/kretskampen', label: 'Kretskampen', icon: Trophy, tone: 'rose' },
];

const STORAGE_KEY = 'elvis-sidebar-collapsed';

export function Shell() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div className="relative min-h-screen">
      <div className="app-backdrop" />

      <Sidebar
        items={items}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      <div
        className={cn(
          'min-h-screen flex flex-col transition-[margin] duration-300 ease-out',
          collapsed ? 'ml-[72px]' : 'ml-[240px]',
        )}
      >
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
