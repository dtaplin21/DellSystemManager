-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status TEXT DEFAULT 'active',
  scale DECIMAL DEFAULT 0.0025,
  layout_width INTEGER DEFAULT 10000,
  layout_height INTEGER DEFAULT 15000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create panels table
CREATE TABLE IF NOT EXISTS panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('rectangle', 'triangle')),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  width_feet DECIMAL NOT NULL,
  height_feet DECIMAL NOT NULL,
  roll_number TEXT NOT NULL,
  panel_number TEXT NOT NULL,
  fill TEXT DEFAULT '#3b82f6',
  stroke TEXT DEFAULT '#1d4ed8',
  stroke_width INTEGER DEFAULT 2,
  rotation DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_panels_project_id ON panels(project_id);
CREATE INDEX IF NOT EXISTS idx_panels_roll_panel ON panels(roll_number, panel_number);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE panels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Users can view panels from their projects" ON panels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = panels.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert panels to their projects" ON panels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = panels.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update panels from their projects" ON panels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = panels.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete panels from their projects" ON panels
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = panels.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_panels_updated_at BEFORE UPDATE ON panels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 