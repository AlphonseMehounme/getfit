import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';

export default function OnboardingStepLoading() {
  return (
    <LoadingRegion>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </LoadingRegion>
  );
}
