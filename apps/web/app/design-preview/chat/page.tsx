import { PreviewShell } from '../preview-shell';
import { ChatPreview } from './chat-preview';

export default async function DesignPreviewChat({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread } = await searchParams;
  const initialThread = ['family', 'minh-anh', 'thanh-huong'].includes(thread ?? '')
    ? (thread as 'family' | 'minh-anh' | 'thanh-huong')
    : undefined;
  return (
    <PreviewShell>
      <ChatPreview initialThread={initialThread} />
    </PreviewShell>
  );
}
