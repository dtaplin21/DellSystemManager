'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PATCH_CONFIG } from '@/types/patch'

interface CreatePatchModalProps {
  onClose: () => void
  onCreatePatch: (patch: {
    patchNumber: string
    date: string
    location: string
    notes: string
    x: number
    y: number
  }) => void
}

export default function CreatePatchModal({
  onClose,
  onCreatePatch
}: CreatePatchModalProps) {
  const [patchData, setPatchData] = useState({
    patchNumber: '',
    date: new Date().toISOString().slice(0, 10),
    location: '',
    notes: '',
    x: 100,
    y: 100
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!patchData.patchNumber) {
      newErrors.patchNumber = 'Patch number is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    setPatchData({
      ...patchData,
      [name]: value
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validate()) {
      onCreatePatch({
        ...patchData
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Add New Patch</h2>
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
                value={patchData.date}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block mb-1">
                Patch Number *
                {errors.patchNumber && (
                  <span className="text-red-500 ml-1 text-sm">{errors.patchNumber}</span>
                )}
              </label>
              <input
                type="text"
                name="patchNumber"
                value={patchData.patchNumber}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${errors.patchNumber ? 'border-red-500' : ''}`}
                placeholder="e.g. PATCH-01"
              />
            </div>
            
            <div>
              <label className="block mb-1">Patch Dimensions</label>
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-sm text-gray-600">
                  <div>Diameter: {PATCH_CONFIG.DIAMETER.toFixed(2)} ft</div>
                  <div>Radius: {PATCH_CONFIG.RADIUS.toFixed(2)} ft</div>
                  <div className="text-xs mt-1">Fixed size for 30 patches on 400ft panel</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block mb-1">Patch Location / Comment</label>
            <textarea
              name="location"
              value={patchData.location}
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
              value={patchData.notes}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="Additional notes about this patch"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Patch
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

