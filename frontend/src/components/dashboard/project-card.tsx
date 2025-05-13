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

  return (
    <Card className="hover:shadow-md transition-all duration-300 cursor-pointer border-l-4 border-l-[#0052cc] bg-white" 
         onClick={handleClick}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#0052cc] flex items-center justify-center text-white font-bold">
                {project.name.substring(0, 2).toUpperCase()}
              </div>
              <h3 className="text-xl font-semibold text-[#172b4d]">{project.name}</h3>
            </div>
            <p className="text-sm text-[#6b778c] mb-4">
              Last updated: {new Date(project.lastUpdated).toLocaleDateString('en-US', {
                year: 'numeric', 
                month: 'short', 
                day: 'numeric'
              })}
            </p>
          </div>
          <div>
            <span className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1 ${getStatusColor(project.status)}`}>
              {getStatusIcon(project.status)} {project.status}
            </span>
          </div>
        </div>
        
        <div className="mt-5 space-y-2">
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-[#6b778c]">Progress</span>
            <span className="font-medium text-[#172b4d]">{project.progress}%</span>
          </div>
          <div className="w-full bg-[#f5f8fa] rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-2.5 rounded-full transition-all duration-500 ${
                project.progress < 30 ? 'bg-[#ff5630]' : 
                project.progress < 70 ? 'bg-[#ffab00]' : 
                'bg-[#36b37e]'
              }`}
              style={{ width: `${project.progress}%` }}
            ></div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <Button 
            className="bg-[#0052cc] hover:bg-[#003d99] text-white"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/dashboard/projects/${project.id}`);
            }}
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
