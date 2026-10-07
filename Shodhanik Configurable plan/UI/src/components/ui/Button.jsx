import { FaEye, FaPlus, FaEdit, FaTrash, FaCog, FaSpinner } from 'react-icons/fa';
import { hasPermission } from '@/services/hasPermissionService';
import { confirm } from '@/services/ConfirmationService';

const actionStyles = {
  solid: {
    read: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500',
    create: 'bg-green-500 hover:bg-green-600 text-white border-green-500',
    update: 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500',
    delete: 'bg-red-500 hover:bg-red-600 text-white border-red-500',
    manage: 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500',
  },
  outline: {
    read: 'bg-transparent hover:bg-blue-50 text-blue-500 border-blue-500',
    create: 'bg-transparent hover:bg-green-50 text-green-500 border-green-500',
    update: 'bg-transparent hover:bg-yellow-50 text-yellow-500 border-yellow-500',
    delete: 'bg-transparent hover:bg-red-50 text-red-500 border-red-500',
    manage: 'bg-transparent hover:bg-purple-50 text-purple-500 border-purple-500',
  },
  ghost: {
    read: 'bg-transparent hover:bg-blue-50 text-blue-500 border-transparent',
    create: 'bg-transparent hover:bg-green-50 text-green-500 border-transparent',
    update: 'bg-transparent hover:bg-yellow-50 text-yellow-500 border-transparent',
    delete: 'bg-transparent hover:bg-red-50 text-red-500 border-transparent',
    manage: 'bg-transparent hover:bg-purple-50 text-purple-500 border-transparent',
  },
  link: {
    read: 'bg-transparent hover:underline text-blue-500 border-transparent p-0',
    create: 'bg-transparent hover:underline text-green-500 border-transparent p-0',
    update: 'bg-transparent hover:underline text-yellow-500 border-transparent p-0',
    delete: 'bg-transparent hover:underline text-red-500 border-transparent p-0',
    manage: 'bg-transparent hover:underline text-purple-500 border-transparent p-0',
  },
};

const defaultIcons = {
  read: FaEye,
  create: FaPlus,
  update: FaEdit,
  delete: FaTrash,
  manage: FaCog,
};

/**
 * Universal Button component with permission-based rendering
 */
const Button = ({
  module = 'general',
  action = 'read',
  label,
  onClick,
  className = '',
  icon,
  disabled = false,
  size = 'md',
  style = {},
  variant = 'solid',
  loading = false,
  fullWidth = false,
  iconPosition = 'left',
  type = 'button',
  tooltip,
  requireConfirm = false,
  confirmMessage = 'Are you sure?',
  badge,
  shortcut,
  grouped = false,
}) => {
  // Check if user has permission for this module/action (skip if module is 'general')
  let isAllowed = true;
  if (module !== 'general') {
    try {
      isAllowed = hasPermission(`${module}.${action}`);
    } catch (error) {
      console.warn('Permission check failed, denying action:', error);
      isAllowed = false;
    }
  }

  if (!isAllowed) return null;

  // Handle click with optional confirmation
  const handleClick = async (e) => {
    if (loading || disabled) return;
    
    if (requireConfirm) {
      const confirmed = await confirm({
        title: 'Confirm Action',
        message: confirmMessage,
      });
      
      if (!confirmed) return;
    }
    
    onClick?.(e);
  };

  // Size variants
  const getSizeClasses = (hasText) => {
    if (variant === 'link') return '';
    
    if (hasText) {
      return {
        sm: 'px-2 py-1 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg',
      };
    } else {
      return {
        sm: 'p-2 text-sm',
        md: 'p-3',
        lg: 'p-4 text-lg',
      };
    }
  };

  // Determine if we have text to display
  let buttonText = '';
  let hasText = false;
  if (typeof label === 'string' && label.length > 0) {
    buttonText = label;
    hasText = true;
  }

  // Get the appropriate icon
  const getIcon = () => {
    if (loading) {
      return <FaSpinner className={`animate-spin ${hasText ? (iconPosition === 'right' ? 'ml-2' : 'mr-2') : ''}`} />;
    }
    
    if (icon) {
      const marginClass = hasText ? (iconPosition === 'right' ? 'ml-2' : 'mr-2') : '';
      return <span className={marginClass}>{icon}</span>;
    }
    
    const IconComponent = defaultIcons[action];
    if (!IconComponent) return null;
    const marginClass = hasText ? (iconPosition === 'right' ? 'ml-2' : 'mr-2') : '';
    return <IconComponent className={marginClass} />;
  };

  const sizeClasses = getSizeClasses(hasText);
  const variantStyles = actionStyles[variant]?.[action] || actionStyles.solid[action];

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      style={style}
      title={tooltip}
      className={`
        relative
        flex items-center justify-center
        ${sizeClasses[size] || ''}
        ${grouped ? 'rounded-none mr-0' : 'rounded'}
        ${grouped ? '' : 'mr-2'}
        ${fullWidth ? 'w-full' : ''}
        border
        cursor-pointer
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles}
        ${className}
      `}
    >
      {iconPosition === 'left' && getIcon()}
      {hasText && buttonText}
      {iconPosition === 'right' && getIcon()}
      
      {badge !== undefined && badge !== null && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      
      {shortcut && hasText && (
        <span className="ml-2 text-xs opacity-60 font-mono">
          {shortcut}
        </span>
      )}
    </button>
  );
};

