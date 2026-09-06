import { useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] ?? styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function ItemDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()

  const [item, setItem] = useState(null)
  const [existingRequest, setExistingRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const fetchItem = supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

      const fetchRequest = user
        ? supabase
            .from('borrow_requests')
            .select('id, status')
            .eq('item_id', id)
            .eq('requester_id', user.id)
            .in('status', ['pending', 'approved', 'borrowed', 'return_requested'])
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })

      const [{ data: itemData, error: itemError }, { data: reqData, error: reqError }] =
        await Promise.all([fetchItem, fetchRequest])

      if (itemError) {
        setError(itemError.message)
        setLoading(false)
        return
      }

      // Fetch the owner's username from profiles separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', itemData.owner_id)
        .maybeSingle()

      setItem({ ...itemData, ownerUsername: profileData?.username ?? null })

      if (!reqError) {
        setExistingRequest(reqData)
      }

      setLoading(false)
    }

    load()
  }, [id, user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    const { error: insertError } = await supabase.from('borrow_requests').insert({
      item_id: id,
      requester_id: user.id,
      status: 'pending',
      message: message.trim() || null,
    })

    if (insertError) {
      setSubmitError(insertError.message)
    } else {
      setSubmitted(true)
    }

    setSubmitting(false)
  }

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-700 mb-4">Item not found.</p>
        <Link to="/browse" className="text-indigo-600 hover:underline text-sm">
          ← Back to Browse
        </Link>
      </div>
    )
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const username = item.ownerUsername ?? 'Unknown'
  const isOwner = user && user.id === item.owner_id

  // ── Borrow section ──────────────────────────────────────────────────────────

  let borrowSection
  if (!user) {
    borrowSection = (
      <p className="text-gray-600 text-sm">
        Want to borrow this?{' '}
        <Link to="/login" state={{ from: location }} className="text-indigo-600 hover:underline font-medium">
          Log in
        </Link>{' '}
        to request.
      </p>
    )
  } else if (isOwner) {
    borrowSection = (
      <p className="text-gray-600 text-sm">
        This is your listing.{' '}
        <Link to="/dashboard" className="text-indigo-600 hover:underline font-medium">
          Manage it on your dashboard
        </Link>
      </p>
    )
  } else if (existingRequest) {
    borrowSection = (
      <div className="flex items-center gap-3">
        <p className="text-gray-600 text-sm">You already requested this item.</p>
        <StatusBadge status={existingRequest.status} />
      </div>
    )
  } else if (submitted) {
    borrowSection = (
      <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
        Request sent! The lender will be in touch.
      </div>
    )
  } else {
    borrowSection = (
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a note for the lender (optional)"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        {submitError && (
          <p className="text-red-600 text-sm">{submitError}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Sending…' : 'Send Request'}
        </button>
      </form>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Image */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full rounded-xl object-cover max-h-96 mb-6"
        />
      ) : (
        <div className="w-full h-64 bg-gray-200 rounded-xl mb-6" />
      )}

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h1>

      {/* Description */}
      {item.description && (
        <p className="text-gray-700 text-sm mb-4">{item.description}</p>
      )}

      {/* Badges */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {item.category}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            item.type === 'donate'
              ? 'bg-green-100 text-green-700'
              : 'bg-indigo-100 text-indigo-700'
          }`}
        >
          {item.type === 'donate' ? 'Donate' : 'Lend'}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            item.status === 'available'
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {item.status === 'available' ? 'Available' : 'Borrowed'}
        </span>
      </div>

      {/* Posted by */}
      <p className="text-xs text-gray-500 mb-8">Posted by {username}</p>

      {/* Borrow section */}
      <div className="border-t border-gray-100 mt-8 pt-6">
        {borrowSection}
      </div>
    </div>
  )
}
