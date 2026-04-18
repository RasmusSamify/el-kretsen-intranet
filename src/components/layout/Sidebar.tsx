import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CURRENT_VERSION } from '@/lib/version';
import { ChangelogModal } from './ChangelogModal';

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
  topOffset?: number;
}

export function Sidebar({ items, collapsed, onToggle, topOffset = 0 }: SidebarProps) {
  const [changelogOpen, setChangelogOpen] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 bottom-0 z-30 flex flex-col',
        'bg-white/85 backdrop-blur-xl border-r border-ink-100 shadow-[1px_0_0_rgba(15,23,42,0.03)]',
        'transition-[width] duration-300 ease-out',
        collapsed ? 'w-[72px]' : 'w-[240px]',
      )}
      style={{ top: topOffset }}
    >
      {/* Section label */}
      {!collapsed && (
        <div className="px-5 pt-6 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
            Navigation
          </span>
        </div>
      )}

      {/* Nav */}
      <nav
        className={cn(
          'flex-1 p-3 space-y-1.5 overflow-y-auto',
          collapsed && 'pt-5',
        )}
        aria-label="Primär navigation"
      >
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[14px] font-bold',
                'transition-all duration-200',
                collapsed && 'justify-center px-0 py-3',
                isActive
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2 : 1.75}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-ink-500 group-hover:text-ink-900',
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {badge && (
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'bg-ink-100 text-ink-500 group-hover:bg-white group-hover:text-ink-700',
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer — version + collapse toggle */}
      <div className="p-3 border-t border-ink-100 space-y-1.5">
        <button
          onClick={() => setChangelogOpen(true)}
          title={collapsed ? `v${CURRENT_VERSION} · visa uppdateringar` : undefined}
          className={cn(
            'w-full group inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl',
            'text-ink-500 hover:text-ink-900 hover:bg-ink-50 transition-colors',
            collapsed && 'justify-center px-0',
          )}
          aria-label={`ELvis Hub version ${CURRENT_VERSION} — visa changelog`}
        >
          <Sparkles size={14} strokeWidth={1.75} className="shrink-0 text-ink-400 group-hover:text-ink-700 transition-colors" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-wider">
                ELvis Hub
              </span>
              <span className="text-[11px] font-bold tabular-nums text-ink-400 group-hover:text-ink-700">
                v{CURRENT_VERSION}
              </span>
            </>
          )}
        </button>

        <button
          onClick={onToggle}
          className={cn(
            'w-full inline-flex items-center gap-2.5 px-3 py-2.5 rounded-xl',
            'text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-800',
            'hover:bg-ink-50 transition-colors',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expandera sidopanelen' : 'Minimera sidopanelen'}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} strokeWidth={1.75} />
          ) : (
            <>
              <PanelLeftClose size={16} strokeWidth={1.75} />
              <span>Minimera</span>
            </>
          )}
        </button>
      </div>

      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </aside>
  );
}
