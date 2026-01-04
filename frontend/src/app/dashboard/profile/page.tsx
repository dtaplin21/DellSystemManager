'use client';
export const dynamic = "force-dynamic";

import { useState } from 'react';
import './profile.css';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: 'John Anderson',
    email: 'john.anderson@example.com',
    company: 'Valley Engineering Co.',
    position: 'Senior QC Manager',
    phone: '+1 (555) 123-4567',
    location: 'Denver, CO'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    alert('Profile update functionality ready! This will connect to your backend when ready.');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original values
    setFormData({
      name: 'John Anderson',
      email: 'john.anderson@example.com',
      company: 'Valley Engineering Co.',
      position: 'Senior QC Manager',
      phone: '+1 (555) 123-4567',
      location: 'Denver, CO'
    });
  };

  const handleChangeAvatar = () => {
    alert('Avatar change functionality ready! This will connect to your backend when ready.');
  };

  const handleManageSubscription = () => {
    alert('Subscription management functionality ready! This will redirect to billing portal when ready.');
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1 className="profile-title">Profile</h1>
          <p className="profile-subtitle">
            Manage your account information and preferences.
          </p>
        </div>

        {/* Personal Information */}
        <div className="profile-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Personal Information</h2>
              <p className="section-description">Update your personal details and contact information</p>
            </div>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="btn-edit">
                Edit Profile
              </button>
            )}
          </div>
          
          <div className="section-content">
            <div className="avatar-section">
              <div className="avatar">
                {formData.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="avatar-info">
                <h2>{formData.name}</h2>
                <p>{formData.position} at {formData.company}</p>
              </div>
              <button onClick={handleChangeAvatar} className="btn-change-avatar">
                Change Avatar
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Position</label>
                    <input
                      type="text"
                      name="position"
                      value={formData.position}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={handleCancel} className="btn-cancel">
                    Cancel
                  </button>
                  <button type="submit" className="btn-save">
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-info">
                <div className="info-item">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{formData.email}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Company:</span>
                  <span className="info-value">{formData.company}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Position:</span>
                  <span className="info-value">{formData.position}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Phone:</span>
                  <span className="info-value">{formData.phone}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Location:</span>
                  <span className="info-value">{formData.location}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subscription */}
        <div className="profile-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Subscription</h2>
              <p className="section-description">Manage your subscription plan and billing</p>
            </div>
          </div>
          
          <div className="section-content">
            <div className="subscription-info">
              <div className="plan-details">
                <h3>Professional Plan</h3>
                <p>$145/month • Next billing: June 15, 2025</p>
              </div>
              <button onClick={handleManageSubscription} className="btn-manage">
                Manage Subscription
              </button>
            </div>
            
            <div className="profile-info">
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className="info-value">Active</span>
              </div>
              <div className="info-item">
                <span className="info-label">Features:</span>
                <span className="info-value">Unlimited projects, Advanced AI analysis, Priority support</span>
              </div>
              <div className="info-item">
                <span className="info-label">Usage:</span>
                <span className="info-value">12 of unlimited projects this month</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}