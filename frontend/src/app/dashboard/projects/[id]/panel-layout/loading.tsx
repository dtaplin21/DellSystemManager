export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Panel Layout</h2>
        <p className="text-gray-500">Setting up your project workspace...</p>
        
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Initializing canvas</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <span className="text-sm text-gray-600">Loading project data</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            <span className="text-sm text-gray-600">Preparing tools</span>
          </div>
        </div>
      </div>
    </div>
  );
}
