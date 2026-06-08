import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Activity, AlertTriangle, BarChart3, Wand2, Library, Mail, NotebookPen, Rocket, Trophy, Lightbulb } from 'lucide-react';
import { Sidebar, type SidebarItem } from './Sidebar';
import { Header } from './Header';
import { useAdmin } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';

const items: SidebarItem[] = [
  { to: '/', label: 'Insikter', icon: BarChart3 },
  { to: '/ai-analys', label: 'ELvis', icon: Wand2 },
  { to: '/mail', label: 'Elvira', icon: Mail },
  { to: '/kunskapsbas', label: 'Kunskapsbas', icon: Library },
  { to: '/granskning', label: 'Granskning', icon: AlertTriangle },
  { to: '/status', label: 'Systemstatus', icon: Activity, badge: 'NY' },
  { to: '/loggbok', label: 'Loggbok', icon: NotebookPen, badge: 'NY', adminOnly: true },
  { to: '/kunskapsbas-forslag', label: 'KB-förslag', icon: Lightbulb, badge: 'NY', adminOnly: true },
  { to: '/kretskampen', label: 'Kretskampen', icon: Trophy },
  { to: '/pa-gang', label: 'På gång', icon: Rocket, badge: 'NY' },
];

const STORAGE_KEY = 'elvis-sidebar-collapsed';
const HEADER_HEIGHT = 68;

export function Shell() {
  const { isAdmin } = useAdmin();
  const visibleItems = items.filter((item) => !item.adminOnly || isAdmin);
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
        items={visibleItems}
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
