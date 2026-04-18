import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

const LOGO_URL =
  'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Logotyper/Untitled%20folder/logo_large.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJMb2dvdHlwZXIvVW50aXRsZWQgZm9sZGVyL2xvZ29fbGFyZ2UucG5nIiwiaWF0IjoxNzcyNjYwMDQ2LCJleHAiOjMzMzA4NjYwMDQ2fQ.C4CUV_phYLpJZrHCl1dYCO_X1X7b5fKiIli6IKTn4Ew';

export interface SidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface SidebarProps {
  items: SidebarItem[];
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ items, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 z-30 flex flex-col',
        'bg-white/85 backdrop-blur-xl border-r border-ink-100 shadow-[1px_0_0_rgba(15,23,42,0.03)]',
        'transition-[width] duration-300 ease-out',
        collapsed ? 'w-[72px]' : 'w-[240px]',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-5 border-b border-ink-100',
          collapsed && 'justify-center px-0',
        )}
      >
        <img src={LOGO_URL} alt="El-kretsen" className="h-8 w-auto shrink-0" />
        {!collapsed && (
          <div className="flex flex-col leading-none min-w-0 animate-fade-in">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-400">
              El-kretsen
            </span>
            <h1 className="text-display text-[20px] text-ink-900 mt-1">ELvis Hub</h1>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primär navigation">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold',
                'transition-all duration-200',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-[inset_2px_0_0_var(--brand-500)]'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  strokeWidth={2.25}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-brand-500' : 'text-ink-400 group-hover:text-ink-700',
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {badge && (
                      <Badge variant="brand" className="!text-[9px] !py-0.5 !px-1.5">
                        {badge}
                      </Badge>
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-ink-100">
        <button
          onClick={onToggle}
          className={cn(
            'w-full inline-flex items-center gap-2.5 px-3 py-2 rounded-xl',
            'text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-800',
            'hover:bg-ink-50 transition-colors',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expandera sidopanelen' : 'Minimera sidopanelen'}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} strokeWidth={2.25} />
          ) : (
            <>
              <PanelLeftClose size={15} strokeWidth={2.25} />
              <span>Minimera</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
