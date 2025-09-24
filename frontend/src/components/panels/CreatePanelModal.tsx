'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CreatePanelModalProps {
  onClose: () => void
  onCreatePanel: (panel: {
    date: string
    panelNumber: string
    length: number
    width: number
    rollNumber: string
    location: string
    shape: 'rectangle' | 'right-triangle' | 'patch'
    points?: number[]
    radius?: number
  }) => void
}

export default function CreatePanelModal({
  onClose,
  onCreatePanel
}: CreatePanelModalProps) {
  const [panelData, setPanelData] = useState({
    date: new Date().toISOString().slice(0, 10),
    panelNumber: '',
    length: 100,
    width: 40,
    rollNumber: '',
    location: '',
    shape: 'rectangle' as 'rectangle' | 'right-triangle' | 'patch'
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!panelData.panelNumber) {
      newErrors.panelNumber = 'Panel number is required'
    }
    
    if (panelData.length <= 0) {
      newErrors.length = 'Length must be greater than 0'
    }
    
    if (panelData.width <= 0) {
      newErrors.width = 'Width must be greater than 0'
    }
    
    if (!panelData.rollNumber) {
      newErrors.rollNumber = 'Roll number is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    setPanelData({
      ...panelData,
      [name]: ['length', 'width'].includes(name) ? Number(value) : value
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validate()) {
      onCreatePanel({
        ...panelData
      })
    }
  }

  // Common panel sizes presets
  const presets = [
    { name: '60 mil × 100 ft Standard', width: 22.5, length: 100 },
    { name: '60 mil × 75 ft Standard', width: 22.5, length: 75 },
    { name: '80 mil × 100 ft Heavy-Duty', width: 22.5, length: 100 },
    { name: '40 mil × 100 ft Light-Duty', width: 22.5, length: 100 },
    { name: '60 mil × 150 ft Custom', width: 22.5, length: 150 },
  ]

  const applyPreset = (preset: { width: number, length: number }) => {
    setPanelData({
      ...panelData,
      width: preset.width,
      length: preset.length
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Add New Panel</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1">Date</label>
              <input
                type="date"
                name="date"
                value={panelData.date}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block mb-1">
                Panel Number *
                {errors.panelNumber && (
                  <span className="text-red-500 ml-1 text-sm">{errors.panelNumber}</span>
                )}
              </label>
              <input
                type="text"
                name="panelNumber"
                value={panelData.panelNumber}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.panelNumber ? 'border-red-500' : ''}`}
                placeholder="e.g. PA-01"
              />
            </div>
            
            {/* Dimensions - conditional based on shape */}
            {panelData.shape === 'patch' ? (
              <div>
                <label className="block mb-1">Patch Dimensions</label>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="text-sm text-gray-600">
                    <div>Diameter: 13.33 ft</div>
                    <div>Radius: 6.67 ft</div>
                    <div className="text-xs mt-1">Fixed size for 30 patches on 400ft panel</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block mb-1">
                    Length (ft) *
                    {errors.length && (
                      <span className="text-red-500 ml-1 text-sm">{errors.length}</span>
                    )}
                  </label>
                  <input
                    type="number"
                    name="length"
                    value={panelData.length}
                    onChange={handleChange}
                    className={`w-full p-2 border rounded ${errors.length ? 'border-red-500' : ''}`}
                    min="1"
                    step="0.5"
                  />
                </div>
                
                <div>
                  <label className="block mb-1">
                    Width (ft) *
                    {errors.width && (
                      <span className="text-red-500 ml-1 text-sm">{errors.width}</span>
                    )}
                  </label>
                  <input
                    type="number"
                    name="width"
                    value={panelData.width}
                    onChange={handleChange}
                    className={`w-full p-2 border rounded ${errors.width ? 'border-red-500' : ''}`}
                    min="1"
                    step="0.5"
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block mb-1">
                Roll Number *
                {errors.rollNumber && (
                  <span className="text-red-500 ml-1 text-sm">{errors.rollNumber}</span>
                )}
              </label>
              <input
                type="text"
                name="rollNumber"
                value={panelData.rollNumber}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.rollNumber ? 'border-red-500' : ''}`}
                placeholder="e.g. R-101"
              />
            </div>
            
            <div>
              <label className="block mb-1">Shape</label>
              <select
                name="shape"
                value={panelData.shape}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="rectangle">Rectangle</option>
                <option value="right-triangle">Right Triangle</option>
                <option value="patch">Patch</option>
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block mb-1">Panel Location / Comment</label>
            <textarea
              name="location"
              value={panelData.location}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="e.g. Northeast corner, 2' inset"
              rows={2}
            />
          </div>

          <div className="mb-4">
            <h3 className="font-medium mb-2">Common Panel Templates</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {presets.map((preset, index) => (
                <Button 
                  key={index}
                  type="button"
                  variant="outline"
                  onClick={() => applyPreset(preset)}
                  className="text-sm h-auto py-1"
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Panel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}