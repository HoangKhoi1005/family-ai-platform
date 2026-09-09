import { PreviewShell } from '../preview-shell';
import { AdminPreview, type AdminState } from './admin-preview';

export default async function DesignPreviewAdmin({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const initialState: AdminState = state === 'empty' || state === 'conflict' ? state : 'pending';

  return (
    <PreviewShell>
      <AdminPreview initialState={initialState} />
    </PreviewShell>
  );
}
