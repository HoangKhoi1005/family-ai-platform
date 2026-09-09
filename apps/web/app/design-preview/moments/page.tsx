import { PreviewShell } from '../preview-shell';
import { MomentsPreview } from './moments-preview';

export default async function DesignPreviewMoments({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string }>;
}) {
  const { compose } = await searchParams;
  return (
    <PreviewShell>
      <MomentsPreview initiallyComposing={compose === 'true'} />
    </PreviewShell>
  );
}
