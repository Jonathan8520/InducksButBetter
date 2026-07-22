import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const StoryResultSkeleton: React.FC = () => {
  return (
    <Card className="overflow-hidden border-border-subtle shadow-sm rounded-lg bg-white">
      <CardContent className="p-0 flex flex-row">
        {/* Left: Thumbnail placeholder */}
        <div className="w-[120px] shrink-0 bg-surface-3 border-r border-border-subtle relative">
          <Skeleton className="w-full h-full" />
        </div>

        {/* Right: Content placeholder */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-5 flex-1">
            <div className="mb-2">
              <Skeleton className="h-3 w-1/4 mb-2 bg-surface-3" />
              <Skeleton className="h-6 w-3/4 mb-1 bg-surface-3" />
              <Skeleton className="h-4 w-1/3 bg-surface-3" />
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
              <Skeleton className="h-4 w-full bg-surface-2" />
              <Skeleton className="h-4 w-full bg-surface-2" />
              <Skeleton className="h-4 col-span-2 w-full bg-surface-2" />
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4 border-t border-border-subtle pt-3">
              <Skeleton className="h-4 w-1/3 bg-surface-2" />
              <Skeleton className="h-4 w-1/3 bg-surface-2" />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex -space-x-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="w-5 h-5 rounded-full border-2 border-white bg-surface-3" />
                ))}
              </div>
              <Skeleton className="h-3 w-1/2 bg-surface-2" />
            </div>
          </div>

          {/* Description Box placeholder */}
          <div className="bg-surface-2 border-t border-border-subtle p-4 pt-3">
            <Skeleton className="h-3 w-full mb-1 bg-surface-3" />
            <Skeleton className="h-3 w-2/3 bg-surface-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoryResultSkeleton;
