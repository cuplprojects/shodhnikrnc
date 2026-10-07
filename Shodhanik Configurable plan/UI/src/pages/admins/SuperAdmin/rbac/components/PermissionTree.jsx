import { useState } from 'react';
import { generateModulesConfig } from '@/services/routeService';

const PermissionsTree = ({ selectedPermissions, onPermissionsChange, disabled = false }) => {
  const [expandedModules, setExpandedModules] = useState({});
  const [expandedSubModules, setExpandedSubModules] = useState({});

  const isDevMode = import.meta.env.VITE_APP_STAGE === 'development'

  // Get modules data from centralized route config
  const modulesData = generateModulesConfig();

  // Toggle module expansion
  const toggleModuleExpansion = (moduleKey) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleKey]: !prev[moduleKey]
    }));
  };

  // Toggle submodule expansion
  const toggleSubModuleExpansion = (subModuleKey) => {
    setExpandedSubModules(prev => ({
      ...prev,
      [subModuleKey]: !prev[subModuleKey]
    }));
  };

  // Smart permission selection with parent-child dependencies
  const handlePermissionToggle = (permissionKey) => {
    const newPermissions = [...selectedPermissions];

    if (newPermissions.includes(permissionKey)) {
      // Deselecting
      if (permissionKey.includes('.')) {
        // It's an action - just remove it
        const filtered = newPermissions.filter(p => p !== permissionKey);
        // Check if we need to remove parent containers
        onPermissionsChange(cleanupParentContainers(filtered, permissionKey));
      } else {
        // It's a parent container - remove all children
        onPermissionsChange(removeAllChildPermissions(newPermissions, permissionKey));
      }
    } else {
      // Selecting
      if (permissionKey.includes('.')) {
        // It's an action - add it and ensure read permission
        onPermissionsChange(addActionWithDependencies(newPermissions, permissionKey));
      } else {
        // It's a parent container - add all its actions
        onPermissionsChange(addAllChildPermissions(newPermissions, permissionKey));
      }
    }
  };

  // Add an action and ensure read permission exists
  const addActionWithDependencies = (permissions, actionKey) => {
    const newPermissions = [...permissions];

    // Add the action itself
    if (!newPermissions.includes(actionKey)) {
      newPermissions.push(actionKey);
    }

    // Find the module/submodule and ensure read permission
    const [moduleOrSubmodule] = actionKey.split('.');

    for (const category of modulesData) {
      for (const module of category.modules) {
        // Check if it's a module action
        if (moduleOrSubmodule === module.key && module.actions && module.actions.includes('view')) {
          const readPermission = `${module.key}.view`;
          if (!newPermissions.includes(readPermission) && actionKey !== readPermission) {
            newPermissions.push(readPermission);
          }
          break;
        }

        // Check submodules
        if (module.modules) {
          for (const subModule of module.modules) {
            if (moduleOrSubmodule === subModule.key) {
              // Add parent module read if exists
              if (module.actions && module.actions.includes('view')) {
                const parentReadPermission = `${module.key}.view`;
                if (!newPermissions.includes(parentReadPermission)) {
                  newPermissions.push(parentReadPermission);
                }
              }

              // Add submodule read if exists
              if (subModule.actions && subModule.actions.includes('view')) {
                const subReadPermission = `${subModule.key}.view`;
                if (!newPermissions.includes(subReadPermission) && actionKey !== subReadPermission) {
                  newPermissions.push(subReadPermission);
                }
              }
              break;
            }
          }
        }
      }
    }

    return newPermissions;
  };

  // Add all child permissions for a module/submodule
  const addAllChildPermissions = (permissions, containerKey) => {
    let newPermissions = [...permissions];

    for (const category of modulesData) {
      for (const module of category.modules) {
        if (containerKey === module.key) {
          // Add all module actions
          if (module.actions) {
            module.actions.forEach(action => {
              const actionKey = `${module.key}.${action}`;
              if (!newPermissions.includes(actionKey)) {
                newPermissions.push(actionKey);
              }
            });
          }

          // Add all submodule actions
          if (module.modules) {
            module.modules.forEach(subModule => {
              if (subModule.actions) {
                subModule.actions.forEach(action => {
                  const actionKey = `${subModule.key}.${action}`;
                  if (!newPermissions.includes(actionKey)) {
                    newPermissions.push(actionKey);
                  }
                });
              }
            });
          }
          break;
        }

        // Check if it's a submodule
        if (module.modules) {
          for (const subModule of module.modules) {
            if (containerKey === subModule.key) {
              // Ensure parent module read exists
              if (module.actions && module.actions.includes('view')) {
                const parentReadPermission = `${module.key}.view`;
                if (!newPermissions.includes(parentReadPermission)) {
                  newPermissions.push(parentReadPermission);
                }
              }

              // Add all submodule actions
              if (subModule.actions) {
                subModule.actions.forEach(action => {
                  const actionKey = `${subModule.key}.${action}`;
                  if (!newPermissions.includes(actionKey)) {
                    newPermissions.push(actionKey);
                  }
                });
              }
              break;
            }
          }
        }
      }
    }

    return newPermissions;
  };

  // Remove all child permissions for a module/submodule
  const removeAllChildPermissions = (permissions, containerKey) => {
    let newPermissions = [...permissions];

    for (const category of modulesData) {
      for (const module of category.modules) {
        if (containerKey === module.key) {
          // Remove all module actions
          if (module.actions) {
            module.actions.forEach(action => {
              newPermissions = newPermissions.filter(p => p !== `${module.key}.${action}`);
            });
          }

          // Remove all submodule actions
          if (module.modules) {
            module.modules.forEach(subModule => {
              if (subModule.actions) {
                subModule.actions.forEach(action => {
                  newPermissions = newPermissions.filter(p => p !== `${subModule.key}.${action}`);
                });
              }
            });
          }
          break;
        }

        // Check if it's a submodule
        if (module.modules) {
          for (const subModule of module.modules) {
            if (containerKey === subModule.key) {
              // Remove all submodule actions
              if (subModule.actions) {
                subModule.actions.forEach(action => {
                  newPermissions = newPermissions.filter(p => p !== `${subModule.key}.${action}`);
                });
              }

              // Check if parent module still has any permissions
              const hasOtherModulePermissions = module.actions && module.actions.some(action =>
                newPermissions.includes(`${module.key}.${action}`)
              );
              const hasOtherSubmodulePermissions = module.modules && module.modules.some(otherSub =>
                otherSub.key !== subModule.key &&
                otherSub.actions && otherSub.actions.some(action => newPermissions.includes(`${otherSub.key}.${action}`))
              );

              // If no other permissions exist for the parent module, remove its read permission
              if (!hasOtherModulePermissions && !hasOtherSubmodulePermissions) {
                newPermissions = newPermissions.filter(p => p !== `${module.key}.view`);
              }
              break;
            }
          }
        }
      }
    }

    return newPermissions;
  };

  // Clean up parent containers that no longer have child permissions
  const cleanupParentContainers = (permissions, removedActionKey) => {
    let newPermissions = [...permissions];
    const [moduleOrSubmodule] = removedActionKey.split('.');

    for (const category of modulesData) {
      for (const module of category.modules) {
        // Check if it's a module action
        if (moduleOrSubmodule === module.key) {
          // If no permissions left, this is handled by the module checkbox logic
          break;
        }

        // Check submodules
        if (module.modules) {
          for (const subModule of module.modules) {
            if (moduleOrSubmodule === subModule.key) {
              // Check if submodule still has any permissions
              const hasSubmodulePermissions = subModule.actions && subModule.actions.some(action =>
                newPermissions.includes(`${subModule.key}.${action}`)
              );

              if (!hasSubmodulePermissions) {
                // Check if parent module still has any permissions
                const hasModulePermissions = module.actions && module.actions.some(action =>
                  newPermissions.includes(`${module.key}.${action}`)
                );
                const hasOtherSubmodulePermissions = module.modules && module.modules.some(otherSub =>
                  otherSub.key !== subModule.key &&
                  otherSub.actions && otherSub.actions.some(action => newPermissions.includes(`${otherSub.key}.${action}`))
                );

                // If no other permissions exist for the parent module, remove its read permission
                if (!hasModulePermissions && !hasOtherSubmodulePermissions) {
                  newPermissions = newPermissions.filter(p => p !== `${module.key}.view`);
                }
              }
              break;
            }
          }
        }
      }
    }

    return newPermissions;
  };

  // Handle module selection (select/deselect all permissions for a module)
  const handleModuleToggle = (module) => {
    // Check if all actual permissions (not container keys) are selected
    const actualPermissions = [];

    // Add module actions
    if (module.actions) {
      module.actions.forEach(action => {
        actualPermissions.push(`${module.key}.${action}`);
      });
    }

    // Add submodule actions
    if (module.modules) {
      module.modules.forEach(subModule => {
        if (subModule.actions) {
          subModule.actions.forEach(action => {
            actualPermissions.push(`${subModule.key}.${action}`);
          });
        }
      });
    }

    const allSelected = actualPermissions.every(p => selectedPermissions.includes(p));

    if (allSelected) {
      // Deselect all - remove all actual permissions for this module
      onPermissionsChange(selectedPermissions.filter(p => !actualPermissions.includes(p)));
    } else {
      // Select all - add all actual permissions for this module
      let newPermissions = [...selectedPermissions];

      // Add module actions
      if (module.actions) {
        module.actions.forEach(action => {
          const actionKey = `${module.key}.${action}`;
          if (!newPermissions.includes(actionKey)) {
            newPermissions.push(actionKey);
          }
        });
      }

      // Add submodule actions with dependencies
      if (module.modules) {
        module.modules.forEach(subModule => {
          // Ensure parent module read exists if needed
          if (module.actions && module.actions.includes('view')) {
            const parentReadPermission = `${module.key}.view`;
            if (!newPermissions.includes(parentReadPermission)) {
              newPermissions.push(parentReadPermission);
            }
          }

          if (subModule.actions) {
            subModule.actions.forEach(action => {
              const actionKey = `${subModule.key}.${action}`;
              if (!newPermissions.includes(actionKey)) {
                newPermissions.push(actionKey);
              }

              // Ensure submodule read exists if selecting other actions
              if (action !== 'view' && subModule.actions.includes('view')) {
                const subReadPermission = `${subModule.key}.view`;
                if (!newPermissions.includes(subReadPermission)) {
                  newPermissions.push(subReadPermission);
                }
              }
            });
          }
        });
      }

      onPermissionsChange(newPermissions);
    }
  };

  // Handle category selection (select/deselect all permissions for a category)
  const handleCategoryToggle = (category) => {
    // Get all permissions in this category
    const categoryPermissions = [];
    category.modules.forEach(module => {
      if (module.actions) {
        module.actions.forEach(action => {
          categoryPermissions.push(`${module.key}.${action}`);
        });
      }
      if (module.modules) {
        module.modules.forEach(subModule => {
          if (subModule.actions) {
            subModule.actions.forEach(action => {
              categoryPermissions.push(`${subModule.key}.${action}`);
            });
          }
        });
      }
    });

    const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p));

    if (allSelected) {
      // Deselect all - remove all category permissions
      onPermissionsChange(selectedPermissions.filter(p => !categoryPermissions.includes(p)));
    } else {
      // Select all - add all category permissions
      const newPermissions = [...new Set([...selectedPermissions, ...categoryPermissions])];
      onPermissionsChange(newPermissions);
    }
  };

  // Handle submodule selection (select/deselect all permissions for a submodule)
  const handleSubModuleToggle = (module, subModule) => {
    // Get all submodule permissions
    const subModulePermissions = [];
    if (subModule.actions) {
      subModule.actions.forEach(action => {
        subModulePermissions.push(`${subModule.key}.${action}`);
      });
    }

    const allSelected = subModulePermissions.every(p => selectedPermissions.includes(p));

    if (allSelected) {
      // Deselect all - remove all submodule permissions
      let newPermissions = selectedPermissions.filter(p => !subModulePermissions.includes(p));

      // Check if parent module still has any permissions
      const hasModulePermissions = module.actions && module.actions.some(action =>
        newPermissions.includes(`${module.key}.${action}`)
      );
      const hasOtherSubmodulePermissions = module.modules && module.modules.some(otherSub =>
        otherSub.key !== subModule.key &&
        otherSub.actions && otherSub.actions.some(action => newPermissions.includes(`${otherSub.key}.${action}`))
      );

      // If no other permissions exist for the parent module, remove its read permission
      if (!hasModulePermissions && !hasOtherSubmodulePermissions) {
        newPermissions = newPermissions.filter(p => p !== `${module.key}.view`);
      }

      onPermissionsChange(newPermissions);
    } else {
      // Select all - add all submodule permissions with dependencies
      let newPermissions = [...selectedPermissions];

      // Ensure parent module read exists if needed
      if (module.actions && module.actions.includes('view')) {
        const parentReadPermission = `${module.key}.view`;
        if (!newPermissions.includes(parentReadPermission)) {
          newPermissions.push(parentReadPermission);
        }
      }

      // Add all submodule actions
      if (subModule.actions) {
        subModule.actions.forEach(action => {
          const actionKey = `${subModule.key}.${action}`;
          if (!newPermissions.includes(actionKey)) {
            newPermissions.push(actionKey);
          }

          // Ensure submodule read exists if selecting other actions
          if (action !== 'view' && subModule.actions.includes('view')) {
            const subReadPermission = `${subModule.key}.view`;
            if (!newPermissions.includes(subReadPermission)) {
              newPermissions.push(subReadPermission);
            }
          }
        });
      }

      onPermissionsChange(newPermissions);
    }
  };

  // Check if full access is selected (removed functionality)
  const hasFullAccess = false;

  return (
    <div>
      <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
        {modulesData.map((category) => {
          // Calculate category-level permissions
          const categoryPermissions = [];
          category.modules.forEach(module => {
            if (module.actions) {
              module.actions.forEach(action => {
                categoryPermissions.push(`${module.key}.${action}`);
              });
            }
            if (module.modules) {
              module.modules.forEach(subModule => {
                if (subModule.actions) {
                  subModule.actions.forEach(action => {
                    categoryPermissions.push(`${subModule.key}.${action}`);
                  });
                }
              });
            }
          });

          const allCategoryPermissionsSelected = categoryPermissions.length > 0 && categoryPermissions.every(p => selectedPermissions.includes(p));
          const someCategoryPermissionsSelected = categoryPermissions.some(p => selectedPermissions.includes(p));

          return (
            <div key={category.name} className="mb-4">
              {/* Category Header with Checkbox */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={allCategoryPermissionsSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someCategoryPermissionsSelected && !allCategoryPermissionsSelected;
                  }}
                  onChange={() => handleCategoryToggle(category)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={disabled || hasFullAccess}
                />
                <h4 className={`font-bold ${hasFullAccess ? 'text-gray-400' : 'text-gray-800'}`}>{category.name}</h4>
              </div>
            {category.modules.map((module) => {
              const isModuleExpanded = expandedModules[module.key];

              // Only consider actual permissions (actions), not container keys
              const actualPermissions = [];
              if (module.actions) {
                module.actions.forEach(action => {
                  actualPermissions.push(`${module.key}.${action}`);
                });
              }
              if (module.modules) {
                module.modules.forEach(subModule => {
                  if (subModule.actions) {
                    subModule.actions.forEach(action => {
                      actualPermissions.push(`${subModule.key}.${action}`);
                    });
                  }
                });
              }

              const allModulePermissionsSelected = actualPermissions.length > 0 && actualPermissions.every(p => selectedPermissions.includes(p));
              const someModulePermissionsSelected = actualPermissions.some(p => selectedPermissions.includes(p));

              return (
                <div key={module.key} className="mb-2 ml-4">
                  {/* Module Header */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleModuleExpansion(module.key)}
                      className={hasFullAccess ? "text-gray-400" : "text-gray-600 hover:text-gray-800"}
                      disabled={disabled || hasFullAccess}
                    >
                      {isModuleExpanded ? '▼' : '▶'}
                    </button>
                    <input
                      type="checkbox"
                      checked={allModulePermissionsSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someModulePermissionsSelected && !allModulePermissionsSelected;
                      }}
                      onChange={() => handleModuleToggle(module)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={disabled || hasFullAccess}
                    />
                    <span className={`font-medium ${hasFullAccess ? 'text-gray-400' : 'text-gray-900'}`}>{module.name}</span>
                  </div>

                  {/* Module Permissions */}
                  {isModuleExpanded && (
                    <div className="ml-4">
                      {/* Module actions */}
                      {module.actions && module.actions.map((action, actionIndex) => {
                        const permissionKey = `${module.key}.${action}`;
                        const isLastAction = actionIndex === module.actions.length - 1 && (!module.modules || module.modules.length === 0);

                        return (
                          <div key={permissionKey} className="flex items-center gap-1">
                            <span className="text-gray-400">
                              {isLastAction && (!module.modules || !module.modules.length) ? '└─' : '├─'}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(permissionKey)}
                              onChange={() => handlePermissionToggle(permissionKey)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              disabled={disabled || hasFullAccess}
                            />
                            <span className={`capitalize ${hasFullAccess ? 'text-gray-400' : 'text-gray-700'}`}>{action}</span>
                          </div>
                        );
                      })}

                      {/* Submodules */}
                      {module.modules && module.modules.map((subModule, subModuleIndex) => {
                        const isLastSubModule = subModuleIndex === module.modules.length - 1;
                        const isSubModuleExpanded = expandedSubModules[subModule.key];

                        return (
                          <div key={subModule.key}>
                            {/* Submodule Header */}
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">
                                {isLastSubModule ? '└─' : '├─'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleSubModuleExpansion(subModule.key)}
                                className={hasFullAccess ? "text-gray-400" : "text-gray-600 hover:text-gray-800"}
                                disabled={disabled || hasFullAccess}
                              >
                                {isSubModuleExpanded ? '▼' : '▶'}
                              </button>
                              <input
                                type="checkbox"
                                checked={subModule.actions ? subModule.actions.every(action => selectedPermissions.includes(`${subModule.key}.${action}`)) : false}
                                ref={(el) => {
                                  if (el && subModule.actions) {
                                    const allSelected = subModule.actions.every(action => selectedPermissions.includes(`${subModule.key}.${action}`));
                                    const someSelected = subModule.actions.some(action => selectedPermissions.includes(`${subModule.key}.${action}`));
                                    el.indeterminate = someSelected && !allSelected;
                                  }
                                }}
                                onChange={() => handleSubModuleToggle(module, subModule)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                disabled={disabled || hasFullAccess}
                              />
                              <span className={`font-medium ${hasFullAccess ? 'text-gray-400' : 'text-gray-800'}`}>{subModule.name}</span>
                            </div>

                            {/* Submodule Actions */}
                            {isSubModuleExpanded && subModule.actions && subModule.actions.map((action, actionIndex) => {
                              const permissionKey = `${subModule.key}.${action}`;
                              const isLastSubAction = actionIndex === subModule.actions.length - 1;

                              return (
                                <div key={permissionKey} className="flex items-center gap-1 ml-4">
                                  <span className="text-gray-400">
                                    {isLastSubModule ? '  ' : '│ '}
                                    {isLastSubAction ? '└─' : '├─'}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={selectedPermissions.includes(permissionKey)}
                                    onChange={() => handlePermissionToggle(permissionKey)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    disabled={disabled || hasFullAccess}
                                  />
                                  <span className={`capitalize ${hasFullAccess ? 'text-gray-400' : 'text-gray-600'}`}>{action}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          );
        })}
      </div>

      {/* Selected Permissions Summary - Commented out for production */}
      {/* {(selectedPermissions.length > 0 && isDevMode) && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-900 mb-2">
            Selected Permissions ({selectedPermissions.length}):
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedPermissions.slice(0, 10).map(permission => (
              <span key={permission} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                {permission}
              </span>
            ))}
            {selectedPermissions.length > 10 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                +{selectedPermissions.length - 10} more
              </span>
            )}
          </div>
        </div>
      )} */}
    </div>
  );
};

export default PermissionsTree;