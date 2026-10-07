import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import { FaSave, FaArrowRight, FaDownload, FaBell } from 'react-icons/fa';
import notification from '@/services/NotificationService';

const Example = () => {
  const notify = notification();
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(5);

  const handleClick = (message) => {
    console.log(message);
    // alert(message);
  };

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-6">Button Component Examples</h1>

      {/* Basic Buttons */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">1. Basic Icon-Only Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button action="read" onClick={() => handleClick('Read clicked')} />
          <Button action="create" onClick={() => handleClick('Create clicked')} />
          <Button action="update" onClick={() => handleClick('Update clicked')} />
          <Button action="delete" onClick={() => handleClick('Delete clicked')} />
          <Button action="manage" onClick={() => handleClick('Manage clicked')} />
        </div>
      </section>

      {/* Buttons with Text */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">2. Buttons with Text</h2>
        <div className="flex flex-wrap gap-2">
          <Button action="read" label="View" onClick={() => handleClick('View clicked')} />
          <Button action="create" label="Add New" onClick={() => handleClick('Add clicked')} />
          <Button action="update" label="Edit" onClick={() => handleClick('Edit clicked')} />
          <Button action="delete" label="Delete" onClick={() => handleClick('Delete clicked')} />
          <Button action="manage" label="Settings" onClick={() => handleClick('Settings clicked')} />
        </div>
      </section>

      {/* Sizes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">3. Different Sizes</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" action="create" label="Small" onClick={() => handleClick('Small')} />
          <Button size="md" action="create" label="Medium" onClick={() => handleClick('Medium')} />
          <Button size="lg" action="create" label="Large" onClick={() => handleClick('Large')} />
        </div>
      </section>

      {/* Variants */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">4. Variants</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600 mb-2">Solid (Default)</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" action="read" label="Read" onClick={() => handleClick('Solid')} />
              <Button variant="solid" action="create" label="Create" onClick={() => handleClick('Solid')} />
              <Button variant="solid" action="update" label="Update" onClick={() => handleClick('Solid')} />
              <Button variant="solid" action="delete" label="Delete" onClick={() => handleClick('Solid')} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Outline</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" action="read" label="Read" onClick={() => handleClick('Outline')} />
              <Button variant="outline" action="create" label="Create" onClick={() => handleClick('Outline')} />
              <Button variant="outline" action="update" label="Update" onClick={() => handleClick('Outline')} />
              <Button variant="outline" action="delete" label="Delete" onClick={() => handleClick('Outline')} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Ghost</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" action="read" label="Read" onClick={() => handleClick('Ghost')} />
              <Button variant="ghost" action="create" label="Create" onClick={() => handleClick('Ghost')} />
              <Button variant="ghost" action="update" label="Update" onClick={() => handleClick('Ghost')} />
              <Button variant="ghost" action="delete" label="Delete" onClick={() => handleClick('Ghost')} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Link</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="link" action="read" label="Read More" onClick={() => handleClick('Link')} />
              <Button variant="link" action="create" label="Create New" onClick={() => handleClick('Link')} />
              <Button variant="link" action="update" label="Edit Item" onClick={() => handleClick('Link')} />
              <Button variant="link" action="delete" label="Remove" onClick={() => handleClick('Link')} />
            </div>
          </div>
        </div>
      </section>

      {/* Custom Icons */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">5. Custom Icons</h2>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FaSave />} label="Save" onClick={() => handleClick('Save')} />
          <Button icon={<FaDownload />} label="Download" action="read" onClick={() => handleClick('Download')} />
          <Button icon={<FaBell />} label="Notifications" action="manage" onClick={() => handleClick('Notifications')} />
        </div>
      </section>

      {/* Icon Position */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">6. Icon Position</h2>
        <div className="flex flex-wrap gap-2">
          <Button iconPosition="left" label="Previous" onClick={() => handleClick('Previous')} />
          <Button iconPosition="right" icon={<FaArrowRight />} label="Next" onClick={() => handleClick('Next')} />
        </div>
      </section>

      {/* Loading State */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">7. Loading State</h2>
        <div className="flex flex-wrap gap-2">
          <Button loading={loading} label="Submit" onClick={handleLoadingDemo} />
          <Button loading={loading} action="create" label="Creating..." onClick={handleLoadingDemo} />
          <Button label="Trigger Loading (3s)" action="manage" onClick={handleLoadingDemo} />
        </div>
      </section>

      {/* Disabled State */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">8. Disabled State</h2>
        <div className="flex flex-wrap gap-2">
          <Button disabled label="Disabled" onClick={() => handleClick('Should not fire')} />
          <Button disabled action="create" label="Can't Create" onClick={() => handleClick('Should not fire')} />
          <Button disabled action="delete" label="Can't Delete" onClick={() => handleClick('Should not fire')} />
        </div>
      </section>

      {/* Full Width */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">9. Full Width</h2>
        <div className="space-y-2">
          <Button fullWidth label="Full Width Button" onClick={() => handleClick('Full width')} />
          <Button fullWidth action="create" label="Create New Item" onClick={() => handleClick('Full width create')} />
        </div>
      </section>

      {/* Tooltip */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">10. With Tooltip (Hover to see)</h2>
        <div className="flex flex-wrap gap-2">
          <Button action="read" tooltip="View details" onClick={() => handleClick('View')} />
          <Button action="delete" tooltip="Delete this item permanently" onClick={() => handleClick('Delete')} />
          <Button label="Save" tooltip="Save changes (Ctrl+S)" onClick={() => handleClick('Save')} />
        </div>
      </section>

      {/* Confirmation */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">11. With Confirmation</h2>
        <div className="flex flex-wrap gap-2">
          <Button 
            action="delete" 
            label="Delete User" 
            requireConfirm 
            confirmMessage="Delete this user?"
            onClick={() => handleClick('User deleted!')} 
          />
          <Button 
            action="delete" 
            label="Clear Data" 
            requireConfirm 
            confirmMessage="This will clear all data. Continue?"
            onClick={() => handleClick('Data cleared!')} 
          />
        </div>
      </section>

      {/* Badge */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">12. With Badge</h2>
        <div className="flex flex-wrap gap-2">
          <Button label="Messages" badge={count} onClick={() => handleClick('Messages')} />
          <Button label="Notifications" badge={12} action="manage" onClick={() => handleClick('Notifications')} />
          <Button label="Alerts" badge={150} action="delete" onClick={() => handleClick('Alerts')} />
          <Button action="read" badge={3} onClick={() => handleClick('Icon with badge')} />
          <Button 
            label="Clear Badge" 
            action="update" 
            onClick={() => setCount(0)} 
          />
        </div>
      </section>

      {/* Keyboard Shortcut */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">13. With Keyboard Shortcut</h2>
        <div className="flex flex-wrap gap-2">
          <Button label="Save" shortcut="Ctrl+S" onClick={() => handleClick('Save')} />
          <Button label="Copy" shortcut="Ctrl+C" action="read" onClick={() => handleClick('Copy')} />
          <Button label="Paste" shortcut="Ctrl+V" action="create" onClick={() => handleClick('Paste')} />
          <Button label="Undo" shortcut="Ctrl+Z" action="update" onClick={() => handleClick('Undo')} />
        </div>
      </section>

      {/* Button Groups */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">14. Button Groups</h2>
        <div className="space-y-3">
          <div className="inline-flex">
            <Button grouped label="Left" onClick={() => handleClick('Left')} />
            <Button grouped label="Center" onClick={() => handleClick('Center')} />
            <Button grouped label="Right" onClick={() => handleClick('Right')} />
          </div>
          <div className="inline-flex">
            <Button grouped action="read" onClick={() => handleClick('View')} />
            <Button grouped action="update" onClick={() => handleClick('Edit')} />
            <Button grouped action="delete" onClick={() => handleClick('Delete')} />
          </div>
        </div>
      </section>

      {/* Form Button Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">15. Form Button Types</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleClick('Form submitted!'); }} className="space-y-2">
          <input 
            type="text" 
            placeholder="Enter something..." 
            className="border rounded px-3 py-2 w-full max-w-md"
          />
          <div className="flex gap-2">
            <Button type="submit" label="Submit Form" action="create" />
            <Button type="reset" label="Reset" action="update" />
            <Button type="button" label="Cancel" variant="outline" onClick={() => handleClick('Cancelled')} />
          </div>
        </form>
      </section>

      {/* Mixed Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">16. Complex Combinations</h2>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="lg" 
            icon={<FaSave />} 
            label="Save Draft" 
            shortcut="Ctrl+D"
            onClick={() => handleClick('Draft saved')} 
          />
          <Button 
            variant="ghost" 
            badge={99}
            label="Inbox" 
            tooltip="You have 99+ messages"
            onClick={() => handleClick('Inbox opened')} 
          />
          <Button 
            action="delete" 
            size="sm"
            requireConfirm
            confirmMessage="Permanently delete?"
            tooltip="Delete forever"
            onClick={() => handleClick('Deleted permanently')} 
          />
        </div>
      </section>

      {/* Custom Styling */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">17. Custom Styling</h2>
        <div className="flex flex-wrap gap-2">
          <Button 
            label="Rounded Full" 
            className="rounded-full shadow-lg"
            onClick={() => handleClick('Custom style')} 
          />
          <Button 
            label="No Shadow" 
            className="shadow-none"
            action="create"
            onClick={() => handleClick('No shadow')} 
          />
          <Button 
            label="Custom Margin" 
            style={{ marginLeft: '20px', marginRight: '20px' }}
            action="manage"
            onClick={() => handleClick('Custom margin')} 
          />
        </div>
      </section>
    </div>
  );
};

export default Example;
