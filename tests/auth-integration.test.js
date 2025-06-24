const { createClient } = require('@supabase/supabase-js');

// Test configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables for testing');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

describe('Supabase Auth Integration Tests', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
    display_name: 'Test User'
  };

  let testUserId;
  let testSession;

  beforeAll(async () => {
    // Clean up any existing test user
    try {
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const user = existingUser.users.find(u => u.email === testUser.email);
      if (user) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    } catch (error) {
      console.log('No existing test user to clean up');
    }
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      try {
        await supabase.auth.admin.deleteUser(testUserId);
      } catch (error) {
        console.log('Error cleaning up test user:', error);
      }
    }
  });

  test('should sign up a new user', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          display_name: testUser.display_name
        }
      }
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testUser.email);
    expect(data.user.user_metadata.display_name).toBe(testUser.display_name);
    
    testUserId = data.user.id;
  });

  test('should sign in user', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.session).toBeDefined();
    expect(data.user.email).toBe(testUser.email);
    
    testSession = data.session;
  });

  test('should create user profile', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.display_name).toBe(testUser.display_name);
    expect(data.subscription).toBe('basic');
  });

  test('should create a project with RLS', async () => {
    const projectData = {
      name: 'Test Project',
      description: 'Test project description',
      location: 'Test Location',
      user_id: testUserId
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe(projectData.name);
    expect(data.user_id).toBe(testUserId);
  });

  test('should fetch user projects with RLS', async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', testUserId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('should call protected API route', async () => {
    const response = await fetch('http://localhost:3000/api/projects', {
      headers: {
        'Authorization': `Bearer ${testSession.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('should sign out user', async () => {
    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
  });

  test('should reject API calls without auth', async () => {
    const response = await fetch('http://localhost:3000/api/projects', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status).toBe(401);
  });
}); 