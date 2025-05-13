'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [reportFrequency, setReportFrequency] = useState('weekly');
  const [dataRetention, setDataRetention] = useState(90); // days
  const [darkMode, setDarkMode] = useState(false);
  const [automaticQC, setAutomaticQC] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveGeneral = async (): Promise<void> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    
    toast({
      title: 'Settings Saved',
      description: 'Your general settings have been updated successfully.',
    });
    
    setIsLoading(false);
  };

  const handleSaveNotifications = async (): Promise<void> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    
    toast({
      title: 'Notification Settings Saved',
      description: 'Your notification preferences have been updated successfully.',
    });
    
    setIsLoading(false);
  };

  const handleSaveData = async (): Promise<void> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    
    toast({
      title: 'Data Settings Saved',
      description: 'Your data management settings have been updated successfully.',
    });
    
    setIsLoading(false);
  };

  const handleSaveQC = async (): Promise<void> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    
    toast({
      title: 'QC Settings Saved',
      description: 'Your quality control settings have been updated successfully.',
    });
    
    setIsLoading(false);
  };

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4 gap-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
          <TabsTrigger value="qc">QC Settings</TabsTrigger>
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Manage your application preferences and interface settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Dark Mode</h3>
                  <p className="text-sm text-gray-500">
                    Enable dark mode for the application interface.
                  </p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Project Card View</h3>
                  <p className="text-sm text-gray-500">
                    Show project cards in grid view instead of list view.
                  </p>
                </div>
                <Switch
                  checked={true}
                  onCheckedChange={() => {}}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Auto Save</h3>
                  <p className="text-sm text-gray-500">
                    Automatically save changes to forms and edits.
                  </p>
                </div>
                <Switch
                  checked={true}
                  onCheckedChange={() => {}}
                />
              </div>
              
              <Button onClick={handleSaveGeneral} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Manage how and when you receive notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Email Notifications</h3>
                  <p className="text-sm text-gray-500">
                    Receive project updates and alerts via email.
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Report Frequency</h3>
                <p className="text-sm text-gray-500 mb-4">
                  How often would you like to receive project summary reports?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={reportFrequency === 'daily' ? 'default' : 'outline'} 
                    onClick={() => setReportFrequency('daily')}
                  >
                    Daily
                  </Button>
                  <Button 
                    variant={reportFrequency === 'weekly' ? 'default' : 'outline'} 
                    onClick={() => setReportFrequency('weekly')}
                  >
                    Weekly
                  </Button>
                  <Button 
                    variant={reportFrequency === 'monthly' ? 'default' : 'outline'} 
                    onClick={() => setReportFrequency('monthly')}
                  >
                    Monthly
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">QC Alerts</h3>
                  <p className="text-sm text-gray-500">
                    Receive alerts for quality control issues.
                  </p>
                </div>
                <Switch
                  checked={true}
                  onCheckedChange={() => {}}
                />
              </div>
              
              <Button onClick={handleSaveNotifications} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Data Management Settings */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Configure how your data is stored and processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Data Retention Period</h3>
                <p className="text-sm text-gray-500 mb-4">
                  How long should project data be kept after project completion? ({dataRetention} days)
                </p>
                <Slider
                  value={[dataRetention]}
                  min={30}
                  max={365}
                  step={30}
                  onValueChange={(value) => setDataRetention(value[0])}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>30 days</span>
                  <span>1 year</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Automatic Backups</h3>
                  <p className="text-sm text-gray-500">
                    Create automatic backups of project data.
                  </p>
                </div>
                <Switch
                  checked={true}
                  onCheckedChange={() => {}}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Data Export Format</h3>
                  <p className="text-sm text-gray-500">
                    Default format for exporting data.
                  </p>
                </div>
                <select className="border rounded-md px-2 py-1">
                  <option>Excel (.xlsx)</option>
                  <option>CSV (.csv)</option>
                  <option>JSON (.json)</option>
                </select>
              </div>
              
              <Button onClick={handleSaveData} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* QC Settings */}
        <TabsContent value="qc">
          <Card>
            <CardHeader>
              <CardTitle>Quality Control Settings</CardTitle>
              <CardDescription>
                Configure how quality control processes work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Automatic QC</h3>
                  <p className="text-sm text-gray-500">
                    Automatically run quality control checks on new data.
                  </p>
                </div>
                <Switch
                  checked={automaticQC}
                  onCheckedChange={setAutomaticQC}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">AI Anomaly Detection</h3>
                  <p className="text-sm text-gray-500">
                    Use AI to detect anomalies in QC data.
                  </p>
                </div>
                <Switch
                  checked={true}
                  onCheckedChange={() => {}}
                />
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Default Tolerance Level</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Set the default tolerance level for QC checks.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={'outline'} 
                    onClick={() => {}}
                  >
                    Strict
                  </Button>
                  <Button 
                    variant={'default'} 
                    onClick={() => {}}
                  >
                    Standard
                  </Button>
                  <Button 
                    variant={'outline'} 
                    onClick={() => {}}
                  >
                    Relaxed
                  </Button>
                </div>
              </div>
              
              <Button onClick={handleSaveQC} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}