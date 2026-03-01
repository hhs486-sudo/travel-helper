import WatchDetailView from '@/components/watch/WatchDetailView';

interface WatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WatchDetailPage({ params }: WatchDetailPageProps) {
  const { id } = await params;
  return <WatchDetailView id={id} />;
}
