import { useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Tag } from 'lucide-react';
import { ADVERTISEMENT_TOKENS } from '../../../constants/advertisementTokens';
import { uploadAdvertisementImage } from '../../../api/recruitmentApi';

/**
 * A TinyMCE-based rich text editor for the advertisement body. Purely
 * presentational: the parent owns the initial content and the resolved
 * token values, and receives every change via `onChange`.
 *
 * Self-hosted (no API key, no CDN) -- `tinymceScriptSrc` points at
 * `/tinymce/tinymce.min.js`, copied into `public/tinymce/` by the
 * `postinstall` script from the `tinymce` npm package. `valid_elements`/
 * `extended_valid_elements` are kept in lockstep with the backend's
 * AdvertisementTextSanitizer allow-list -- any tag/attribute this editor
 * can produce beyond that allow-list would be silently stripped
 * server-side on save, corrupting the user's content.
 *
 * `content` is used only as `initialValue` (TinyMCE owns the document
 * after that) -- callers that need to reseed content (e.g. picking a
 * different template) should remount this component with a fresh `key`,
 * same convention as the prior TipTap-based version.
 */
export default function AdvertisementRichTextEditor({
  content,
  onChange,
  tokenValues = {},
  placeholder,
  recruitmentId,
}) {
  // @tinymce/tinymce-react's underlying class component does NOT treat
  // `initialValue` as mount-only despite the name: its componentDidUpdate
  // calls editor.setContent() any time the `initialValue` prop differs
  // from its previous value. Since `content` here is the same state the
  // parent updates from every onChange call, passing it straight through
  // as `initialValue` on every render means every keystroke feeds back in
  // as a "new" initialValue and the library resets the caret to the start
  // of the document. The lazy useState initializer runs exactly once, on
  // mount, freezing the very first `content` this component ever saw --
  // `content` is never read again after that. Reseeding (e.g. picking a
  // template) still works via this component's existing
  // remount-on-key-change contract.
  const [initialContent] = useState(() => content || '');

  // The `init` object must keep a stable identity across re-renders --
  // @tinymce/tinymce-react treats a changed `init` reference as a signal to
  // reinitialize the editor, which resets the cursor to the start of the
  // document. Without this, `init={{...}}` being a fresh literal on every
  // render (which happens on every keystroke, since onEditorChange updates
  // the parent's state) reinitializes the editor on every keystroke.
  // tokenValues/recruitmentId can still change over the editor's lifetime
  // (e.g. once the token-values fetch resolves), so their current values
  // are read through refs inside the memoized callbacks instead of being
  // captured directly, keeping `init` itself dependency-free. The refs are
  // written in an effect (after render), never during render, per React's
  // rule against reading/writing ref.current while rendering.
  const tokenValuesRef = useRef(tokenValues);
  const recruitmentIdRef = useRef(recruitmentId);
  useEffect(() => {
    tokenValuesRef.current = tokenValues;
    recruitmentIdRef.current = recruitmentId;
  }, [tokenValues, recruitmentId]);

  // "Insert field" is a plain React-controlled dropdown rendered above the
  // editor, not a TinyMCE toolbar menu button -- TinyMCE's own popup
  // positioning library auto-flips a toolbar menu upward whenever it judges
  // there isn't enough room below (e.g. this control sits on a later
  // wrapped toolbar row, closer to the bottom of the modal), and it exposes
  // no per-button override to force a direction. A plain `top-full`
  // absolutely-positioned element under our own control always opens
  // downward, matching the same pattern the prior TipTap-based version of
  // this component used for exactly this control.
  const editorRef = useRef(null);
  const [isTokenMenuOpen, setIsTokenMenuOpen] = useState(false);

  const insertToken = (token) => {
    const editor = editorRef.current;
    if (!editor) return;
    const value = tokenValuesRef.current[token.key] ?? '';
    // Only the resolved value goes into the document -- token.label is
    // shown in the "Insert field" menu to help the user pick the right
    // field, but it's not part of the advertisement's actual text.
    editor.insertContent(
      `<span class="ad-token-chip">${editor.dom.encode(value)}</span>&nbsp;`
    );
    setIsTokenMenuOpen(false);
  };

  const editorInit = useMemo(
    () => ({
      height: 400,
      menubar: false,
      // The editor sits inside GenerateAdvertisementModal.jsx's
      // overflow-hidden/overflow-y-auto containers -- TinyMCE's default
      // ui_mode ('combined') renders dropdown/menu popups as DOM nodes
      // near the editor, which those ancestors clip, making every
      // toolbar dropdown appear not to open. 'split' renders them in a
      // floating layer detached from the editor's DOM position instead.
      ui_mode: 'split',
      // Default ('floating') collapses whatever doesn't fit on one row
      // into a "more" (>>) overflow button. 'wrap' instead lets the
      // toolbar flow onto as many full-width rows as it needs so every
      // control is always visible without an extra click.
      toolbar_mode: 'wrap',
      plugins: [
        'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
        'searchreplace', 'visualblocks', 'code', 'fullscreen',
        'table', 'preview', 'wordcount',
      ],
      toolbar:
        'undo redo | blocks | fontfamily fontsize | forecolor backcolor | ' +
        'bold italic underline strikethrough subscript superscript | ' +
        'alignleft aligncenter alignright alignjustify | ' +
        'bullist numlist outdent indent | link image table | ' +
        'blockquote hr | removeformat code fullscreen preview searchreplace',
      // Keep in lockstep with
      // API.Application.Recruitment.AdvertisementTextSanitizer's
      // allow-list -- see that file for the authoritative list.
      valid_elements:
        'p,br,b,strong,i,em,u,s,sub,sup,ul,ol,li,' +
        'h1,h2,h3,h4,h5,h6,hr,' +
        'span[class],' +
        'table,thead,tbody,tr,th[colspan|rowspan],td[colspan|rowspan],' +
        'img[src|alt],a[href]',
      extended_valid_elements: 'span[class|style],p[style],td[style],th[style],table[style]',
      font_family_formats:
        'Arial=arial,helvetica,sans-serif;' +
        'Times New Roman=times new roman,times,serif;' +
        'Courier New=courier new,courier,monospace;' +
        'Georgia=georgia,palatino,serif;' +
        'Verdana=verdana,geneva,sans-serif',
      font_size_formats: '10px 12px 14px 16px 18px 24px 28px 32px',
      content_style:
        'body { font-family: Arial, sans-serif; font-size: 14px; } ' +
        '.ad-token-chip { background-color: #dbeafe; color: #1e40af; ' +
        'padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 12px; }',
      placeholder: placeholder || 'Start writing the advertisement...',
      images_upload_handler: (blobInfo) =>
        new Promise((resolve, reject) => {
          uploadAdvertisementImage(recruitmentIdRef.current, blobInfo.blob())
            .then((response) => resolve(response.url))
            .catch((err) => reject(err?.message || 'Image upload failed'));
        }),
    }),
    [placeholder]
  );

  return (
    <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
      <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTokenMenuOpen((open) => !open)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Insert field"
          >
            <Tag size={14} /> Insert field
          </button>
          {isTokenMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsTokenMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-56 max-h-64 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1">
                {ADVERTISEMENT_TOKENS.map((token) => (
                  <button
                    key={token.key}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {token.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        initialValue={initialContent}
        onEditorChange={(html) => onChange?.(html)}
        onInit={(_evt, editor) => { editorRef.current = editor; }}
        init={editorInit}
      />
    </div>
  );
}
