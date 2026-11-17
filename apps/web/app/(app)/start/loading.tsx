import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';

export default function StartLoading() {
  return (
    <LoadingRegion>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </LoadingRegion>
  );
}
