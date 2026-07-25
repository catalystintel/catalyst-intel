import { SharedReportView } from "@/components/shared-report-view";
import { PageEnter } from "@/components/page-enter";

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col">
      <SharedReportView token={token} />
    </PageEnter>
  );
}
