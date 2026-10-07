import React, { useState, useEffect } from "react";

// Recursive component for modules
const PermissionNode = ({ node, selectedPermissions, onChange }) => {
  const [expanded, setExpanded] = useState(true);

  const handleActionChange = (action) => {
    const permKey = `${node.key}.${action}`;
    if (selectedPermissions.includes(permKey)) {
      onChange(selectedPermissions.filter((p) => p !== permKey));
    } else {
      onChange([...selectedPermissions, permKey]);
    }
  };

  return (
    <div className="ml-4 mt-2">
      <div className="flex items-center gap-2 cursor-pointer">
        {node.subModules.length > 0 && (
          <span
            onClick={() => setExpanded(!expanded)}
            className="select-none text-slate-400"
          >
            {expanded ? "▼" : "▶"}
          </span>
        )}
        <span className="font-medium text-slate-700">{node.name}</span>
      </div>

      <div className="ml-6 flex flex-wrap gap-2 mt-1">
        {node.actions.map((action) => {
          const permKey = `${node.key}.${action}`;
          const checked = selectedPermissions.includes(permKey);
          return (
            <label
              key={permKey}
              className={`px-2 py-1 border rounded text-sm cursor-pointer ${checked ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-700 border-slate-200"
                }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleActionChange(action)}
                className="mr-1"
              />
              {action.toUpperCase()}
            </label>
          );
        })}
      </div>

      {expanded &&
        node.subModules.map((sub) => (
          <PermissionNode
            key={sub.key}
            node={sub}
            selectedPermissions={selectedPermissions}
            onChange={onChange}
          />
        ))}
    </div>
  );
};

// Main Permission Builder
export const PermissionBuilder = ({ modulesJson, selectedPermissions, setSelectedPermissions }) => {
  return (
    <div className="max-h-[60vh] overflow-y-auto p-2 border border-slate-200 rounded bg-white">
      {modulesJson.map((mod) => (
        <PermissionNode
          key={mod.key}
          node={mod}
          selectedPermissions={selectedPermissions}
          onChange={setSelectedPermissions}
        />
      ))}
    </div>
  );
};
