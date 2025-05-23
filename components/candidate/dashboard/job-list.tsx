"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, DollarSign, Clock, Briefcase, Eye, Trash2 } from "lucide-react" // Added more icons
import { JobUI } from "@/app/types/job"
import { cn } from "@/lib/utils" // Assuming you have a utility for class names

interface JobListProps {
  jobs: JobUI[]
  type: "all" | "applied" | "saved"
  searchQuery?: string
  onViewDetails: (jobId: string) => void
  onAction?: (jobId: string) => void
  actionLabel?: string
  showStatus?: boolean
  compact?: boolean // Added compact prop
}

// Enhanced status styles with better contrast and modern look
const statusStyles: Record<string, string> = {
  // Job Statuses (used when type != 'applied')
  active: "bg-blue-100 text-blue-700 border border-blue-200",
  closed: "bg-gray-100 text-gray-700 border border-gray-200", // Use gray for closed jobs
  inactive: "bg-gray-100 text-gray-700 border border-gray-200",

  // Application Statuses (used when type == 'applied')
  new: "bg-cyan-100 text-cyan-700 border border-cyan-200",
  screening: "bg-purple-100 text-purple-700 border border-purple-200",
  shortlist: "bg-indigo-100 text-indigo-700 border border-indigo-200", // Added shortlist
  interview: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  offer: "bg-lime-100 text-lime-700 border border-lime-200", // Changed offer color
  hired: "bg-green-100 text-green-700 border border-green-200", // Changed hired color
  rejected: "bg-red-100 text-red-700 border border-red-200",

  default: "bg-gray-100 text-gray-700 border border-gray-200", // Default style
}

// Labels for different statuses
const statusLabels: Record<string, string> = {
  // Job Statuses
  active: "Active", // Label for the job itself being active
  closed: "Closed", // Label for the job itself being closed
  inactive: "Inactive",

  // Application Statuses (using user-friendly labels)
  new: "Applied", // More user-friendly label for 'new' application
  screening: "Screening",
  shortlist: "Shortlisted",
  interview: "Interview",
  offer: "Offer Received",
  hired: "Hired",
  rejected: "Not Selected", // More user-friendly label for 'rejected'
}


export function JobList({
  jobs = [],
  type,
  searchQuery = "",
  onViewDetails,
  onAction,
  actionLabel,
  showStatus = true,
  compact = false, // Use compact prop
}: JobListProps) {
  const jobsArray = Array.isArray(jobs) ? jobs : []

  // Simplified date formatting
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric', // Keep year for clarity in lists
      });
    } catch (e) {
      return "Invalid Date";
    }
  };

  const getDateColumn = (job: JobUI) => {
    switch (type) {
      case "applied":
        return formatDate(job.appliedDate);
      case "saved":
        return formatDate(job.savedDate);
      default:
        // For 'all' jobs (like find-jobs), use postedDate
        return formatDate(job.postedDate);
    }
  }

  const getDateColumnLabel = () => {
    switch (type) {
      case "applied":
        return "Date Applied"; // Changed label for clarity
      case "saved":
        return "Date Saved"; // Changed label for clarity
      default:
        return "Date Posted"; // Changed label for clarity
    }
  }

  return (
    <div className={cn(!compact && "border rounded-lg overflow-hidden")}> {/* Add border only if not compact */}
      <Table className={cn(compact && "text-sm")}> {/* Reduce text size if compact */}
        {!compact && ( // Hide header in compact mode
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className="py-3 px-4">Job</TableHead> {/* Adjusted padding */}
              <TableHead className="py-3 px-4">{getDateColumnLabel()}</TableHead>
              {showStatus && <TableHead className="py-3 px-4">Status</TableHead>}
              <TableHead className="text-right py-3 px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
        )}
        {/* Ensure no whitespace is rendered between TableHeader and TableBody */}
        <TableBody>
          {jobsArray.length === 0 ? (
             <TableRow>
              <TableCell colSpan={showStatus ? 4 : 3} className="h-24 text-center text-muted-foreground">
                {searchQuery ? `No jobs found matching "${searchQuery}"` : (type === 'applied' ? 'You have not applied to any jobs yet.' : (type === 'saved' ? 'You have not saved any jobs yet.' : 'No jobs found.'))}
              </TableCell>
            </TableRow>
          ) : (
            jobsArray.map((job) => (
              <TableRow key={job.id} className="hover:bg-gray-50/50 transition-colors group">
                <TableCell className={cn("py-3 px-4", compact && "py-2")}> {/* Adjusted padding */}
                  <div className="flex items-center gap-3"> {/* Reduced gap */}
                    {/* Modern Placeholder Logo */}
                    <div className={cn(
                      "flex items-center justify-center rounded-md border bg-indigo-50 shrink-0",
                      compact ? "h-8 w-8" : "h-8 w-8" // Smaller logo in compact
                    )}>
                      <Briefcase className={cn("text-indigo-500", compact ? "h-4 w-4" : "h-5 w-5")} />
                    </div>
                    <div className="flex-1">
                      <div className={cn("font-medium text-gray-900", compact ? "text-sm" : "text-md")}>{job.title}</div>
                      <div className={cn(
                        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5", // Adjusted gap/margin
                        compact && "gap-x-2"
                      )}>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </span>
                        {!compact && ( // Hide salary in compact mode
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {job.salary}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn("text-xs text-muted-foreground py-3 px-4", compact && "py-2")}> {/* Adjusted padding */}
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {getDateColumn(job)}
                  </span>
                </TableCell>
                {showStatus && (
                  <TableCell className={cn("py-3 px-4", compact && "py-2")}>
                    {/* Ensure job.status is treated as string | undefined */}
                    {/* Use lowercase status for lookup, provide default */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        "px-2 py-0.5 text-xs font-medium rounded-full capitalize whitespace-nowrap", // Added whitespace-nowrap
                        statusStyles[(job.status?.toLowerCase() ?? 'default')] ?? statusStyles.default
                      )}
                    >
                      {/* Use lowercase status for lookup, provide default/fallback label */}
                      {statusLabels[(job.status?.toLowerCase() ?? 'default')] ?? job.status ?? "Pending"}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className={cn("text-right space-x-1 py-3 px-4", compact && "py-2")}> {/* Adjusted padding/spacing */}
                  <Button
                    variant="ghost"
                    size={compact ? "sm" : "icon"} // Smaller icon button in compact
                    className={cn("text-muted-foreground hover:text-primary h-8 w-8", compact && "w-auto px-2")}
                    onClick={() => onViewDetails(job.id)}
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                    {compact && <span className="ml-1">View Details</span>}
                  </Button>
                  {onAction && (
                    <Button
                      variant="ghost"
                      size={compact ? "sm" : "icon"}
                      className={cn(
                        "text-muted-foreground hover:text-destructive h-8 w-8",
                        compact && "w-auto px-2 hover:bg-destructive/10"
                      )}
                      onClick={() => onAction(job.id)}
                      title={actionLabel}
                    >
                      {/* Use Trash icon for remove action */}
                      {actionLabel?.toLowerCase() === 'remove' ? <Trash2 className="h-4 w-4" /> : <span className="text-xs">{actionLabel}</span>}
                       {compact && actionLabel?.toLowerCase() === 'remove' && <span className="ml-1">Remove</span>}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}