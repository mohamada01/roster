import Company from '@/components/Company';

export default function Page({ params }: { params: { slug: string } }) {
  return <Company slug={decodeURIComponent(params.slug)} />;
}
