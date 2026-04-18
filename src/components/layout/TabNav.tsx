import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export function TabNav({ tabs }: { tabs: Tab[] }) {
  return (
    <nav
      className="relative z-10 bg-white/70 backdrop-blur-xl border-b border-white/50 px-6 flex items-center gap-1 overflow-x-auto"
      role="tablist"
    >
      {tabs.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'group relative inline-flex items-center gap-2.5 px-4 py-4 text-[14px] font-bold whitespace-nowrap',
              'transition-colors duration-200',
              isActive ? 'text-brand-600' : 'text-ink-500 hover:text-ink-800',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={17}
                strokeWidth={2.25}
                className={cn('transition-colors', isActive ? 'text-brand-500' : 'text-ink-400 group-hover:text-ink-700')}
              />
              <span>{label}</span>
              {badge && (
                <Badge variant="brand" className="!py-0.5 !px-2 !text-[9px]">
                  {badge}
                </Badge>
              )}
              <span
                className={cn(
                  'absolute left-3 right-3 -bottom-px h-[2px] rounded-full transition-all duration-300',
                  isActive ? 'bg-brand-500' : 'bg-transparent group-hover:bg-ink-200',
                )}
                aria-hidden
              />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
