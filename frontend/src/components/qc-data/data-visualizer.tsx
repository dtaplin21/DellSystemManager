'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface QCData {
  id: string;
  type: string;
  panelId: string;
  date: string;
  result: string;
  technician: string;
  notes: string;
  temperature?: number;
  pressure?: number;
  speed?: number;
}

interface DataVisualizerProps {
  projectId: string;
  qcData: QCData[];
}

export default function DataVisualizer({ projectId, qcData }: DataVisualizerProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [filteredData, setFilteredData] = useState<QCData[]>([]);
  const [panelFilter, setPanelFilter] = useState<string>('');
  const [resultStats, setResultStats] = useState<{
    pass: number;
    fail: number;
    pending: number;
    total: number;
  }>({ pass: 0, fail: 0, pending: 0, total: 0 });
  
  const chartRef = useRef<HTMLCanvasElement>(null);
  const timeChartRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Load Chart.js dynamically on client side
  useEffect(() => {
    import('chart.js/auto').then((Chart) => {
      // Continue with chart initialization
    });
  }, []);

  // Filter data based on selected type and panel ID
  useEffect(() => {
    let filtered = [...qcData];
    
    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(data => data.type === selectedType);
    }
    
    // Filter by panel ID
    if (panelFilter) {
      filtered = filtered.filter(data => 
        data.panelId.toLowerCase().includes(panelFilter.toLowerCase())
      );
    }
    
    // Sort by date (newest first)
    filtered = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setFilteredData(filtered);
    
    // Calculate stats
    const stats = {
      pass: filtered.filter(data => data.result === 'pass').length,
      fail: filtered.filter(data => data.result === 'fail').length,
      pending: filtered.filter(data => data.result === 'pending').length,
      total: filtered.length
    };
    
    setResultStats(stats);
    
    // Render charts when data changes
    renderCharts(filtered);
  }, [qcData, selectedType, panelFilter]);

  const renderCharts = (data: QCData[]) => {
    if (!chartRef.current || !timeChartRef.current) return;
    
    import('chart.js/auto').then((ChartModule) => {
      const Chart = ChartModule.default;
      
      // Destroy existing charts
      Chart.getChart(chartRef.current)?.destroy();
      Chart.getChart(timeChartRef.current)?.destroy();
      
      // Prepare data for results pie chart
      const resultsData = {
        labels: ['Pass', 'Fail', 'Pending'],
        datasets: [{
          label: 'Test Results',
          data: [
            data.filter(d => d.result === 'pass').length,
            data.filter(d => d.result === 'fail').length,
            data.filter(d => d.result === 'pending').length
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(255, 206, 86, 0.7)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)'
          ],
          borderWidth: 1
        }]
      };
      
      // Create results pie chart
      new Chart(chartRef.current, {
        type: 'pie',
        data: resultsData,
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'QC Test Results Distribution'
            }
          }
        }
      });
      
      // Prepare time-series data
      const timeData = prepareTimeSeriesData(data);
      
      // Create time-series chart
      new Chart(timeChartRef.current, {
        type: 'line',
        data: {
          labels: timeData.labels,
          datasets: [
            {
              label: 'Pass',
              data: timeData.passData,
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 2,
              tension: 0.1
            },
            {
              label: 'Fail',
              data: timeData.failData,
              backgroundColor: 'rgba(255, 99, 132, 0.5)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 2,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Count'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'QC Results Over Time'
            }
          }
        }
      });
    });
  };

  const prepareTimeSeriesData = (data: QCData[]) => {
    // Group data by date
    const dateGroups: { [key: string]: { pass: number, fail: number } } = {};
    
    // Get all dates in the dataset
    data.forEach(item => {
      const date = new Date(item.date).toISOString().split('T')[0];
      
      if (!dateGroups[date]) {
        dateGroups[date] = { pass: 0, fail: 0 };
      }
      
      if (item.result === 'pass') {
        dateGroups[date].pass++;
      } else if (item.result === 'fail') {
        dateGroups[date].fail++;
      }
    });
    
    // Sort dates
    const sortedDates = Object.keys(dateGroups).sort();
    
    // Prepare series data
    const labels = sortedDates;
    const passData = sortedDates.map(date => dateGroups[date].pass);
    const failData = sortedDates.map(date => dateGroups[date].fail);
    
    return { labels, passData, failData };
  };

  const exportToCsv = () => {
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add headers
    csvContent += "Type,Panel ID,Date,Result,Technician,Temperature,Pressure,Speed,Notes\n";
    
    // Add data rows
    filteredData.forEach(item => {
      const row = [
        item.type,
        item.panelId,
        item.date,
        item.result,
        item.technician || '',
        item.temperature || '',
        item.pressure || '',
        item.speed || '',
        item.notes?.replace(/,/g, ';') || '' // Replace commas in notes to avoid CSV issues
      ].join(',');
      
      csvContent += row + "\n";
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `qc_data_${projectId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Export Complete',
      description: `Exported ${filteredData.length} QC records to CSV.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedType === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedType('all')}
          >
            All Types
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'destructive' ? 'default' : 'outline'}
            onClick={() => setSelectedType('destructive')}
          >
            Destructive
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'trial' ? 'default' : 'outline'}
            onClick={() => setSelectedType('trial')}
          >
            Trial Weld
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'repair' ? 'default' : 'outline'}
            onClick={() => setSelectedType('repair')}
          >
            Repair
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'placement' ? 'default' : 'outline'}
            onClick={() => setSelectedType('placement')}
          >
            Placement
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'seaming' ? 'default' : 'outline'}
            onClick={() => setSelectedType('seaming')}
          >
            Seaming
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by Panel ID"
            value={panelFilter}
            onChange={(e) => setPanelFilter(e.target.value)}
            className="w-48"
          />
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            Export CSV
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center h-24">
            <span className="text-lg font-bold">{resultStats.total}</span>
            <span className="text-sm text-gray-500">Total Tests</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center h-24 bg-green-50">
            <span className="text-lg font-bold text-green-600">{resultStats.pass}</span>
            <span className="text-sm text-gray-500">Passed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center h-24 bg-red-50">
            <span className="text-lg font-bold text-red-600">{resultStats.fail}</span>
            <span className="text-sm text-gray-500">Failed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center h-24 bg-yellow-50">
            <span className="text-lg font-bold text-yellow-600">{resultStats.pending}</span>
            <span className="text-sm text-gray-500">Pending</span>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="data-chart-container">
              <canvas ref={chartRef}></canvas>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="data-chart-container">
              <canvas ref={timeChartRef}></canvas>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-medium mb-4">QC Data Records</h3>
          
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No QC data found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Panel ID</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Result</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Technician</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm font-medium">{item.panelId}</td>
                      <td className="py-2 px-3 text-sm">{item.type}</td>
                      <td className="py-2 px-3 text-sm">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs 
                          ${item.result === 'pass' ? 'bg-green-100 text-green-800' : ''}
                          ${item.result === 'fail' ? 'bg-red-100 text-red-800' : ''}
                          ${item.result === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                        `}>
                          {item.result}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm">{item.technician || '-'}</td>
                      <td className="py-2 px-3 text-sm">{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
