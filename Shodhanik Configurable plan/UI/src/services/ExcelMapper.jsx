import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle, Download, Edit3 } from 'lucide-react';

const ExcelMapper = ({ predefinedFields, onDataChange, onFileReset, debugMode = false, exportJsonEnabled }) => {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [excelData, setExcelData] = useState([]);
  const [unmappedFields, setUnmappedFields] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showManualMapping, setShowManualMapping] = useState(false);

  // Auto-mapping function
  const autoMapHeaders = useCallback((csvHeaders) => {
    const mapping = {};
    const unmapped = [];

    predefinedFields.forEach(field => {
      const matchedHeader = csvHeaders.find(header => {
        const headerLower = header.toLowerCase().trim();
        return field.variations.some(variation =>
          headerLower === variation || headerLower.includes(variation)
        );
      });

      if (matchedHeader) {
        mapping[field.key] = matchedHeader;
      } else if (field.required) {
        unmapped.push(field);
      }
    });

    return { mapping, unmapped };
  }, [predefinedFields]);

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    // Support all Excel and CSV formats
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please select a valid file (.xlsx, .xls, .csv)');
      return;
    }

    setFile(selectedFile);
    setError('');
    setIsProcessing(true);

    try {
      let csvHeaders = [];
      let csvData = [];

      // Check if it's a CSV file (including CSV-UTF-8)
      if (selectedFile.name.match(/\.csv$/i)) {
        // Handle CSV files (including UTF-8)
        const text = await selectedFile.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
          throw new Error('CSV file is empty');
        }

        // Parse CSV data with better handling for quotes and commas
        csvHeaders = parseCSVLine(lines[0]);
        csvData = lines.slice(1).map(line => parseCSVLine(line));
      } else {
        // Handle Excel files (.xlsx, .xls) using SheetJS
        const arrayBuffer = await selectedFile.arrayBuffer();

        // Import XLSX dynamically
        const XLSX = await import('xlsx');

        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellText: true,
          cellDates: true
        });

        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          throw new Error('No worksheet found in Excel file');
        }

        // Convert worksheet to array of arrays
        const data = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false
        });

        if (data.length === 0) {
          throw new Error('Excel file is empty');
        }

        csvHeaders = data[0].map(header => (header || '').toString().trim());
        csvData = data.slice(1).map(row =>
          row.map(cell => (cell || '').toString().trim())
        );
      }

      // Filter out completely empty rows
      csvData = csvData.filter(row => row.some(cell => cell && cell.trim()));

      if (csvHeaders.length === 0) {
        throw new Error('No headers found in file');
      }

      if (csvData.length === 0) {
        throw new Error('No data rows found in file');
      }

      setHeaders(csvHeaders);
      setRawData(csvData);

      // Auto-map headers
      const { mapping, unmapped } = autoMapHeaders(csvHeaders);
      setFieldMapping(mapping);
      setUnmappedFields(unmapped);

      // Always show manual mapping option
      setShowManualMapping(true);

      // If all required fields are mapped, process data immediately
      if (unmapped.length === 0) {
        processData(csvData, csvHeaders, mapping);
      }

    } catch (err) {
      setError('Error reading file: ' + err.message);
      console.error('File upload error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to properly parse CSV lines
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
      i++;
    }

    result.push(current.trim());
    return result;
  };

  const handleManualMapping = (fieldKey, selectedHeader) => {
    const newMapping = {
      ...fieldMapping,
      [fieldKey]: selectedHeader === '' ? undefined : selectedHeader
    };

    setFieldMapping(newMapping);

    // Update unmapped fields (only required fields)
    const stillUnmapped = predefinedFields.filter(field =>
      field.required && !newMapping[field.key]
    );
    setUnmappedFields(stillUnmapped);

    // Auto-process if all required fields are mapped
    if (stillUnmapped.length === 0) {
      processData(rawData, headers, newMapping);
    }
  };

  //processed data for payload
  const processData = useCallback((data = rawData, headerList = headers, mapping = fieldMapping) => {
    const processed = data.map((row, index) => {
      const mappedRow = { id: index + 1 };

      Object.entries(mapping).forEach(([fieldKey, headerName]) => {
        if (headerName) {
          const headerIndex = headerList.indexOf(headerName);
          mappedRow[fieldKey] = headerIndex !== -1 ? (row[headerIndex] || '').toString().trim() : '';
        }
      });

      return mappedRow;
    });

    setExcelData(processed);
    return processed;
  }, [rawData, headers, fieldMapping]);

  const handleCompleteMapping = () => {
    if (unmappedFields.length > 0) {
      setError('Please map all required fields before proceeding');
      return;
    }

    const processed = processData();
    // console.log('Excel data ready for payload:', processed);
  };

  const resetImport = () => {
    setFile(null);
    setHeaders([]);
    setRawData([]);
    setFieldMapping({});
    setExcelData([]);
    setUnmappedFields([]);
    setShowManualMapping(false);
    setError('');
    
    // FIXED: Call parent's reset callback to clear parent component states
    if (onFileReset) {
      onFileReset();
    }
  };

  const exportProcessedData = () => {
    if (excelData.length === 0) return;

    const dataStr = JSON.stringify(excelData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (onDataChange && excelData.length > 0) {
      onDataChange(excelData);
    }
    // FIXED: Also call onDataChange when excelData becomes empty
    else if (onDataChange && excelData.length === 0) {
      onDataChange([]);
    }
  }, [excelData, onDataChange]);

  return (
    <div className="bg-gray-50">
      {/* File Upload Section */}
      <div className="p-2 border-b border-gray-200">
        <h2 className="text-md font-semibold text-slate-900 mb-2">{file? "" : "Upload File:"}</h2>
        <div className="">
          {!file ?
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-lg font-medium text-slate-900 mb-1">
                  {file ? file.name : 'Select Excel or CSV file'}
                </p>
                <p className="text-sm text-slate-500">
                  Supports .xlsx, .xls, .csv, and CSV-UTF-8 files
                </p>
              </label>
            </div> : <div className="mt-4 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <FileSpreadsheet className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <span className="text-md font-medium text-slate-900">{file.name}</span>
                  <span className="text-xs text-slate-500 block">
                    {headers.length > 0 && `${headers.length} columns, ${rawData.length} rows`}
                  </span>
                </div>
              </div>
              <button
                onClick={resetImport}
                className="text-md text-slate-500 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            </div>}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {isProcessing && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-slate-600">Processing file...</p>
          </div>
        )}
      </div>

      {/* Field Mapping Section */}
      {headers.length > 0 && !isProcessing && showManualMapping && (
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Field Mapping</h2>
            <div className="flex items-center space-x-2">
              <Edit3 className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-600">Customize field mapping</span>
            </div>
          </div>

          {/* Auto-mapped fields summary */}
          {Object.keys(fieldMapping).length > 0 && (
            <div className="mb-4 p-3 bg-green-50 rounded-lg">
              <h3 className="text-sm font-medium text-green-700 mb-1">
                ✅ {Object.keys(fieldMapping).length} field(s) auto-mapped
              </h3>
              <p className="text-xs text-green-600">
                Fields were automatically matched based on column headers
              </p>
            </div>
          )}

          {/* Manual mapping for all fields */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Map Your Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {predefinedFields.map(field => (
                <div key={field.key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                    {fieldMapping[field.key] && (
                      <Check className="inline h-4 w-4 text-green-600 ml-2" />
                    )}
                  </label>
                  <select
                    value={fieldMapping[field.key] || ''}
                    onChange={(e) => handleManualMapping(field.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${field.required && !fieldMapping[field.key]
                      ? 'border-red-300 bg-red-50'
                      : fieldMapping[field.key]
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300'
                      }`}
                  >
                    <option value="">Select column...</option>
                    {headers.map(header => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  {field.required && !fieldMapping[field.key] && (
                    <p className="text-xs text-red-600">This field is required</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Unmapped required fields warning */}
          {unmappedFields.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <span className="text-sm text-red-700 font-medium">
                  {unmappedFields.length} required field(s) not mapped:
                </span>
              </div>
              <ul className="mt-1 text-sm text-red-600 ml-6">
                {unmappedFields.map(field => (
                  <li key={field.key}>• {field.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Processed Data Summary */}
      {excelData.length > 0 && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Data Ready</h2>
              <p className="text-sm text-slate-600">{excelData.length} records processed and ready for payload</p>
            </div>
            {exportJsonEnabled && (
              <button
                onClick={exportProcessedData}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm"
              >
                <Download className="h-4 w-4" />
                <span>Export JSON</span>
              </button>
            )}
          </div>

          {/* Sample data preview */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-900 mb-2">Data Preview (first 3 records)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse bg-white rounded border">
                <thead>
                  <tr className="bg-slate-100">
                    {predefinedFields
                      .filter(field => fieldMapping[field.key])
                      .map(field => (
                        <th key={field.key} className="text-left py-2 px-3 font-medium text-slate-900 border-b">
                          {field.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {excelData.slice(0, 3).map((row, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      {predefinedFields
                        .filter(field => fieldMapping[field.key])
                        .map(field => (
                          <td key={field.key} className="py-2 px-3 text-slate-700">
                            {row[field.key] || '-'}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Debug info */}
      {(excelData.length > 0 && debugMode) && (
        <div className="mt-6 bg-slate-900 text-green-400 p-4 rounded-lg">
          <h3 className="text-sm font-bold mb-2">Console Output (for debugging):</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({
              fileType: file?.name.match(/\.csv$/i) ? 'CSV' : 'Excel',
              fileName: file?.name,
              totalRecords: excelData.length,
              fieldMapping: fieldMapping,
              sampleRecord: excelData[0]
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ExcelMapper;

//----------------- Example Usage -----------------
/*
import ExcelMapper from '@/services/ExcelMapper';
import React, { useState } from 'react'

const ExcelUploadDemo = () => {
  const [myData, setMyData] = useState([]);//data to send in payload

  const predefinedFields = [
    { key: 'names', label: 'Names', required: true, variations: ['names', 'name', 'full name', 'full_name', 'customer name', 'employee name'] },
    { key: 'contact', label: 'Contact', required: true, variations: ['contact', 'phone', 'mobile', 'phone number', 'mobile number', 'contact number'] },
    { key: 'positions', label: 'Positions', required: true, variations: ['positions', 'position', 'title', 'job title', 'designation', 'role', 'job position'] }
  ];

  // Callback function to receive data from child
  const handleDataChange = (newData) => {
    setMyData(newData);
    console.log('Received Data:', newData);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <ExcelMapper
            predefinedFields={predefinedFields}
            onDataChange={handleDataChange}
            debugMode={false}
            exportJsonEnabled={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ExcelUploadDemo;

*/