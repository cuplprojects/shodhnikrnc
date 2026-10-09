import React, { useMemo, useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';

/**
 * TinyMCE Rich Text Editor for Noting Page.
 * Uses self-hosted tinymce (/tinymce/tinymce.min.js).
 */
export default function NotingRichTextEditor({
  content,
  onChange,
  placeholder = 'Type or edit the noting format text...',
  height = 380,
}) {
  const [initialContent] = useState(() => content || '');
  const editorRef = useRef(null);

  const editorInit = useMemo(
    () => ({
      height,
      menubar: false,
      ui_mode: 'split',
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
      valid_elements: '*[*]',
      extended_valid_elements: '*[*]',
      font_family_formats:
        'Arial=arial,helvetica,sans-serif;' +
        'Times New Roman=times new roman,times,serif;' +
        'Courier New=courier new,courier,monospace;' +
        'Georgia=georgia,palatino,serif;' +
        'Verdana=verdana,geneva,sans-serif;' +
        'Mangal=mangal,serif;' +
        'Kokila=kokila,serif',
      font_size_formats: '10px 12px 14px 15px 16px 18px 20px 24px 28px 32px',
      content_style:
        'body { font-family: Georgia, serif; font-size: 15px; line-height: 1.7; color: #000; padding: 12px; } ' +
        'p { margin-bottom: 0.75rem; }',
      placeholder,
    }),
    [height, placeholder]
  );

  return (
    <div className="border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        initialValue={initialContent}
        onEditorChange={(html) => onChange?.(html)}
        onInit={(_evt, editor) => {
          editorRef.current = editor;
        }}
        init={editorInit}
      />
    </div>
  );
}
