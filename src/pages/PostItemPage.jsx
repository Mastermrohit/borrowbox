import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Books', 'Electronics', 'Clothing', 'Furniture', 'Sports', 'Other']

export default function PostItemPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('lend')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Create and clean up object URL whenever imageFile changes
  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [imageFile])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!category) {
      setError('Please select a category.')
      return
    }
    if (!type) {
      setError('Please select a type.')
      return
    }

    setSubmitting(true)
    try {
      let imageUrl = null

      // Upload image if provided
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(path, imageFile)

        if (uploadError) {
          setError(`Image upload failed: ${uploadError.message}`)
          return
        }

        imageUrl = supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl
      }

      // Insert item record
      const { data: newItem, error: insertError } = await supabase
        .from('items')
        .insert({
          owner_id: user.id,
          title: title.trim(),
          description: description.trim(),
          category,
          type,
          status: 'available',
          image_url: imageUrl || null,
        })
        .select('id')
        .single()

      if (insertError) {
        setError(`Failed to create item: ${insertError.message}`)
        return
      }

      navigate(`/items/${newItem.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Post an Item</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Introduction to Algorithms"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Condition, edition, any relevant details…"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="text-red-500">*</span>
            </span>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="lend"
                  checked={type === 'lend'}
                  onChange={() => setType('lend')}
                  className="accent-indigo-600"
                />
                Lend
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="donate"
                  checked={type === 'donate'}
                  onChange={() => setType('donate')}
                  className="accent-indigo-600"
                />
                Donate
              </label>
            </div>
          </div>

          {/* Image */}
          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
              Photo
            </label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-3 rounded-xl object-cover h-48 w-full"
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post Item'}
          </button>

        </form>
      </div>
    </div>
  )
}
