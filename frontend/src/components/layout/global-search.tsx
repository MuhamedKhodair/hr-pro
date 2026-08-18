'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Building2, CalendarClock, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';

interface EmployeeHit {
  id: string;
  name: string;
  email: string;
  position: string;
  status: string;
  department: { name: string } | null;
}

interface DepartmentHit {
  id: string;
  name: string;
  _count: { employees: number };
}

interface LeaveHit {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  employee: { id: string; name: string };
}

interface SearchResults {
  employees: EmployeeHit[];
  departments: DepartmentHit[];
  leaves: LeaveHit[];
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get<SearchResults>(`/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data ?? null);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-muted sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="rounded border border-border bg-muted px-1 text-[10px] font-mono">Ctrl K</kbd>
      </button>
      <button onClick={() => setOpen(true)} className="flex h-8 w-8 items-center justify-center sm:hidden">
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-[61] w-full max-w-lg rounded-xl border bg-background shadow-2xl">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees, departments, leaves…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {!query.trim() && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Type to search across the organization</p>
              )}

              {query.trim() && !loading && results && results.employees.length === 0 && results.departments.length === 0 && results.leaves.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results found</p>
              )}

              {results && results.employees.length > 0 && (
                <SearchGroup title="Employees" icon={Users}>
                  {results.employees.map((e) => (
                    <button key={e.id} onClick={() => go('/employees')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start hover:bg-muted/50">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{e.name.charAt(0)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{e.position}{e.department ? ` · ${e.department.name}` : ''}</span>
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{e.status}</span>
                    </button>
                  ))}
                </SearchGroup>
              )}

              {results && results.departments.length > 0 && (
                <SearchGroup title="Departments" icon={Building2}>
                  {results.departments.map((d) => (
                    <button key={d.id} onClick={() => go('/departments')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start hover:bg-muted/50">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm font-medium">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{d._count.employees} employees</span>
                    </button>
                  ))}
                </SearchGroup>
              )}

              {results && results.leaves.length > 0 && (
                <SearchGroup title="Leave Requests" icon={CalendarClock}>
                  {results.leaves.map((l) => (
                    <button key={l.id} onClick={() => go('/leaves')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start hover:bg-muted/50">
                      <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{l.employee.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{l.type} · {l.status}</span>
                      </span>
                    </button>
                  ))}
                </SearchGroup>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchGroup({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
