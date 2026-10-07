import { useState, useEffect } from 'react';
import API from '@/services/API';
import notification from '@/services/NotificationService';

const WelcomeSectionManager = () => {
  const [welcomeSection, setWelcomeSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    welcomeTitle: '',
    welcomeText: '',
    isActive: true
  });

  const [isEditing, setIsEditing] = useState(false);

  // Fetch welcome section from API
  const fetchWelcomeSection = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await API.get('/WelcomeSections');
      if (response.data.success && response.data.data) {
        const section = Array.isArray(response.data.data) 
          ? response.data.data.find(s => s.isActive) || response.data.data[0]
          : response.data.data;
        setWelcomeSection(section);
      }
    } catch (err) {
      setError('Failed to fetch welcome section. Please try again later.');
      console.error('Error fetching welcome section:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create welcome section
  const createWelcomeSection = async (data) => {
    try {
      const response = await API.post('/WelcomeSections', data);
      if (response.data.success) {
        await fetchWelcomeSection();
        return response.data;
      }
    } catch (err) {
      console.error('Error creating welcome section:', err);
      throw err;
    }
  };

  // Update welcome section
  const updateWelcomeSection = async (id, data) => {
    try {
      const response = await API.put(`/WelcomeSections/${id}`, { ...data, id });
      if (response.data.success) {
        await fetchWelcomeSection();
        return response.data;
      }
    } catch (err) {
      console.error('Error updating welcome section:', err);
      throw err;
    }
  };

  // Delete welcome section
  const deleteWelcomeSection = async (id) => {
    try {
      const response = await API.delete(`/WelcomeSections/${id}`);
      if (response.data.success) {
        await fetchWelcomeSection();
        return response.data;
      }
    } catch (err) {
      console.error('Error deleting welcome section:', err);
      throw err;
    }
  };

  // Load welcome section data into form when it changes
  useEffect(() => {
    if (welcomeSection) {
      setFormData({
        welcomeTitle: welcomeSection.welcomeTitle || '',
        welcomeText: welcomeSection.welcomeText || '',
        isActive: welcomeSection.isActive !== undefined ? welcomeSection.isActive : true
      });
      setIsEditing(true);
    } else {
      setFormData({
        welcomeTitle: '',
        welcomeText: '',
        isActive: true
      });
      setIsEditing(false);
    }
  }, [welcomeSection]);

  // Fetch data on component mount
  useEffect(() => {
    fetchWelcomeSection();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (isEditing && welcomeSection?.id) {
        // Update existing welcome section
        await updateWelcomeSection(welcomeSection.id, formData);
        notification().success('Welcome section updated successfully!');
      } else {
        // Create new welcome section
        await createWelcomeSection(formData);
        notification().success('Welcome section created successfully!');
      }
    } catch (error) {
      console.error('Error saving welcome section:', error);
      notification().error('Error saving welcome section: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!welcomeSection?.id) return;
    
    if (window.confirm('Are you sure you want to delete this welcome section?')) {
      try {
        await deleteWelcomeSection(welcomeSection.id);
        notification().success('Welcome section deleted successfully!');
      } catch (error) {
        console.error('Error deleting welcome section:', error);
        notification().error('Error deleting welcome section: ' + error.message);
      }
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchWelcomeSection();
    } catch (error) {
      console.error('Error refreshing welcome section:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading welcome section...</div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <p>Error: {error}</p>
        <button onClick={fetchWelcomeSection}>Retry</button>
      </div>
    );
  }

  return (
    <div className="welcome-section-manager">
      <div className="header">
        <h2>Welcome Section Manager</h2>
        <button onClick={handleRefresh} className="refresh-btn">
          Refresh
        </button>
      </div>

      <div className="current-data">
        <h3>Current Welcome Section:</h3>
        {welcomeSection ? (
          <div className="welcome-preview">
            <p><strong>ID:</strong> {welcomeSection.id}</p>
            <p><strong>Title:</strong> {welcomeSection.welcomeTitle}</p>
            <p><strong>Text:</strong> {welcomeSection.welcomeText}</p>
            <p><strong>Active:</strong> {welcomeSection.isActive ? 'Yes' : 'No'}</p>
          </div>
        ) : (
          <p>No welcome section found. Create one below.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="welcome-form">
        <h3>{isEditing ? 'Edit Welcome Section' : 'Create Welcome Section'}</h3>
        
        <div className="form-group">
          <label htmlFor="welcomeTitle">Welcome Title:</label>
          <input
            type="text"
            id="welcomeTitle"
            name="welcomeTitle"
            value={formData.welcomeTitle}
            onChange={handleInputChange}
            required
            placeholder="Enter welcome title"
          />
        </div>

        <div className="form-group">
          <label htmlFor="welcomeText">Welcome Text:</label>
          <textarea
            id="welcomeText"
            name="welcomeText"
            value={formData.welcomeText}
            onChange={handleInputChange}
            required
            rows="4"
            placeholder="Enter welcome text"
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
            />
            Active
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-btn">
            {isEditing ? 'Update Welcome Section' : 'Create Welcome Section'}
          </button>
          
          {isEditing && welcomeSection?.id && (
            <button type="button" onClick={handleDelete} className="delete-btn">
              Delete Welcome Section
            </button>
          )}
        </div>
      </form>

      <div className="api-examples">
        <h3>API Usage Examples:</h3>
        <div className="code-examples">
          <h4>1. Get Active Welcome Section:</h4>
          <code>GET /api/WelcomeSections/active</code>
          
          <h4>2. Create Welcome Section:</h4>
          <code>
            POST /api/WelcomeSections<br/>
            {JSON.stringify({
              welcomeTitle: "Welcome to Our University",
              welcomeText: "We are pleased to welcome you...",
              isActive: true
            }, null, 2)}
          </code>
          
          <h4>3. Update Welcome Section:</h4>
          <code>
            PUT /api/WelcomeSections/1<br/>
            {JSON.stringify({
              id: 1,
              welcomeTitle: "Updated Welcome Title",
              welcomeText: "Updated welcome text...",
              isActive: true
            }, null, 2)}
          </code>
        </div>
      </div>

      <style jsx>{`
        .welcome-section-manager {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .refresh-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .current-data {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .welcome-preview {
          background: white;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }
        
        .welcome-form {
          background: white;
          padding: 20px;
          border-radius: 4px;
          border: 1px solid #dee2e6;
          margin-bottom: 20px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .form-actions {
          display: flex;
          gap: 10px;
        }
        
        .save-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .delete-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .api-examples {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
        }
        
        .code-examples code {
          display: block;
          background: #e9ecef;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          font-family: monospace;
          white-space: pre-wrap;
        }
        
        .loading {
          text-align: center;
          padding: 20px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default WelcomeSectionManager;
