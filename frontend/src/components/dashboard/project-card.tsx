'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    status: string;
    lastUpdated: string;
    progress: number;
  };
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-[#36b37e] text-white'; // Using --success color
      case 'completed':
        return 'bg-[#0052cc] text-white'; // Using --primary color
      case 'on hold':
        return 'bg-[#ffab00] text-[#172b4d]'; // Using --warning color
      case 'delayed':
        return 'bg-[#ff5630] text-white'; // Using --error color
      default:
        return 'bg-[#6b778c] text-white'; // Using --gray color
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '▶️';
      case 'completed':
        return '✅';
      case 'on hold':
        return '⏸️';
      case 'delayed':
        return '⚠️';
      default:
        return '📋';
    }
  };

  const handleClick = () => {
    router.push(`/dashboard/projects/${project.id}`);
  };

  // Determine the border color based on status
  const getBorderColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'border-l-[#36b37e]';
      case 'completed':
        return 'border-l-[#0052cc]';
      case 'on hold':
        return 'border-l-[#ffab00]';
      case 'delayed':
        return 'border-l-[#ff5630]';
      default:
        return 'border-l-[#6b778c]';
    }
  };

  return (
    <Card 
      className={`hover:shadow-md hover:translate-y-[-2px] transition-all duration-300 cursor-pointer 
                 border border-[#dfe1e6] border-l-4 ${getBorderColor(project.status)} 
                 bg-white rounded-xl overflow-hidden`} 
      onClick={handleClick}
    >
      <CardContent>
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-[#0052cc] bg-opacity-10 flex items-center justify-center text-[#0052cc] font-bold shadow-sm border border-[#dfe1e6]">
                  {project.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#172b4d]">{project.name}</h3>
                  <p className="text-sm text-[#6b778c]">
                    Updated: {new Date(project.lastUpdated).toLocaleDateString('en-US', {
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm ${getStatusColor(project.status)}`}>
                {getStatusIcon(project.status)} {project.status}
              </span>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-[#f9fafc] rounded-lg border border-[#dfe1e6] border-dashed">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-[#6b778c]">Project Progress</span>
              <span className="font-medium text-[#172b4d]">{project.progress}%</span>
            </div>
            <div className="w-full bg-[#f5f8fa] rounded-full h-3 overflow-hidden shadow-inner">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  project.progress < 30 ? 'bg-[#ff5630]' : 
                  project.progress < 70 ? 'bg-[#ffab00]' : 
                  'bg-[#36b37e]'
                }`}
                style={{ width: `${project.progress}%` }}
              ></div>
            </div>
            
            {/* Progress Labels */}
            <div className="flex justify-between text-xs text-[#6b778c] mt-1">
              <span>Start</span>
              <span>In Progress</span>
              <span>Complete</span>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#f5f8fa] flex items-center justify-center text-[#6b778c]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <span className="text-sm text-[#6b778c]">3 comments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#f5f8fa] flex items-center justify-center text-[#6b778c]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
              <span className="text-sm text-[#6b778c]">2 attachments</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
