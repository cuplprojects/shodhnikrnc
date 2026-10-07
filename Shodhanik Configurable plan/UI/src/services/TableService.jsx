/**
 * @fileOverview This service provides a reusable table component with sorting, filtering, pagination, and column visibility controls.
 * It leverages the tanstack/react-table library for efficient table management.
 *
 * @uses react - For building the UI.
 * @uses @tanstack/react-table - For table logic and rendering.
 * @uses lucide-react - For icons.
 */
import React, {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useRef,
} from "react";
import useDebounce from "../utils/debounce";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  CircleX,
  MoreVertical,
  Eye,
  EyeOff,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const TableService = forwardRef(
  (
    {
      columns,
      data,
      initialPageSize = 10,
      serverPagination = false,
      pageCount: controlledPageCount,
      totalItems,
      totalPages,
      currentPage,
      loading = false,
      onRefresh, // New prop - only emits refresh signal
      onRowClick, // Optional: row click handler
      getIsRowExpanded, // Optional: function(row) => boolean
      renderExpandedRow, // Optional: function(row) => JSX
    },
    ref
  ) => {
    const [sorting, setSorting] = useState([]);
    const [columnFilters, setColumnFilters] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [pagination, setPagination] = useState({
      pageIndex: 0,
      pageSize: initialPageSize,
    });
    const [globalFilter, setGlobalFilter] = useState("");

    // State for column filter inputs (immediate UI updates)
    const [columnFilterInputs, setColumnFilterInputs] = useState({});

    // Use debounced values for API calls, not for UI display
    const [debouncedGlobalFilter] = useDebounce(globalFilter, 500);
    const [debouncedColumnFilters] = useDebounce(columnFilters, 500);

    // Reset pagination when filters change (except on initial load)
    const [isInitialMount, setIsInitialMount] = useState(true);

    // Reset pagination when data changes (new data set)
    const prevDataLength = useRef(data?.length || 0);
    useEffect(() => {
      if (!isInitialMount && data && prevDataLength.current !== data.length) {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        prevDataLength.current = data.length;
      }
    }, [data, isInitialMount]);

    useEffect(() => {
      if (isInitialMount) {
        setIsInitialMount(false);
        return;
      }
      // Reset to first page when global filter changes
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [serverPagination ? debouncedGlobalFilter : globalFilter]);

    useEffect(() => {
      if (isInitialMount) return;
      // Reset to first page when column filters change
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [serverPagination ? debouncedColumnFilters : columnFilters]);

    // Emit refresh signal when any debounced state changes
    useEffect(() => {
      if (typeof onRefresh === "function") {
        onRefresh();
      }
    }, [
      pagination,
      sorting,
      debouncedColumnFilters,
      debouncedGlobalFilter,
      onRefresh,
    ]);

    // Expose internal state to parent via ref
    useImperativeHandle(ref, () => ({
      getTableState: () => ({
        pagination,
        sorting,
        columnFilters: debouncedColumnFilters,
        globalFilter: debouncedGlobalFilter,
      }),
    }));

    const table = useReactTable({
      data: data || [],
      columns,
      state: {
        globalFilter: serverPagination ? debouncedGlobalFilter : globalFilter,
        sorting,
        columnFilters: serverPagination ? debouncedColumnFilters : columnFilters,
        columnVisibility,
        pagination,
      },
      onGlobalFilterChange: setGlobalFilter,
      onSortingChange: (sortingState) => {
        setSorting(sortingState);
        // Reset pagination when sorting changes
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      },
      onColumnFiltersChange: setColumnFilters,
      onColumnVisibilityChange: setColumnVisibility,
      onPaginationChange: setPagination,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      manualPagination: serverPagination,
      manualFiltering: serverPagination,
      manualSorting: serverPagination,
      pageCount: serverPagination ? controlledPageCount : undefined,
      enableSortingRemoval: true, // Allow cycling through: none → asc → desc → none
      enableMultiSort: false, // Disable multi-column sorting for cleaner UX
      // Add debug info
      debugTable: false,
      debugHeaders: false,
      debugColumns: false,
    });

    const [searchValue, setSearchValue] = useState("");

    // Handle search input changes
    const handleSearchChange = useCallback((value) => {
      setSearchValue(value);
      if (serverPagination) {
        // For server pagination, use debounced value
        return;
      } else {
        // For client-side filtering, update immediately
        setGlobalFilter(value);
      }
    }, [serverPagination]);

    // Debounce search input for server pagination
    useEffect(() => {
      if (!serverPagination) return;
      
      const handler = setTimeout(() => {
        setGlobalFilter(searchValue);
      }, 400);
      return () => clearTimeout(handler);
    }, [searchValue, serverPagination]);

    // Handle column filter input changes with debouncing
    const handleColumnFilterChange = useCallback((columnId, value) => {
      // Update immediate UI state
      setColumnFilterInputs((prev) => ({
        ...prev,
        [columnId]: value,
      }));

      if (serverPagination) {
        // For server pagination, update column filters (which will be debounced)
        setColumnFilters((prev) => {
          const existingFilter = prev.find((filter) => filter.id === columnId);
          if (!value) {
            // Remove filter if value is empty
            return prev.filter((filter) => filter.id !== columnId);
          }
          if (existingFilter) {
            // Update existing filter
            return prev.map((filter) =>
              filter.id === columnId ? { ...filter, value } : filter
            );
          }
          // Add new filter
          return [...prev, { id: columnId, value }];
        });
      } else {
        // For client-side filtering, update immediately
        setColumnFilters((prev) => {
          const existingFilter = prev.find((filter) => filter.id === columnId);
          if (!value) {
            return prev.filter((filter) => filter.id !== columnId);
          }
          if (existingFilter) {
            return prev.map((filter) =>
              filter.id === columnId ? { ...filter, value } : filter
            );
          }
          return [...prev, { id: columnId, value }];
        });
      }
    }, [serverPagination]);

    // Initialize column filter inputs from actual column filters
    useEffect(() => {
      const inputs = {};
      const filtersToUse = serverPagination ? debouncedColumnFilters : columnFilters;
      filtersToUse.forEach((filter) => {
        inputs[filter.id] = filter.value;
      });
      setColumnFilterInputs(inputs);
    }, [serverPagination ? debouncedColumnFilters : columnFilters, serverPagination]);

    const [showColumnMenu, setShowColumnMenu] = useState(false);

    // Close column menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (showColumnMenu && !event.target.closest(".column-menu-container")) {
          setShowColumnMenu(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [showColumnMenu]);

    return (
      <div className="w-full mt-2 relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 m-1">
          <div className="relative" style={{ minWidth: 200 }}>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search..."
              className="px-3 py-2 pr-10 rounded border border-slate-300 text-gray-800 bg-white w-full text-md"
            />
            {searchValue && (
              <button
                onClick={() => {
                  setSearchValue("");
                  handleSearchChange("");
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500"
              >
                <CircleX size={20} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-700 font-medium">Rows per page:</span>
              <select
                className="px-2 py-1 rounded border border-slate-300 text-gray-800 bg-white"
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
              >
                {[5, 10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative column-menu-container">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="p-2 text-gray-700 hover:text-slate-600 hover:bg-slate-100 rounded-full border border-slate-300"
              >
                <MoreVertical size={20} />
              </button>

              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-300 rounded shadow z-50 p-2 space-y-2 max-h-[280px] overflow-y-auto text-sm">
                  <div className="flex flex-col gap-1 border-b pb-2 border-slate-200">
                    <button
                      className="flex items-center justify-between px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                      onClick={() => {
                        setSorting([]);
                        // Reset pagination when clearing sorting
                        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <ArrowUpDown size={14} />
                        Clear Sorting
                      </span>
                    </button>

                    <button
                      className="flex items-center justify-between px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                      onClick={() => {
                        setColumnFilters([]);
                        setColumnFilterInputs({});
                        setGlobalFilter("");
                        setSearchValue("");
                        // Reset pagination when clearing filters
                        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Filter size={14} />
                        Clear Filters
                      </span>
                    </button>

                    <button
                      className="flex items-center justify-between px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                      onClick={() => {
                        const allVisible = table
                          .getAllLeafColumns()
                          .every((col) => col.getIsVisible());
                        table.getAllLeafColumns().forEach((col) => {
                          col.toggleVisibility(!allVisible);
                        });
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Eye size={14} />
                        {table
                          .getAllLeafColumns()
                          .every((col) => col.getIsVisible())
                          ? "Hide All"
                          : "Show All"}
                      </span>
                    </button>
                  </div>

                  {table.getAllLeafColumns().map((column) => (
                    <div
                      key={column.id}
                      className="flex items-center justify-between px-2 py-1 text-slate-800 border-b border-dashed text-sm"
                    >
                      <span className="truncate">
                        {column.columnDef.header}
                      </span>
                      <button
                        className="hover:text-red-500"
                        onClick={() => column.toggleVisibility()}
                      >
                        {column.getIsVisible() ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-auto rounded border border-slate-200 bg-white shadow-sm relative">
          <table className="min-w-full text-gray-800">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className="px-2 py-1 bg-gray-200 border-b border-slate-300 text-center font-semibold cursor-pointer"
                      onClick={
                        header.column.getCanSort()
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-center gap-1 text-slate-800 text-md">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === "asc"
                          ? "▲"
                          : header.column.getIsSorted() === "desc"
                          ? "▼"
                          : ""}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-center py-6 text-gray-700"
                  >
                    No data found.
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 && loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="text-center py-6 text-slate-500 animate-pulse"
                  >
                    Loading...
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (typeof onRowClick === 'function') onRowClick(row);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-2 py-1 border-b border-slate-200 text-center"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                    {typeof getIsRowExpanded === 'function' && getIsRowExpanded(row) && typeof renderExpandedRow === 'function' && (
                      <tr>
                        <td colSpan={columns.length} className="bg-slate-50">
                          {renderExpandedRow(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 px-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>
              {data && data.length > 0 ? (
                <>
                  {serverPagination && totalItems !== undefined ? (
                    <>
                      Showing{" "}
                      {(currentPage - 1) *
                        table.getState().pagination.pageSize +
                        1}{" "}
                      to{" "}
                      {Math.min(
                        currentPage * table.getState().pagination.pageSize,
                        totalItems
                      )}{" "}
                      of {totalItems} results
                    </>
                  ) : (
                    <>
                      Showing{" "}
                      {table.getState().pagination.pageIndex *
                        table.getState().pagination.pageSize +
                        1}{" "}
                      to{" "}
                      {Math.min(
                        (table.getState().pagination.pageIndex + 1) *
                          table.getState().pagination.pageSize,
                        table.getFilteredRowModel().rows.length
                      )}{" "}
                      of {table.getFilteredRowModel().rows.length} results
                    </>
                  )}
                </>
              ) : (
                "No results"
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={
                  serverPagination && currentPage !== undefined
                    ? currentPage <= 1
                    : !table.getCanPreviousPage()
                }
                className="p-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={
                  serverPagination && currentPage !== undefined
                    ? currentPage <= 1
                    : !table.getCanPreviousPage()
                }
                className="p-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-700">Page</span>
              <input
                type="number"
                value={
                  serverPagination && currentPage !== undefined
                    ? currentPage
                    : table.getState().pagination.pageIndex + 1
                }
                onChange={(e) => {
                  const page = e.target.value ? Number(e.target.value) - 1 : 0;
                  table.setPageIndex(page);
                }}
                className="w-16 px-2 py-1 text-center rounded border border-slate-300 text-sm"
                min="1"
                max={
                  serverPagination && totalPages !== undefined
                    ? totalPages
                    : table.getPageCount()
                }
              />
              <span className="text-sm text-gray-700">
                of{" "}
                {serverPagination && totalPages !== undefined
                  ? totalPages
                  : table.getPageCount()}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => table.nextPage()}
                disabled={
                  serverPagination && currentPage !== undefined
                    ? currentPage >= totalPages
                    : !table.getCanNextPage()
                }
                className="p-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => {
                  if (serverPagination && totalPages !== undefined) {
                    table.setPageIndex(totalPages - 1);
                  } else {
                    table.setPageIndex(table.getPageCount() - 1);
                  }
                }}
                disabled={
                  serverPagination && currentPage !== undefined
                    ? currentPage >= totalPages
                    : !table.getCanNextPage()
                }
                className="p-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TableService.displayName = "TableService";

export default TableService;
