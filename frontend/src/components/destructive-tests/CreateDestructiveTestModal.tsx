'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CreateDestructiveTestModalProps {
  onClose: () => void
  onCreateTest: (test: {
    sampleId: string
    date: string
    width: number
    height: number
    testResult: 'pass' | 'fail' | 'pending'
    location: string
    notes: string
    x: number
    y: number
  }) => void
}

export default function CreateDestructiveTestModal({
  onClose,
  onCreateTest
}: CreateDestructiveTestModalProps) {
  const [testData, setTestData] = useState({
    sampleId: '',
    date: new Date().toISOString().slice(0, 10),
    width: 20,
    height: 20,
    testResult: 'pending' as 'pass' | 'fail' | 'pending',
    location: '',
    notes: '',
    x: 200,
    y: 200
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!testData.sampleId) {
      newErrors.sampleId = 'Sample ID is required'
    } else if (!/^D-\d+$/.test(testData.sampleId)) {
      newErrors.sampleId = 'Sample ID must be in format D-{number} (e.g. D-1, D-2)'
    }

    if (testData.width <= 0) {
      newErrors.width = 'Width must be greater than 0'
    }

    if (testData.height <= 0) {
      newErrors.height = 'Height must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    setTestData({
      ...testData,
      [name]: ['width', 'height', 'x', 'y'].includes(name) ? Number(value) : value
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validate()) {
      onCreateTest({
        ...testData
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Add New Destructive Test</h2>
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
                value={testData.date}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block mb-1">
                Sample ID (D-{'{number}'}) *
                {errors.sampleId && (
                  <span className="text-red-500 ml-1 text-sm">{errors.sampleId}</span>
                )}
              </label>
              <input
                type="text"
                name="sampleId"
                value={testData.sampleId}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.sampleId ? 'border-red-500' : ''}`}
                placeholder="e.g. D-1, D-2"
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
                value={testData.width}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.width ? 'border-red-500' : ''}`}
                min="1"
                step="0.5"
              />
            </div>
            
            <div>
              <label className="block mb-1">
                Height (ft) *
                {errors.height && (
                  <span className="text-red-500 ml-1 text-sm">{errors.height}</span>
                )}
              </label>
              <input
                type="number"
                name="height"
                value={testData.height}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.height ? 'border-red-500' : ''}`}
                min="1"
                step="0.5"
              />
            </div>
            
            <div>
              <label className="block mb-1">Test Result</label>
              <select
                name="testResult"
                value={testData.testResult}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="pending">Pending</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block mb-1">Location / Comment</label>
            <textarea
              name="location"
              value={testData.location}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="e.g. Northeast corner, 2' inset"
              rows={2}
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">Notes</label>
            <textarea
              name="notes"
              value={testData.notes}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="Additional notes about this test"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Destructive Test
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