export default Button;


/*
 * ============================================
 * HOW TO USE THE BUTTON COMPONENT
 * ============================================
 * 
 * BASIC USAGE:
 * ------------
 * import Button from '@/components/ui/Button';
 * 
 * <Button 
 *   onClick={() => console.log('clicked')} 
 * />
 * 
 * 
 * EXAMPLES:
 * ---------
 * 
 * 1. Icon-only button (default):
 *    <Button 
 *      action="create" 
 *      onClick={handleCreate} 
 *    />
 * 
 * 2. Button with text and icon:
 *    <Button 
 *      action="create" 
 *      label="Add New User"
 *      onClick={handleCreate} 
 *    />
 * 
 * 3. Button with permission check:
 *    <Button 
 *      module="users" 
 *      action="delete"
 *      label="Delete"
 *      onClick={handleDelete} 
 *    />
 * 
 * 4. Custom icon button:
 *    import { FaSave } from 'react-icons/fa';
 *    <Button 
 *      icon={<FaSave />}
 *      label="Save"
 *      onClick={handleSave} 
 *    />
 * 
 * 5. Different sizes:
 *    <Button size="sm" action="read" onClick={handleView} />
 *    <Button size="md" action="update" onClick={handleEdit} />
 *    <Button size="lg" action="delete" onClick={handleDelete} />
 * 
 * 6. Disabled button:
 *    <Button 
 *      action="create"
 *      label="Submit"
 *      disabled={isLoading}
 *      onClick={handleSubmit} 
 *    />
 * 
 * 7. Custom styling:
 *    <Button 
 *      action="read"
 *      className="shadow-lg rounded-full"
 *      style={{ marginLeft: '10px' }}
 *      onClick={handleClick} 
 *    />
 * 
 * 8. General button (no permission check):
 *    <Button 
 *      module="general"
 *      label="Cancel"
 *      onClick={handleCancel} 
 *    />
 * 
 * 9. Outline variant:
 *    <Button 
 *      variant="outline"
 *      action="create"
 *      label="Add"
 *      onClick={handleAdd} 
 *    />
 * 
 * 10. Ghost variant:
 *     <Button 
 *       variant="ghost"
 *       action="read"
 *       label="View"
 *       onClick={handleView} 
 *     />
 * 
 * 11. Link variant:
 *     <Button 
 *       variant="link"
 *       label="Learn More"
 *       onClick={handleLearnMore} 
 *     />
 * 
 * 12. Loading state:
 *     <Button 
 *       loading={isSubmitting}
 *       label="Submit"
 *       onClick={handleSubmit} 
 *     />
 * 
 * 13. Full width button:
 *     <Button 
 *       fullWidth
 *       label="Continue"
 *       onClick={handleContinue} 
 *     />
 * 
 * 14. Icon on right:
 *     import { FaArrowRight } from 'react-icons/fa';
 *     <Button 
 *       iconPosition="right"
 *       icon={<FaArrowRight />}
 *       label="Next"
 *       onClick={handleNext} 
 *     />
 * 
 * 15. Submit button for forms:
 *     <Button 
 *       type="submit"
 *       label="Submit Form"
 *       onClick={handleSubmit} 
 *     />
 * 
 * 16. Button with tooltip:
 *     <Button 
 *       action="delete"
 *       tooltip="Delete this item"
 *       onClick={handleDelete} 
 *     />
 * 
 * 17. Button with confirmation:
 *     <Button 
 *       action="delete"
 *       label="Delete"
 *       requireConfirm
 *       confirmMessage="Delete this user?"
 *       onClick={handleDelete} 
 *     />
 * 
 * 18. Button with badge:
 *     <Button 
 *       label="Messages"
 *       badge={5}
 *       onClick={handleMessages} 
 *     />
 * 
 * 19. Button with keyboard shortcut:
 *     <Button 
 *       label="Save"
 *       shortcut="Ctrl+S"
 *       onClick={handleSave} 
 *     />
 * 
 * 20. Button group:
 *     <div className="inline-flex">
 *       <Button grouped label="Left" onClick={handleLeft} />
 *       <Button grouped label="Center" onClick={handleCenter} />
 *       <Button grouped label="Right" onClick={handleRight} />
 *     </div>
 * 
 * 
 * PROPS REFERENCE:
 * ----------------
 * - module: string (default: 'general')
 *   Module name for permission check. Use 'general' to skip permission check.
 * 
 * - action: string (default: 'read')
 *   Action type: 'read', 'create', 'update', 'delete', 'manage'
 *   Determines button color and default icon.
 * 
 * - label: string (optional)
 *   Button text. If omitted, shows icon only.
 * 
 * - onClick: function (optional)
 *   Click handler function.
 * 
 * - className: string (optional)
 *   Additional Tailwind CSS classes.
 * 
 * - icon: ReactElement (optional)
 *   Custom icon component. Overrides default action icon.
 * 
 * - disabled: boolean (default: false)
 *   Disables the button.
 * 
 * - size: string (default: 'md')
 *   Button size: 'sm', 'md', 'lg'
 * 
 * - style: object (optional)
 *   Inline CSS styles.
 * 
 * - variant: string (default: 'solid')
 *   Button style variant: 'solid', 'outline', 'ghost', 'link'
 * 
 * - loading: boolean (default: false)
 *   Shows loading spinner and disables button.
 * 
 * - fullWidth: boolean (default: false)
 *   Makes button take full width of container.
 * 
 * - iconPosition: string (default: 'left')
 *   Icon position: 'left' or 'right'
 * 
 * - type: string (default: 'button')
 *   HTML button type: 'button', 'submit', 'reset'
 * 
 * - tooltip: string (optional)
 *   Tooltip text shown on hover.
 * 
 * - requireConfirm: boolean (default: false)
 *   Shows confirmation dialog before executing onClick.
 * 
 * - confirmMessage: string (default: 'Are you sure?')
 *   Message shown in confirmation dialog.
 * 
 * - badge: number (optional)
 *   Shows notification badge with count.
 * 
 * - shortcut: string (optional)
 *   Displays keyboard shortcut hint.
 * 
 * - grouped: boolean (default: false)
 *   Removes margin and border radius for button groups.
 * 
 * 
 * VARIANTS:
 * ---------
 * - solid: Filled background with white text (default)
 * - outline: Transparent background with colored border and text
 * - ghost: Transparent background with colored text, no border
 * - link: Text-only button with underline on hover
 * 
 * 
 * ACTION COLORS:
 * --------------
 * - read: Blue
 * - create: Green
 * - update: Yellow
 * - delete: Red
 * - manage: Purple
 * 
 * 
 * PERMISSION SYSTEM:
 * ------------------
 * Button automatically checks permissions using: `${module}.${action}`
 * Example: module="users" + action="delete" = checks "users.delete" permission
 * If permission denied, button won't render (returns null).
 * Use module="general" to bypass permission checks.
 * 
 * 
 * ADVANCED FEATURES:
 * ------------------
 * 
 * 1. LOADING STATE:
 *    Automatically shows spinner and disables button.
 *    Icon is replaced with spinning loader.
 * 
 * 2. CONFIRMATION DIALOG:
 *    When requireConfirm=true, first click shows inline confirmation.
 *    User must click "Yes" to proceed or "No" to cancel.
 * 
 * 3. BADGE COUNTER:
 *    Shows red notification badge in top-right corner.
 *    Displays "99+" for values over 99.
 * 
 * 4. KEYBOARD SHORTCUTS:
 *    Displays shortcut hint next to label (visual only).
 *    You must implement actual keyboard handling separately.
 * 
 * 5. BUTTON GROUPS:
 *    Use grouped=true and wrap in flex container.
 *    Removes margins and border radius for seamless grouping.
 * 
 * 
 * NOTES:
 * ------
 * - Icon-only buttons have equal padding (p-2, p-3, p-4)
 * - Text buttons have horizontal padding (px-2 py-1, px-4 py-2, px-6 py-3)
 * - Icons automatically get margin when text is present
 * - All buttons have hover effects and smooth transitions
 * - Loading state disables button and shows spinner
 * - Confirmation dialog appears inline, replacing the button temporarily
 * - Badge positioning is absolute, ensure parent has space
 * - Link variant ignores size padding
 */
