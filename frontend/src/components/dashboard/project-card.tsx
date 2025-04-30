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
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'on hold':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleClick = () => {
    router.push(`/dashboard/projects/${project.id}`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleClick}>
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium">{project.name}</h3>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(project.lastUpdated).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>
              {project.status}
            </span>
            <Button size="sm" variant="ghost">View</Button>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center space-x-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${project.progress}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium">{project.progress}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
