function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function contentDisposition(filename, inline = false) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function formatFileSize(size) {
  const value = Number(size) || 0;
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function previewKind(file) {
  const type = String(file.content_type || '').toLowerCase();
  const name = String(file.filename || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    type.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/javascript'].includes(type) ||
    /\.(txt|md|json|csv|xml|log|yml|yaml|js|ts|tsx|css|html)$/i.test(name)
  ) {
    return 'text';
  }
  return 'unsupported';
}

export function fileObjectResponse(object, file, { inline = false } = {}) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('content-type', file.content_type || headers.get('content-type') || 'application/octet-stream');
  headers.set('content-disposition', contentDisposition(file.filename, inline));
  if (file.size) headers.set('content-length', String(file.size));
  return new Response(object.body, { headers });
}

export function filePreviewPage(request, file, label = '文件分享') {
  const url = new URL(request.url);
  const rawUrl = new URL(url);
  rawUrl.searchParams.set('raw', '1');
  rawUrl.searchParams.delete('download');
  const downloadUrl = new URL(url);
  downloadUrl.searchParams.set('download', '1');
  downloadUrl.searchParams.delete('raw');

  const kind = previewKind(file);
  const filename = escapeHtml(file.filename || 'file');
  const fileType = escapeHtml(file.content_type || 'application/octet-stream');
  const size = escapeHtml(formatFileSize(file.size));
  const safeLabel = escapeHtml(label);
  const safeRawUrl = escapeHtml(rawUrl.toString());
  const safeDownloadUrl = escapeHtml(downloadUrl.toString());

  const preview = (() => {
    if (kind === 'image') {
      return `<img class="preview-media image" src="${safeRawUrl}" alt="${filename}" />`;
    }
    if (kind === 'audio') {
      return `<audio class="preview-media" src="${safeRawUrl}" controls preload="metadata"></audio>`;
    }
    if (kind === 'video') {
      return `<video class="preview-media video" src="${safeRawUrl}" controls preload="metadata"></video>`;
    }
    if (kind === 'pdf') {
      return `<iframe class="preview-frame" src="${safeRawUrl}" title="${filename}"></iframe>`;
    }
    if (kind === 'text') {
      return `<iframe class="preview-frame text-frame" src="${safeRawUrl}" title="${filename}"></iframe>`;
    }
    return `
      <div class="empty-preview">
        <div class="file-icon">FILE</div>
        <p>这个文件类型暂时不能直接预览。</p>
        <span>可以先确认文件名、大小和类型，再点击下载。</span>
      </div>
    `;
  })();

  return new Response(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${filename} - Qnote</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0a0a0a;
        --panel: #171717;
        --panel-soft: #111111;
        --border: #262626;
        --text: #f5f5f5;
        --muted: #a3a3a3;
        --subtle: #737373;
        --accent: #ffffff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(960px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 32px 0;
      }
      header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 20px;
      }
      h1 {
        margin: 0;
        max-width: 680px;
        font-size: 28px;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }
      .label {
        margin: 0 0 8px;
        color: var(--subtle);
        font-size: 11px;
        letter-spacing: .18em;
        text-transform: uppercase;
      }
      .download {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        background: var(--accent);
        color: #000;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }
      .meta div {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--panel-soft);
        padding: 12px;
        min-width: 0;
      }
      .meta span {
        display: block;
        color: var(--subtle);
        font-size: 11px;
        margin-bottom: 6px;
      }
      .meta strong {
        display: block;
        color: var(--muted);
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .preview {
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--panel);
        min-height: 360px;
        overflow: hidden;
      }
      .preview-media {
        display: block;
        width: 100%;
      }
      .image {
        max-height: 72vh;
        object-fit: contain;
        background: #050505;
      }
      .video {
        max-height: 72vh;
        background: #050505;
      }
      audio.preview-media {
        margin: 72px auto;
        width: min(680px, calc(100% - 48px));
      }
      .preview-frame {
        display: block;
        width: 100%;
        height: 72vh;
        min-height: 420px;
        border: 0;
        background: #fff;
      }
      .text-frame {
        background: #111;
      }
      .empty-preview {
        min-height: 360px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 40px;
        text-align: center;
        color: var(--muted);
      }
      .file-icon {
        width: 72px;
        height: 72px;
        border: 1px solid var(--border);
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: var(--subtle);
        font-size: 12px;
        letter-spacing: .15em;
      }
      .empty-preview p {
        margin: 8px 0 0;
        font-size: 16px;
        color: var(--text);
      }
      .empty-preview span {
        color: var(--subtle);
        font-size: 13px;
      }
      @media (max-width: 720px) {
        main { width: min(100vw - 24px, 960px); padding: 20px 0; }
        header { align-items: stretch; flex-direction: column; }
        h1 { font-size: 22px; }
        .download { width: 100%; }
        .meta { grid-template-columns: 1fr; }
        .preview, .empty-preview { min-height: 280px; }
        .preview-frame { height: 62vh; min-height: 320px; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="label">${safeLabel}</p>
          <h1>${filename}</h1>
        </div>
        <a class="download" href="${safeDownloadUrl}">下载文件</a>
      </header>
      <section class="meta" aria-label="文件信息">
        <div><span>文件名</span><strong>${filename}</strong></div>
        <div><span>类型</span><strong>${fileType}</strong></div>
        <div><span>大小</span><strong>${size}</strong></div>
      </section>
      <section class="preview" aria-label="文件预览">
        ${preview}
      </section>
    </main>
  </body>
</html>`, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, max-age=60',
    },
  });
}
