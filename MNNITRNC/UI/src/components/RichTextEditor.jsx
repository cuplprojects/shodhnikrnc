import { useState, useMemo, useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';

export default function RichTextEditor({
  content,
  onChange,
  placeholder,
  height = 400
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
        'advlist', 'autolink', 'lists', 'link', 'charmap',
        'searchreplace', 'visualblocks', 'code', 'fullscreen',
        'table', 'preview', 'wordcount',
      ],
      toolbar:
        'undo redo | blocks | fontfamily fontsize | forecolor backcolor | ' +
        'bold italic underline strikethrough subscript superscript | ' +
        'alignleft aligncenter alignright alignjustify | ' +
        'bullist numlist outdent indent | link table | ' +
        'blockquote hr | removeformat code fullscreen preview searchreplace',
      valid_elements:
        'p,br,b,strong,i,em,u,s,sub,sup,ul,ol,li,' +
        'h1,h2,h3,h4,h5,h6,hr,' +
        'span[class|style],' +
        'table[style],thead,tbody,tr,th[colspan|rowspan|style],td[colspan|rowspan|style],' +
        'a[href]',
      extended_valid_elements: 'span[class|style],p[style],td[style],th[style],table[style]',
      font_family_formats:
        'Arial=arial,helvetica,sans-serif;' +
        'Times New Roman=times new roman,times,serif;' +
        'Courier New=courier new,courier,monospace;' +
        'Georgia=georgia,palatino,serif;' +
        'Verdana=verdana,geneva,sans-serif',
      font_size_formats: '10px 12px 14px 16px 18px 24px 28px 32px',
      content_style: 'body { font-family: Arial, sans-serif; font-size: 14px; }',
      placeholder: placeholder || 'Start writing...',
    }),
    [placeholder, height]
  );

  return (
    <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
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
