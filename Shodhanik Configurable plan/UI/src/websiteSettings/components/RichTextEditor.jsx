import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  AlignJustify,
  List, 
  ListOrdered,
  Link,
  Image,
  Type,
  Palette,
  Undo,
  Redo,
  Strikethrough,
  Subscript,
  Superscript,
  Quote,
  Code,
  Table,
  Indent,
  Outdent,
  Copy,
  Scissors,
  Search,
  Eye,
  FileText,
  Download,
  Maximize2,
  Minimize2,
  Minus
} from 'lucide-react';
import notification from '@/services/NotificationService';

const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter your content here...",
  height = "400px",
  maxLength = null,
  readOnly = false,
  showWordCount = true,
  showCharCount = true,
  autoSave = false,
  autoSaveInterval = 30000,
  spellCheck = true,
  theme = "light"
}) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedFormat, setSelectedFormat] = useState('paragraph');
  const [currentFontSize, setCurrentFontSize] = useState('3');
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageWidth, setImageWidth] = useState('');
  const [imageHeight, setImageHeight] = useState('');

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && value) {
      const interval = setInterval(() => {
        localStorage.setItem('richTextEditor_autoSave', value);
      }, autoSaveInterval);
      return () => clearInterval(interval);
    }
  }, [value, autoSave, autoSaveInterval]);

  // Load auto-saved content
  useEffect(() => {
    if (autoSave && !value) {
      const saved = localStorage.getItem('richTextEditor_autoSave');
      if (saved && onChange) {
        onChange(saved);
      }
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
      updateCounts();
    }
  }, [value]);

  // Update word and character counts
  const updateCounts = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.textContent || '';
      setCharCount(text.length);
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    }
  }, []);

  // History management
  const saveToHistory = useCallback((content) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(content);
    if (newHistory.length > 50) { // Limit history to 50 items
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const executeCommand = (command, value = null) => {
    if (readOnly) return;
    
    // Special handling for insertHTML to make it more reliable
    if (command === 'insertHTML') {
      insertHTMLAtCursor(value);
    } else {
      document.execCommand(command, false, value);
    }
    
    editorRef.current.focus();
    handleContentChange();
  };

  // Better HTML insertion function
  const insertHTMLAtCursor = (html) => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // Create a temporary div to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Insert each node from the parsed HTML
      const fragment = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
      
      range.insertNode(fragment);
      
      // Move cursor after inserted content
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // If no selection, append to the end of the editor
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      while (tempDiv.firstChild) {
        editorRef.current.appendChild(tempDiv.firstChild);
      }
    }
  };

  // Enhanced list functions
  const insertBulletList = () => {
    if (readOnly) return;
    
    // Check if we're already in a list
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const listElement = range.commonAncestorContainer.closest ? 
        range.commonAncestorContainer.closest('ul, ol') : 
        null;
      
      if (listElement && listElement.tagName === 'UL') {
        // If already in bullet list, remove it
        executeCommand('insertUnorderedList');
      } else {
        // Create new bullet list
        executeCommand('insertUnorderedList');
      }
    } else {
      executeCommand('insertUnorderedList');
    }
  };

  const insertNumberedList = () => {
    if (readOnly) return;
    
    // Check if we're already in a list
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const listElement = range.commonAncestorContainer.closest ? 
        range.commonAncestorContainer.closest('ul, ol') : 
        null;
      
      if (listElement && listElement.tagName === 'OL') {
        // If already in numbered list, remove it
        executeCommand('insertOrderedList');
      } else {
        // Create new numbered list
        executeCommand('insertOrderedList');
      }
    } else {
      executeCommand('insertOrderedList');
    }
  };

  const handleContentChange = () => {
    if (editorRef.current && onChange) {
      const content = editorRef.current.innerHTML;
      
      // Check max length
      if (maxLength && editorRef.current.textContent.length > maxLength) {
        return;
      }
      
      console.log('Content changed, length:', content.length); // Debug log
      onChange(content);
      updateCounts();
      saveToHistory(content);
    }
  };

  // Advanced formatting functions
  const insertHeading = (level) => {
    executeCommand('formatBlock', `h${level}`);
    setSelectedFormat(`h${level}`);
  };

  const insertParagraph = () => {
    executeCommand('formatBlock', 'p');
    setSelectedFormat('paragraph');
  };

  const insertBlockquote = () => {
    executeCommand('formatBlock', 'blockquote');
    setSelectedFormat('blockquote');
  };

  const insertCodeBlock = () => {
    executeCommand('formatBlock', 'pre');
    setSelectedFormat('pre');
  };

  const insertHorizontalRule = () => {
    executeCommand('insertHorizontalRule');
  };

  // Table insertion
  const insertTable = () => {
    if (tableRows > 0 && tableCols > 0) {
      let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 1em 0;">';
      
      // Create table header row (optional, but good practice)
      tableHTML += '<thead><tr>';
      for (let j = 0; j < tableCols; j++) {
        tableHTML += `<th style="padding: 12px; border: 1px solid #ccc; background-color: #f5f5f5; font-weight: bold; text-align: left;">Header ${j + 1}</th>`;
      }
      tableHTML += '</tr></thead>';
      
      // Create table body
      tableHTML += '<tbody>';
      for (let i = 0; i < tableRows; i++) {
        tableHTML += '<tr>';
        for (let j = 0; j < tableCols; j++) {
          tableHTML += '<td style="padding: 12px; border: 1px solid #ccc; min-width: 100px;">&nbsp;</td>';
        }
        tableHTML += '</tr>';
      }
      tableHTML += '</tbody></table>';
      
      // Insert the table
      executeCommand('insertHTML', tableHTML);
      
      // Close dialog and reset values
      setShowTableDialog(false);
      setTableRows(3);
      setTableCols(3);
    }
  };

  // Enhanced link insertion
  const insertAdvancedLink = () => {
    if (linkUrl && linkText) {
      const linkHTML = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      executeCommand('insertHTML', linkHTML);
      setShowLinkDialog(false);
      setLinkUrl('');
      setLinkText('');
    }
  };

  // Enhanced image insertion
  const insertAdvancedImage = () => {
    if (imageUrl) {
      console.log('Inserting image:', imageUrl); // Debug log
      
      // Focus the editor first
      editorRef.current.focus();
      
      // Create image HTML string
      let imageHTML = `<img src="${imageUrl}" alt="${imageAlt || 'Inserted image'}"`;
      if (imageWidth) imageHTML += ` width="${imageWidth}"`;
      if (imageHeight) imageHTML += ` height="${imageHeight}"`;
      imageHTML += ` style="max-width: 100%; height: auto; display: block; margin: 0.5em 0;" />`;
      
      // Try multiple insertion methods for better compatibility
      try {
        // Method 1: Use insertHTML if available
        if (document.execCommand('insertHTML', false, imageHTML)) {
          console.log('Image inserted using execCommand');
        } else {
          throw new Error('execCommand failed');
        }
      } catch (error) {
        console.log('execCommand failed, trying DOM insertion');
        
        // Method 2: Direct DOM insertion
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = imageHTML;
          const img = tempDiv.firstChild;
          
          range.insertNode(img);
          range.setStartAfter(img);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // Method 3: Append to editor
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = imageHTML;
          editorRef.current.appendChild(tempDiv.firstChild);
        }
      }
      
      // Force content update
      setTimeout(() => {
        handleContentChange();
      }, 100);
      
      // Close dialog and reset
      setShowImageDialog(false);
      setImageUrl('');
      setImageAlt('');
      setImageWidth('');
      setImageHeight('');
    }
  };

  // File operations
  const insertImageFromFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        notification().error('Please select an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        notification().error('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageDataUrl = event.target.result;
        
        // Always insert directly, no dialog
        insertImageDirectly(imageDataUrl, file.name);
      };
      reader.readAsDataURL(file);
    }
    
    // Reset the file input so the same file can be selected again
    e.target.value = '';
  };

  // Direct image insertion function
  const insertImageDirectly = (src, fileName = 'image') => {
    console.log('Direct image insertion:', src.substring(0, 50) + '...'); // Debug log
    
    // Focus the editor
    editorRef.current.focus();
    
    // Create image HTML
    const imageHTML = `<img src="${src}" alt="${fileName.split('.')[0]}" style="max-width: 100%; height: auto; display: block; margin: 0.5em 0;" />`;
    
    // Try multiple insertion methods
    try {
      if (document.execCommand('insertHTML', false, imageHTML)) {
        console.log('Direct image inserted using execCommand');
      } else {
        throw new Error('execCommand failed');
      }
    } catch (error) {
      console.log('execCommand failed, trying DOM insertion for direct image');
      
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = imageHTML;
        const img = tempDiv.firstChild;
        
        range.insertNode(img);
        range.setStartAfter(img);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = imageHTML;
        editorRef.current.appendChild(tempDiv.firstChild);
      }
    }
    
    // Force content update
    setTimeout(() => {
      handleContentChange();
    }, 100);
  };

  // Handle drag and drop for images
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Add visual feedback
    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#374151' : '#f3f4f6';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Remove visual feedback
    e.currentTarget.style.backgroundColor = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Remove visual feedback
    e.currentTarget.style.backgroundColor = '';
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      if (imageFile.size > 5 * 1024 * 1024) {
        notification().error('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageDataUrl = event.target.result;
        insertImageDirectly(imageDataUrl, imageFile.name);
      };
      reader.readAsDataURL(imageFile);
    }
  };

  // Find and replace functionality
  const findInText = () => {
    if (findText) {
      window.find(findText, false, false, true, false, true, false);
    }
  };

  const replaceInText = () => {
    if (findText && replaceText && editorRef.current) {
      const content = editorRef.current.innerHTML;
      const newContent = content.replace(new RegExp(findText, 'gi'), replaceText);
      editorRef.current.innerHTML = newContent;
      handleContentChange();
    }
  };

  // Export/Import functions
  const exportAsHTML = () => {
    const content = editorRef.current?.innerHTML || '';
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsText = () => {
    const content = editorRef.current?.textContent || '';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clipboard operations
  const copyContent = () => {
    if (editorRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('copy');
      selection.removeAllRanges();
    }
  };

  const cutContent = () => {
    copyContent();
    executeCommand('selectAll');
    executeCommand('delete');
  };

  // Undo/Redo with history
  const undoAction = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const content = history[newIndex];
      editorRef.current.innerHTML = content;
      onChange(content);
      updateCounts();
    }
  };

  const redoAction = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const content = history[newIndex];
      editorRef.current.innerHTML = content;
      onChange(content);
      updateCounts();
    }
  };

  const changeFontSize = (size) => {
    executeCommand('fontSize', size);
    setCurrentFontSize(size);
  };

  const changeTextColor = (color) => {
    executeCommand('foreColor', color);
  };

  const changeBackgroundColor = (color) => {
    executeCommand('hiliteColor', color);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if (readOnly) return;

    // Custom shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          if (e.shiftKey) {
            e.preventDefault();
            redoAction();
          } else {
            e.preventDefault();
            undoAction();
          }
          break;
        case 'y':
          e.preventDefault();
          redoAction();
          break;
        case 'f':
          e.preventDefault();
          setShowFindReplace(true);
          break;
        case 's':
          e.preventDefault();
          if (autoSave) {
            localStorage.setItem('richTextEditor_autoSave', value);
          }
          break;
        // List shortcuts
        case 'l':
          if (e.shiftKey) {
            e.preventDefault();
            insertNumberedList();
          } else {
            e.preventDefault();
            insertBulletList();
          }
          break;
      }
    }

    // Handle Enter key in lists
    if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const listItem = range.commonAncestorContainer.closest ? 
          range.commonAncestorContainer.closest('li') : 
          null;
        
        if (listItem && listItem.textContent.trim() === '') {
          // If empty list item, exit the list
          e.preventDefault();
          executeCommand('outdent');
        }
      }
    }
  };

  const toolbarButtons = [
    {
      group: 'format',
      buttons: [
        { icon: Bold, command: 'bold', title: 'Bold (Ctrl+B)' },
        { icon: Italic, command: 'italic', title: 'Italic (Ctrl+I)' },
        { icon: Underline, command: 'underline', title: 'Underline (Ctrl+U)' },
        { icon: Strikethrough, command: 'strikeThrough', title: 'Strikethrough' },
        { icon: Subscript, command: 'subscript', title: 'Subscript' },
        { icon: Superscript, command: 'superscript', title: 'Superscript' },
      ]
    },
    {
      group: 'align',
      buttons: [
        { icon: AlignLeft, command: 'justifyLeft', title: 'Align Left' },
        { icon: AlignCenter, command: 'justifyCenter', title: 'Align Center' },
        { icon: AlignRight, command: 'justifyRight', title: 'Align Right' },
        { icon: AlignJustify, command: 'justifyFull', title: 'Justify' },
      ]
    },
    {
      group: 'indent',
      buttons: [
        { icon: Indent, command: 'indent', title: 'Increase Indent' },
        { icon: Outdent, command: 'outdent', title: 'Decrease Indent' },
      ]
    },
    {
      group: 'list',
      buttons: [
        { icon: List, action: insertBulletList, title: 'Bullet List (Ctrl+L)' },
        { icon: ListOrdered, action: insertNumberedList, title: 'Numbered List (Ctrl+Shift+L)' },
      ]
    },
    {
      group: 'insert',
      buttons: [
        { icon: Link, action: () => setShowLinkDialog(true), title: 'Insert Link' },
        { icon: Image, action: insertImageFromFile, title: 'Upload Image Directly' },
        { icon: Download, action: () => setShowImageDialog(true), title: 'Insert Image from URL' },
        { icon: Table, action: () => setShowTableDialog(true), title: 'Insert Table' },
        { icon: Quote, action: insertBlockquote, title: 'Insert Quote' },
        { icon: Code, action: insertCodeBlock, title: 'Code Block' },
        { icon: Minus, action: insertHorizontalRule, title: 'Horizontal Rule' },
      ]
    },
    {
      group: 'clipboard',
      buttons: [
        { icon: Copy, action: copyContent, title: 'Copy All (Ctrl+A, Ctrl+C)' },
        { icon: Scissors, action: cutContent, title: 'Cut All' },
      ]
    },
    {
      group: 'history',
      buttons: [
        { icon: Undo, action: undoAction, title: 'Undo (Ctrl+Z)' },
        { icon: Redo, action: redoAction, title: 'Redo (Ctrl+Y)' },
      ]
    },
    {
      group: 'tools',
      buttons: [
        { icon: Search, action: () => setShowFindReplace(true), title: 'Find & Replace (Ctrl+F)' },
        { icon: Eye, action: () => setShowPreview(!showPreview), title: 'Toggle Preview' },
        { icon: isFullscreen ? Minimize2 : Maximize2, action: () => setIsFullscreen(!isFullscreen), title: 'Toggle Fullscreen' },
      ]
    }
  ];

  const fontSizes = [
    { label: 'Tiny', value: '1' },
    { label: 'Small', value: '2' },
    { label: 'Normal', value: '3' },
    { label: 'Medium', value: '4' },
    { label: 'Large', value: '5' },
    { label: 'Extra Large', value: '6' },
    { label: 'Huge', value: '7' }
  ];

  const fontFamilies = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Courier New', value: 'Courier New, monospace' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
    { label: 'Impact', value: 'Impact, sans-serif' }
  ];

  const formatOptions = [
    { label: 'Paragraph', value: 'paragraph', action: insertParagraph },
    { label: 'Heading 1', value: 'h1', action: () => insertHeading(1) },
    { label: 'Heading 2', value: 'h2', action: () => insertHeading(2) },
    { label: 'Heading 3', value: 'h3', action: () => insertHeading(3) },
    { label: 'Heading 4', value: 'h4', action: () => insertHeading(4) },
    { label: 'Heading 5', value: 'h5', action: () => insertHeading(5) },
    { label: 'Heading 6', value: 'h6', action: () => insertHeading(6) },
    { label: 'Quote', value: 'blockquote', action: insertBlockquote },
    { label: 'Code', value: 'pre', action: insertCodeBlock }
  ];

  const textColors = [
    '#000000', '#333333', '#666666', '#999999', '#CCCCCC',
    '#FF0000', '#FF6B6B', '#FF9999', '#FFCCCC',
    '#00FF00', '#6BFF6B', '#99FF99', '#CCFFCC',
    '#0000FF', '#6B6BFF', '#9999FF', '#CCCCFF',
    '#FFFF00', '#FFFF6B', '#FFFF99', '#FFFFCC',
    '#FF00FF', '#FF6BFF', '#FF99FF', '#FFCCFF',
    '#00FFFF', '#6BFFFF', '#99FFFF', '#CCFFFF',
    '#FFA500', '#FFB366', '#FFC999', '#FFDCCC',
    '#800080', '#9966B3', '#B399CC', '#CCCCDD'
  ];

  const backgroundColors = [
    '#FFFFFF', '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA',
    '#FFE6E6', '#E6F7FF', '#F6FFED', '#FFF7E6', '#F9F0FF',
    '#E6F4FF', '#FFF0F6', '#F0F9FF', '#FFFBE6', '#F6F6F6'
  ];

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'relative'} ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
      <div className={`border border-gray-300 rounded-lg overflow-hidden ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
        {/* Enhanced Toolbar */}
        <div className={`${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-300'} border-b p-2`}>
          {/* First Row - Format and Font Controls */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {/* Format Dropdown */}
            <select
              value={selectedFormat}
              onChange={(e) => {
                const option = formatOptions.find(opt => opt.value === e.target.value);
                if (option) {
                  option.action();
                }
              }}
              className={`text-sm border rounded px-2 py-1 min-w-[120px] ${
                theme === 'dark' 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              title="Text Format"
              disabled={readOnly}
            >
              {formatOptions.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>

            {/* Font Family Dropdown */}
            <select
              onChange={(e) => executeCommand('fontName', e.target.value)}
              className={`text-sm border rounded px-2 py-1 min-w-[140px] ${
                theme === 'dark' 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              title="Font Family"
              disabled={readOnly}
            >
              <option value="">Font Family</option>
              {fontFamilies.map((font) => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </option>
              ))}
            </select>

            {/* Font Size Dropdown */}
            <select
              value={currentFontSize}
              onChange={(e) => changeFontSize(e.target.value)}
              className={`text-sm border rounded px-2 py-1 ${
                theme === 'dark' 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              title="Font Size"
              disabled={readOnly}
            >
              {fontSizes.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>

            {/* Text Color */}
            <div className="flex items-center gap-1">
              <Type size={16} className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} />
              <input
                type="color"
                onChange={(e) => changeTextColor(e.target.value)}
                className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                title="Text Color"
                disabled={readOnly}
              />
            </div>

            {/* Background Color */}
            <div className="flex items-center gap-1">
              <Palette size={16} className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} />
              <input
                type="color"
                onChange={(e) => changeBackgroundColor(e.target.value)}
                className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                title="Background Color"
                disabled={readOnly}
              />
            </div>

            {/* Export Options */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={exportAsHTML}
                className={`p-1.5 rounded transition-colors ${
                  theme === 'dark'
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                }`}
                title="Export as HTML"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={exportAsText}
                className={`p-1.5 rounded transition-colors ${
                  theme === 'dark'
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                }`}
                title="Export as Text"
              >
                <FileText size={16} />
              </button>
            </div>
          </div>

          {/* Second Row - Toolbar Button Groups */}
          <div className="flex flex-wrap items-center gap-1">
            {toolbarButtons.map((group, groupIndex) => (
              <div key={group.group} className="flex items-center gap-1">
                {group.buttons.map((button, buttonIndex) => {
                  const Icon = button.icon;
                  return (
                    <button
                      key={buttonIndex}
                      type="button"
                      onClick={() => button.action ? button.action() : executeCommand(button.command)}
                      className={`p-1.5 rounded transition-colors ${
                        theme === 'dark'
                          ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                      } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={button.title}
                      disabled={readOnly}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
                {groupIndex < toolbarButtons.length - 1 && (
                  <div className={`w-px h-6 mx-1 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Third Row - Quick Colors */}
          <div className={`flex items-center gap-1 mt-2 pt-2 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
            <span className={`text-xs mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Text Colors:
            </span>
            {textColors.slice(0, 12).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => changeTextColor(color)}
                className="w-4 h-4 rounded border border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={`Text Color: ${color}`}
                disabled={readOnly}
              />
            ))}
            <span className={`text-xs ml-4 mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Backgrounds:
            </span>
            {backgroundColors.slice(0, 8).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => changeBackgroundColor(color)}
                className="w-4 h-4 rounded border border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={`Background Color: ${color}`}
                disabled={readOnly}
              />
            ))}
          </div>
        </div>

        {/* Find & Replace Panel */}
        {showFindReplace && (
          <div className={`p-3 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Find..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className={`flex-1 px-2 py-1 text-sm border rounded ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300'
                }`}
              />
              <button
                onClick={findInText}
                className={`px-3 py-1 text-sm rounded ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Find
              </button>
              <button
                onClick={() => setShowFindReplace(false)}
                className={`px-2 py-1 text-sm rounded ${
                  theme === 'dark'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className={`flex-1 px-2 py-1 text-sm border rounded ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300'
                }`}
              />
              <button
                onClick={replaceInText}
                className={`px-3 py-1 text-sm rounded ${
                  theme === 'dark'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                Replace All
              </button>
            </div>
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex" style={{ height: isFullscreen ? 'calc(100vh - 200px)' : height }}>
          {/* Editor */}
          <div className={`flex-1 ${showPreview ? 'w-1/2' : 'w-full'}`}>
            <div
              ref={editorRef}
              contentEditable={!readOnly}
              onInput={handleContentChange}
              onFocus={() => setIsEditorFocused(true)}
              onBlur={() => setIsEditorFocused(false)}
              onKeyDown={handleKeyDown}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`h-full p-4 outline-none overflow-auto transition-colors ${
                isEditorFocused ? 'ring-2 ring-blue-500 ring-inset' : ''
              } ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
              style={{
                lineHeight: '1.6',
                fontSize: '14px'
              }}
              suppressContentEditableWarning={true}
              data-placeholder={placeholder}
              spellCheck={spellCheck}
            />
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className={`w-1/2 border-l ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
              <div className={`h-8 px-3 py-1 text-sm font-medium border-b flex items-center ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-600 text-gray-300' 
                  : 'bg-gray-100 border-gray-300 text-gray-700'
              }`}>
                Preview
              </div>
              <div 
                className={`h-full p-4 overflow-auto ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-50'}`}
                dangerouslySetInnerHTML={{ __html: value || '' }}
              />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className={`px-4 py-2 text-xs flex justify-between items-center border-t ${
          theme === 'dark' 
            ? 'bg-gray-800 border-gray-600 text-gray-400' 
            : 'bg-gray-50 border-gray-300 text-gray-500'
        }`}>
          <div className="flex items-center gap-4">
            {showCharCount && <span>Characters: {charCount}</span>}
            {showWordCount && <span>Words: {wordCount}</span>}
            {maxLength && <span>Limit: {charCount}/{maxLength}</span>}
            {autoSave && <span className="text-green-600">Auto-save enabled</span>}
          </div>
          <div className="flex items-center gap-2">
            <span>History: {historyIndex + 1}/{history.length}</span>
            {readOnly && <span className="text-orange-600">Read Only</span>}
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Insert Link
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Link text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className={`w-full px-3 py-2 border rounded ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300'
                }`}
              />
              <input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className={`w-full px-3 py-2 border rounded ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300'
                }`}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowLinkDialog(false)}
                className={`px-4 py-2 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={insertAdvancedLink}
                className={`px-4 py-2 rounded ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Dialog */}
      {showImageDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-[500px] max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Insert Image
            </h3>
            
            <div className="space-y-4">
              {/* Upload Section */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Upload Image
                </label>
                <div
                  onClick={insertImageFromFile}
                  className={`w-full p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                    theme === 'dark'
                      ? 'border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Image size={48} className={`mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                    <p className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Click to upload image
                    </p>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Or drag and drop an image here
                    </p>
                    <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      Supports: JPG, PNG, GIF, WebP (Max 5MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center">
                <div className={`flex-1 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}></div>
                <span className={`px-3 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>OR</span>
                <div className={`flex-1 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}></div>
              </div>

              {/* URL Section */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 placeholder-gray-500'
                  }`}
                />
              </div>

              {/* Image Preview */}
              {imageUrl && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Preview
                  </label>
                  <div className={`border rounded-lg p-3 ${theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="max-w-full max-h-48 mx-auto rounded"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                      onLoad={(e) => {
                        e.target.style.display = 'block';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Image Properties */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Alt Text (for accessibility)
                  </label>
                  <input
                    type="text"
                    placeholder="Describe the image..."
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      theme === 'dark' 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 placeholder-gray-500'
                    }`}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Width (px)
                    </label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={imageWidth}
                      onChange={(e) => setImageWidth(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        theme === 'dark' 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 placeholder-gray-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      Height (px)
                    </label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={imageHeight}
                      onChange={(e) => setImageHeight(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        theme === 'dark' 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 placeholder-gray-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-300">
              <button
                onClick={() => {
                  setShowImageDialog(false);
                  setImageUrl('');
                  setImageAlt('');
                  setImageWidth('');
                  setImageHeight('');
                }}
                className={`px-4 py-2 rounded-lg ${
                  theme === 'dark'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={insertAdvancedImage}
                disabled={!imageUrl}
                className={`px-6 py-2 rounded-lg ${
                  !imageUrl
                    ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                    : theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Insert Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Dialog */}
      {showTableDialog && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-80 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Insert Table
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Rows: {tableRows}
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={tableRows}
                  onChange={(e) => setTableRows(parseInt(e.target.value))}
                  className="w-full mb-2"
                />
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={tableRows}
                  onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                  className={`w-full px-3 py-2 border rounded ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Columns: {tableCols}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={tableCols}
                  onChange={(e) => setTableCols(parseInt(e.target.value))}
                  className="w-full mb-2"
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tableCols}
                  onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                  className={`w-full px-3 py-2 border rounded ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300'
                  }`}
                />
              </div>
              
              {/* Table Preview */}
              <div className="mt-4">
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Preview: {tableRows} × {tableCols} table
                </label>
                <div className={`border rounded p-2 ${theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(tableCols, 5)}, 1fr)` }}>
                    {Array.from({ length: Math.min(tableRows * tableCols, 25) }, (_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 border ${theme === 'dark' ? 'border-gray-500 bg-gray-600' : 'border-gray-400 bg-white'}`}
                      />
                    ))}
                    {tableRows * tableCols > 25 && (
                      <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        ...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowTableDialog(false);
                  setTableRows(3);
                  setTableCols(3);
                }}
                className={`px-4 py-2 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={insertTable}
                disabled={tableRows < 1 || tableCols < 1}
                className={`px-4 py-2 rounded ${
                  tableRows < 1 || tableCols < 1
                    ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                    : theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Insert Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Custom Styles for Editor */}
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: ${theme === 'dark' ? '#9ca3af' : '#9ca3af'};
          font-style: italic;
        }
        
        [contenteditable] h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
          line-height: 1.2;
        }
        
        [contenteditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0;
          line-height: 1.3;
        }
        
        [contenteditable] h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin: 0.83em 0;
          line-height: 1.4;
        }
        
        [contenteditable] h4 {
          font-size: 1em;
          font-weight: bold;
          margin: 1.12em 0;
        }
        
        [contenteditable] h5 {
          font-size: 0.83em;
          font-weight: bold;
          margin: 1.5em 0;
        }
        
        [contenteditable] h6 {
          font-size: 0.75em;
          font-weight: bold;
          margin: 1.67em 0;
        }
        
        [contenteditable] p {
          margin: 1em 0;
        }
        
        [contenteditable] ul, [contenteditable] ol {
          margin: 1em 0;
          padding-left: 2em;
        }
        
        [contenteditable] ul {
          list-style-type: disc;
        }
        
        [contenteditable] ol {
          list-style-type: decimal;
        }
        
        [contenteditable] ul ul {
          list-style-type: circle;
          margin: 0.5em 0;
        }
        
        [contenteditable] ol ol {
          list-style-type: lower-alpha;
          margin: 0.5em 0;
        }
        
        [contenteditable] li {
          margin: 0.5em 0;
          display: list-item;
        }
        
        [contenteditable] li p {
          margin: 0.25em 0;
        }
        
        [contenteditable] a {
          color: #3b82f6;
          text-decoration: underline;
        }
        
        [contenteditable] a:hover {
          color: #2563eb;
        }
        
        [contenteditable] img {
          max-width: 100%;
          height: auto;
          margin: 0.5em 0;
          border-radius: 4px;
        }
        
        [contenteditable] blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: #6b7280;
          background-color: ${theme === 'dark' ? '#374151' : '#f9fafb'};
          padding: 1em;
          border-radius: 4px;
        }
        
        [contenteditable] pre {
          background-color: ${theme === 'dark' ? '#1f2937' : '#f3f4f6'};
          border: 1px solid ${theme === 'dark' ? '#374151' : '#d1d5db'};
          border-radius: 4px;
          padding: 1em;
          margin: 1em 0;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }
        
        [contenteditable] code {
          background-color: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }
        
        [contenteditable] table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          font-size: inherit;
        }
        
        [contenteditable] table td, [contenteditable] table th {
          border: 1px solid ${theme === 'dark' ? '#4b5563' : '#d1d5db'};
          padding: 12px;
          text-align: left;
          vertical-align: top;
          min-width: 100px;
        }
        
        [contenteditable] table th {
          background-color: ${theme === 'dark' ? '#374151' : '#f9fafb'};
          font-weight: bold;
        }
        
        [contenteditable] table tr:nth-child(even) {
          background-color: ${theme === 'dark' ? '#1f2937' : '#f9fafb'};
        }
        
        [contenteditable] table tr:hover {
          background-color: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
        }
        
        [contenteditable] table td:focus, [contenteditable] table th:focus {
          outline: 2px solid #3b82f6;
          outline-offset: -2px;
        }
        
        [contenteditable] hr {
          border: none;
          border-top: 2px solid ${theme === 'dark' ? '#4b5563' : '#e5e7eb'};
          margin: 2em 0;
        }
        
        [contenteditable] sup {
          vertical-align: super;
          font-size: smaller;
        }
        
        [contenteditable] sub {
          vertical-align: sub;
          font-size: smaller;
        }
        
        [contenteditable]:focus {
          outline: none;
        }
        
        /* Selection styles */
        [contenteditable]::selection {
          background-color: #3b82f6;
          color: white;
        }
        
        /* Responsive table */
        @media (max-width: 768px) {
          [contenteditable] table {
            font-size: 0.9em;
          }
          
          [contenteditable] table td, [contenteditable] table th {
            padding: 6px 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
