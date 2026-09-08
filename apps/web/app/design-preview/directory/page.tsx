import { PreviewShell } from '../preview-shell';
import { DirectoryFlow } from './directory-flow';

export default function DesignPreviewDirectory() {
  return (
    <PreviewShell>
      <main id="main">
        <DirectoryFlow />
      </main>
    </PreviewShell>
  );
}
