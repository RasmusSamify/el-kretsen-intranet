import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { SidebarSimple } from '@phosphor-icons/react';
import { Badge, FeatureIcon } from '@/components/ui';
import { cn } from '@/lib/utils';

type PhosphorIcon = ComponentType<{
  size?: number | string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
}>;

const LOGO_URL =
  'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Logotyper/Untitled%20folder/logo_large.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJMb2dvdHlwZXIvVW50aXRsZWQgZm9sZGVyL2xvZ29fbGFyZ2UucG5nIiwiaWF0IjoxNzcyNjYwMDQ2LCJleHAiOjMzMzA4NjYwMDQ2fQ.C4CUV_phYLpJZrHCl1dYCO_X1X7b5fKiIli6IKTn4Ew';

type SidebarTone = 'brand' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

export interface SidebarItem {
  to: string;
  label: string;
  icon: PhosphorIcon;
  badge?: string;
  tone?: SidebarTone;
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
          'flex items-center justify-center px-4 py-6 border-b border-ink-100',
        )}
      >
        <img
          src={LOGO_URL}
          alt="El-kretsen · ELvis Hub"
          className={cn(
            'w-auto shrink-0 transition-all duration-300',
            collapsed ? 'h-8' : 'h-10',
          )}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primär navigation">
        {items.map(({ to, label, icon: Icon, badge, tone = 'brand' }) => (
          <NavLink
            key={to}
            to={to}
            end
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-bold',
                'transition-all duration-200',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-white text-ink-900 shadow-card ring-1 ring-ink-100'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <FeatureIcon
                    icon={<Icon weight="duotone" />}
                    tone={tone}
                    size="sm"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0 bg-ink-100/70 text-ink-500 group-hover:bg-ink-200/70 group-hover:text-ink-700 transition-colors">
                    <Icon weight="duotone" size={18} />
                  </span>
                )}
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
          <SidebarSimple size={16} weight="duotone" className={cn('transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Minimera</span>}
        </button>
      </div>
    </aside>
  );
}
