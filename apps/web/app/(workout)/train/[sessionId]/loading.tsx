import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';

export default function WorkoutLoading() {
  return (
    <LoadingRegion>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="aspect-[4/3] w-full" />
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-36 w-full" />
    </LoadingRegion>
  );
}
