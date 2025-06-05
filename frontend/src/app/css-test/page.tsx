'use client';

export default function CSSTest() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">CSS Diagnostic Test</h1>
      
      {/* Navy Color Tests */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Navy Colors Test</h2>
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-navy-50 p-4 text-center">navy-50</div>
          <div className="bg-navy-100 p-4 text-center">navy-100</div>
          <div className="bg-navy-600 p-4 text-center text-white">navy-600</div>
          <div className="bg-navy-800 p-4 text-center text-white">navy-800</div>
          <div className="bg-navy-900 p-4 text-center text-white">navy-900</div>
        </div>
      </div>

      {/* Orange Color Tests */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Orange Colors Test</h2>
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-orange-50 p-4 text-center">orange-50</div>
          <div className="bg-orange-100 p-4 text-center">orange-100</div>
          <div className="bg-orange-600 p-4 text-center text-white">orange-600</div>
          <div className="bg-orange-700 p-4 text-center text-white">orange-700</div>
          <div className="bg-orange-900 p-4 text-center text-white">orange-900</div>
        </div>
      </div>

      {/* Text Color Tests */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Text Colors Test</h2>
        <div className="space-y-2">
          <p className="text-navy-600">Navy text-navy-600</p>
          <p className="text-navy-900">Navy text-navy-900</p>
          <p className="text-orange-500">Orange text-orange-500</p>
          <p className="text-orange-600">Orange text-orange-600</p>
        </div>
      </div>

      {/* Button Tests */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Button Tests</h2>
        <div className="space-x-4">
          <button className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded">Navy Button</button>
          <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded">Orange Button</button>
        </div>
      </div>

      {/* Same Classes as Dashboard */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Dashboard Classes Test</h2>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-navy-100 rounded-lg flex items-center justify-center">
              <span className="text-navy-600">N</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Test Card</p>
              <p className="text-2xl font-bold text-gray-900">Value</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600">O</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Orange Test</p>
              <p className="text-2xl font-bold text-orange-600">Orange Value</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}