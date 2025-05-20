'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Mock QC data for demonstration
const DEMO_QC_DATA = [
  {
    id: 'qc001',
    projectId: '1',
    testType: 'Seam Strength',
    testDate: '2025-05-17',
    location: 'North Slope',
    result: 'Pass',
    value: '452 lbs',
    operator: 'Michael Chen',
    notes: 'All parameters within acceptable range',
  },
  {
    id: 'qc002',
    projectId: '1',
    testType: 'Thickness',
    testDate: '2025-05-16',
    location: 'Central Area',
    result: 'Pass',
    value: '60 mil',
    operator: 'Sarah Johnson',
    notes: 'No anomalies detected',
  },
  {
    id: 'qc003',
    projectId: '2',
    testType: 'Density',
    testDate: '2025-05-15',
    location: 'East Section',
    result: 'Warning',
    value: '0.932 g/cc',
    operator: 'David Wilson',
    notes: 'Within range but close to lower limit',
  },
  {
    id: 'qc004',
    projectId: '3',
    testType: 'Tear Resistance',
    testDate: '2025-05-18',
    location: 'West Edge',
    result: 'Pass',
    value: '42 N',
    operator: 'Emma Rodriguez',
    notes: 'Material performing as expected',
  },
  {
    id: 'qc005',
    projectId: '2',
    testType: 'Puncture Resistance',
    testDate: '2025-05-14',
    location: 'South Corner',
    result: 'Fail',
    value: '210 N',
    operator: 'James Taylor',
    notes: 'Below minimum requirement of 240 N. Retest recommended.',
  },
];

export default function QCDataPage() {
  const [qcData, setQcData] = useState(DEMO_QC_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTestType, setSelectedTestType] = useState('All');
  const { toast } = useToast();

  useEffect(() => {
    // Simulate loading QC data from API
    setTimeout(() => {
      setIsLoading(false);
    }, 800);
  }, []);

  // Filter data based on selected test type
  const filteredData = selectedTestType === 'All'
    ? qcData
    : qcData.filter(item => item.testType === selectedTestType);

  // Get unique test types for filter
  const testTypes = ['All', ...new Set(qcData.map(item => item.testType))];

  // Calculate statistics
  const stats = {
    total: qcData.length,
    pass: qcData.filter(item => item.result === 'Pass').length,
    warning: qcData.filter(item => item.result === 'Warning').length,
    fail: qcData.filter(item => item.result === 'Fail').length,
  };

  const passRate = Math.round((stats.pass / stats.total) * 100);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-50 to-white">
      <header className="py-6 border-b border-orange-200 bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-navy-800">GeoQC</h1>
              <nav className="ml-10 space-x-4">
                <Link href="/dashboard" className="text-gray-700 hover:text-orange-600">Dashboard</Link>
                <Link href="/dashboard/projects" className="text-gray-700 hover:text-orange-600">Projects</Link>
                <Link href="/dashboard/qc-data" className="text-navy-800 font-medium">QC Data</Link>
                <Link href="/dashboard/documents" className="text-gray-700 hover:text-orange-600">Documents</Link>
              </nav>
            </div>
            <div>
              <Button className="bg-navy-700 hover:bg-navy-800 text-white">
                Upload QC Data
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy-800 mb-3">Quality Control Data</h1>
          <p className="text-navy-600">
            View, analyze, and manage all quality control test results for your geosynthetic projects.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-md border border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-navy-800">{stats.total}</div>
              <p className="text-navy-600 text-sm">Across all projects</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-md border border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{passRate}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${passRate}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-md border border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Tests with Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-500">{stats.warning}</div>
              <p className="text-navy-600 text-sm">Requires attention</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-md border border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Failed Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{stats.fail}</div>
              <p className="text-navy-600 text-sm">Critical action needed</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <Card className="border border-orange-200 shadow-md overflow-hidden">
            <CardHeader className="bg-white border-b border-orange-200 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl text-navy-800">Test Results</CardTitle>
                
                <div className="flex items-center space-x-3">
                  <div className="flex border border-gray-300 rounded-md overflow-hidden">
                    {testTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedTestType(type)}
                        className={`px-3 py-1 text-sm font-medium ${
                          selectedTestType === type
                            ? 'bg-navy-600 text-white'
                            : 'bg-white text-navy-700 hover:bg-navy-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  
                  <Button variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50">
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-navy-50">
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Test ID</th>
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Test Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Location</th>
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Result</th>
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Value</th>
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Operator</th>
                      <th className="text-left py-3 px-4 font-semibold text-navy-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-navy-50/30'}>
                        <td className="py-3 px-4 border-t border-gray-200">{item.id}</td>
                        <td className="py-3 px-4 border-t border-gray-200">{item.testType}</td>
                        <td className="py-3 px-4 border-t border-gray-200">{item.testDate}</td>
                        <td className="py-3 px-4 border-t border-gray-200">{item.location}</td>
                        <td className="py-3 px-4 border-t border-gray-200">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            item.result === 'Pass' 
                              ? 'bg-green-100 text-green-800' 
                              : item.result === 'Warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.result}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-t border-gray-200">{item.value}</td>
                        <td className="py-3 px-4 border-t border-gray-200">{item.operator}</td>
                        <td className="py-3 px-4 border-t border-gray-200">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                toast({
                                  title: 'Viewing Test Details',
                                  description: `Viewing details for test ${item.id}`,
                                });
                              }}
                              className="text-navy-600 hover:text-navy-800"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => {
                                toast({
                                  title: 'Edit Test',
                                  description: `Editing test ${item.id}`,
                                });
                              }}
                              className="text-orange-600 hover:text-orange-800"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 0L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredData.length === 0 && (
                  <div className="py-8 text-center text-navy-600">
                    No test results found for the selected filter.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <Card className="border border-orange-200 shadow-md">
            <CardHeader className="pb-2 border-b border-orange-200">
              <CardTitle className="text-xl text-navy-800">AI Analysis</CardTitle>
              <CardDescription className="text-navy-600">
                Automated insights from your QC data
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 p-2 rounded-lg text-green-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-navy-800">Consistent Performance</h3>
                    <p className="text-navy-600">
                      Seam strength tests show consistent results across all tested locations, indicating good installation quality.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-100 p-2 rounded-lg text-yellow-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-navy-800">Potential Concern</h3>
                    <p className="text-navy-600">
                      Density readings in the East Section are trending toward the lower acceptable limit. Monitoring recommended.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-red-100 p-2 rounded-lg text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-navy-800">Action Required</h3>
                    <p className="text-navy-600">
                      Puncture resistance test in South Corner failed to meet minimum requirements. Recommend re-testing and possible material verification.
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-orange-100">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                    Generate Detailed Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}