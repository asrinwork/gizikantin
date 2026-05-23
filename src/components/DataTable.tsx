import { useMemo, useState, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer */
  cell: (row: T) => ReactNode;
  /** Value used for sorting and global search. If omitted, sort/search disabled for this column. */
  accessor?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  /** Optional initial sort */
  initialSort?: { key: string; dir: "asc" | "desc" };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataTable<T>({
  data,
  columns,
  rowKey,
  searchPlaceholder = "Cari...",
  pageSize: initialPageSize = 10,
  emptyMessage = "Tidak ada data.",
  initialSort,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((c) => {
        if (!c.accessor) return false;
        const v = c.accessor(row);
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.accessor) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = col.accessor!(a);
      const bv = col.accessor!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "id", { numeric: true });
    });
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [filtered, sort, columns]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {total === 0 ? "0 data" : `${start + 1}–${Math.min(start + pageSize, total)} dari ${total}`}
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                {columns.map((c) => {
                  const sortable = c.sortable !== false && !!c.accessor;
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      className={cn(
                        "h-11 px-4 font-semibold text-xs uppercase tracking-wide text-muted-foreground",
                        c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                        c.headerClassName
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn(
                            "inline-flex items-center gap-1.5 hover:text-foreground transition-colors",
                            active && "text-foreground"
                          )}
                        >
                          {c.header}
                          {!active && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                          {active && sort?.dir === "asc" && <ArrowUp className="h-3 w-3" />}
                          {active && sort?.dir === "desc" && <ArrowDown className="h-3 w-3" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-3 align-middle",
                        c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                        c.className
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-muted-foreground text-sm">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Baris per halaman</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(+v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[72px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">Hal {currentPage} / {totalPages}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setPage(1)}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
