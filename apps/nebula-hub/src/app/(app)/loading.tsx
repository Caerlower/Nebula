import { ListSkeleton, StatCardSkeleton } from "@/components/shared/skeletons";

export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}
