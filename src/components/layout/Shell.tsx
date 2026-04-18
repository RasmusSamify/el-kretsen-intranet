import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ArrowLeftRight, BarChart3, BrainCircuit, Calculator, Library, Mail, Trophy } from 'lucide-react';
import { Sidebar, type SidebarItem } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

const items: SidebarItem[] = [
  { to: '/', label: 'Insikter', icon: BarChart3 },
  { to: '/ai-analys', label: 'ELvis', icon: BrainCircuit },
  { to: '/mail', label: 'Mail-assistent', icon: Mail, badge: 'NY' },
  { to: '/kalkylator', label: 'Avgifts-kalkylator', icon: Calculator, badge: 'NY' },
  { to: '/kunskapsbas', label: 'Kunskapsbas', icon: Library, badge: 'NY' },
  { to: '/kretskampen', label: 'Kretskampen', icon: Trophy },
  { to: '/duellen', label: 'Avgifts-duellen', icon: ArrowLeftRight, badge: 'NY' },
];

const STORAGE_KEY = 'elvis-sidebar-collapsed';
const HEADER_HEIGHT = 68;

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

      {/* Top header — full width, above sidebar */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <Header />
      </div>

      {/* Sidebar — starts below header */}
      <Sidebar
        items={items}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        topOffset={HEADER_HEIGHT}
      />

      {/* Main content — pushed right by sidebar, down by header */}
      <div
        className={cn(
          'min-h-screen flex flex-col transition-[margin] duration-300 ease-out',
          collapsed ? 'ml-[72px]' : 'ml-[240px]',
        )}
        style={{ paddingTop: HEADER_HEIGHT }}
      >
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
