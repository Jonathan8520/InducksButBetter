import { Card, CardContent } from "@/components/ui/card"

export default function IssueResultSkeleton() {
  return (
    <Card className="overflow-hidden border-border-subtle shadow-sm rounded-lg bg-surface animate-pulse">
      <CardContent className="p-0 flex flex-row">
        {/* Left: Shimmer Cover */}
        <div className="w-[140px] sm:w-[180px] h-[180px] shrink-0 bg-surface-2 relative" />

        {/* Right: Content Shimmer */}
        <div className="flex-1 flex flex-col p-5 gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-4 bg-surface-3 rounded" />
            <div className="w-16 h-3 bg-surface-3 rounded" />
          </div>
          <div className="w-3/4 h-5 bg-surface-3 rounded mb-1" />
          <div className="w-1/2 h-3.5 bg-surface-3 rounded italic" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 border-t border-border-subtle dark:border-border pt-3">
            <div className="col-span-1 sm:col-span-2 flex gap-2">
              <div className="w-16 h-3 bg-surface-3 rounded" />
              <div className="w-24 h-3 bg-surface-3 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="w-14 h-3 bg-surface-3 rounded" />
              <div className="w-20 h-3 bg-surface-3 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="w-14 h-3 bg-surface-3 rounded" />
              <div className="w-10 h-3 bg-surface-3 rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
