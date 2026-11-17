import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';

export default function TodayLoading() {
  return (
    <LoadingRegion>
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </LoadingRegion>
  );
}
