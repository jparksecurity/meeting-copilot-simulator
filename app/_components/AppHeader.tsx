'use client';

interface AppHeaderProps {
  breadcrumb?: string[];
  right?: React.ReactNode;
}

export function AppHeader({ breadcrumb, right }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white shrink-0 z-20">
      <div className="flex items-center gap-2">
        <h1 className="font-bold text-zinc-800 text-base">Meeting Copilot Simulator</h1>
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-zinc-400 ml-2">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <span>/</span>
                <span className={i === breadcrumb.length - 1 ? 'text-zinc-600 font-medium' : ''}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}
