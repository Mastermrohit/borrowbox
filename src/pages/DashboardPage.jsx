import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── helpers ────────────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = {
    available:        'bg-green-100 text-green-700',
    borrowed:         'bg-amber-100 text-amber-700',
    pending:          'bg-yellow-100 text-yellow-700',
    approved:         'bg-green-100 text-green-700',
    rejected:         'bg-red-100 text-red-700',
    return_requested: 'bg-orange-100 text-orange-700',
    returned:         'bg-gray-100 text-gray-600',
  }
  const label = status === 'return_requested' ? 'Return Requested' : status
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('listings')
  const [myItems, setMyItems] = useState([])
  const [inboxRequests, setInboxRequests] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [requesterProfiles, setRequesterProfiles] = useState({}) // id → username
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── fetch on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [user])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [itemsRes, inboxRes, reqRes] = await Promise.all([
        // 1. My listings
        supabase
          .from('items')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),

        // 2. Inbox — requests on my items
        supabase
          .from('borrow_requests')
          .select('id, status, message, created_at, returned_at, requester_id, item_id, items!inner(id, title, owner_id)')
          .eq('items.owner_id', user.id)
          .order('created_at', { ascending: false }),

        // 3. My outgoing requests
        supabase
          .from('borrow_requests')
          .select('id, status, message, created_at, item_id, items(id, title)')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (itemsRes.error) throw itemsRes.error
      if (inboxRes.error) throw inboxRes.error
      if (reqRes.error) throw reqRes.error

      setMyItems(itemsRes.data ?? [])
      setMyRequests(reqRes.data ?? [])

      const inbox = inboxRes.data ?? []
      setInboxRequests(inbox)

      // Batch-fetch requester usernames
      const uniqueIds = [...new Set(inbox.map(r => r.requester_id).filter(Boolean))]
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', uniqueIds)
        const map = {}
        ;(profiles ?? []).forEach(p => { map[p.id] = p.username })
        setRequesterProfiles(map)
      }
    } catch (err) {
      setError(err.message ?? 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  // ── sign out ────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await signOut()
    navigate('/browse')
  }

  // ── my listings actions ─────────────────────────────────────────────────
  async function handleDelete(item) {
    if (!window.confirm('Delete this item?')) return
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) { alert(error.message); return }
    setMyItems(prev => prev.filter(i => i.id !== item.id))
  }

  async function handleMarkReturned(item) {
    const { error } = await supabase
      .from('items')
      .update({ status: 'available' })
      .eq('id', item.id)
    if (error) { alert(error.message); return }
    setMyItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'available' } : i))
  }

  // Owner: confirm hand-off after approval → request moves to 'borrowed'
  async function handleConfirmHandoff(req) {
    const { error } = await supabase
      .from('borrow_requests')
      .update({ status: 'borrowed' })
      .eq('id', req.id)
      .eq('status', 'approved') // guard: only transition from approved
    if (error) { alert(error.message); return }
    setInboxRequests(prev =>
      prev.map(r => r.id === req.id ? { ...r, status: 'borrowed' } : r)
    )
  }

  // Owner: confirm physical return → request becomes 'returned', item becomes 'available'
  async function handleConfirmReturn(req) {
    const now = new Date().toISOString()

    const { error: e1 } = await supabase
      .from('borrow_requests')
      .update({ status: 'returned', returned_at: now })
      .eq('id', req.id)
      .eq('status', 'return_requested') // guard: only transition from return_requested
    if (e1) { alert(e1.message); return }

    const { error: e2 } = await supabase
      .from('items')
      .update({ status: 'available' })
      .eq('id', req.item_id)
    if (e2) { alert(e2.message); return }

    setInboxRequests(prev =>
      prev.map(r => r.id === req.id ? { ...r, status: 'returned', returned_at: now } : r)
    )
    setMyItems(prev =>
      prev.map(i => i.id === req.item_id ? { ...i, status: 'available' } : i)
    )
  }

  // Borrower: request return → request moves to 'return_requested'
  async function handleRequestReturn(req) {
    const { error } = await supabase
      .from('borrow_requests')
      .update({ status: 'return_requested' })
      .eq('id', req.id)
      .eq('status', 'borrowed') // guard: only transition from borrowed
    if (error) { alert(error.message); return }
    setMyRequests(prev =>
      prev.map(r => r.id === req.id ? { ...r, status: 'return_requested' } : r)
    )
  }

  // ── inbox actions ───────────────────────────────────────────────────────
  async function handleApprove(req) {
    const { error: e1 } = await supabase
      .from('borrow_requests')
      .update({ status: 'approved' })
      .eq('id', req.id)
    if (e1) { alert(e1.message); return }

    const { error: e2 } = await supabase
      .from('items')
      .update({ status: 'borrowed' })
      .eq('id', req.item_id)
    if (e2) { alert(e2.message); return }

    setInboxRequests(prev =>
      prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r)
    )
  }

  async function handleReject(req) {
    const { error } = await supabase
      .from('borrow_requests')
      .update({ status: 'rejected' })
      .eq('id', req.id)
    if (error) { alert(error.message); return }
    setInboxRequests(prev =>
      prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r)
    )
  }

  // ── render helpers ──────────────────────────────────────────────────────
  const tabs = [
    { id: 'listings', label: 'My Listings' },
    { id: 'inbox',    label: 'Request Inbox' },
    { id: 'requests', label: 'My Requests' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <button
          onClick={handleSignOut}
          className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <p className="text-gray-500 text-sm">Loading…</p>
      )}
      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      {!loading && !error && (
        <>
          {activeTab === 'listings' && <MyListingsTab items={myItems} onDelete={handleDelete} onMarkReturned={handleMarkReturned} />}
          {activeTab === 'inbox'    && <InboxTab requests={inboxRequests} profiles={requesterProfiles} onApprove={handleApprove} onReject={handleReject} onConfirmHandoff={handleConfirmHandoff} onConfirmReturn={handleConfirmReturn} />}
          {activeTab === 'requests' && <MyRequestsTab requests={myRequests} onRequestReturn={handleRequestReturn} />}
        </>
      )}
    </div>
  )
}

// ─── My Listings tab ─────────────────────────────────────────────────────────

function MyListingsTab({ items, onDelete, onMarkReturned }) {
  if (items.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        You haven't posted any items yet.{' '}
        <Link to="/post" className="text-indigo-600 hover:underline">Post one</Link>
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map(item => (
        <li key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          {item.image_url
            ? <img src={item.image_url} alt={item.title} className="h-16 w-16 rounded-lg object-cover flex-shrink-0" />
            : <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-300 text-xs">No img</div>
          }
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-gray-900 truncate">{item.title}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.category}</span>
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full capitalize">{item.type}</span>
              {statusBadge(item.status)}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => onDelete(item)}
                className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200"
              >
                Delete
              </button>
              {item.status === 'borrowed' && (
                <button
                  onClick={() => onMarkReturned(item)}
                  className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-200"
                >
                  Mark as Returned
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Request Inbox tab ────────────────────────────────────────────────────────

function InboxTab({ requests, profiles, onApprove, onReject, onConfirmHandoff, onConfirmReturn }) {
  if (requests.length === 0) {
    return <p className="text-gray-500 text-sm">No incoming requests yet.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {requests.map(req => (
        <li key={req.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">{req.items?.title ?? '—'}</span>
              {statusBadge(req.status)}
            </div>
            <p className="text-sm text-gray-500 mb-0.5">
              Requested by{' '}
              <span className="font-medium text-gray-700">
                {profiles[req.requester_id] ?? req.requester_id?.slice(0, 8) + '…'}
              </span>
            </p>
            {req.message && (
              <p className="text-sm text-gray-600 italic mt-1">"{req.message}"</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(req.created_at).toLocaleDateString()}
            </p>
            {req.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onApprove(req)}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject(req)}
                  className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200"
                >
                  Reject
                </button>
              </div>
            )}
            {req.status === 'approved' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onConfirmHandoff(req)}
                  className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600"
                >
                  Confirm Hand-off
                </button>
              </div>
            )}
            {req.status === 'return_requested' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onConfirmReturn(req)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
                >
                  Confirm Return Received
                </button>
              </div>
            )}
            {req.status === 'returned' && req.returned_at && (
              <p className="text-xs text-gray-400 mt-2">
                Returned on {new Date(req.returned_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── My Requests tab ──────────────────────────────────────────────────────────

function MyRequestsTab({ requests, onRequestReturn }) {
  if (requests.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        You haven't requested any items yet.{' '}
        <Link to="/browse" className="text-indigo-600 hover:underline">Browse items</Link>
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {requests.map(req => (
        <li key={req.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Link
                to={`/items/${req.item_id}`}
                className="font-medium text-indigo-600 hover:underline"
              >
                {req.items?.title ?? 'Item'}
              </Link>
              {statusBadge(req.status)}
            </div>
            {req.message && (
              <p className="text-sm text-gray-600 italic mt-1 truncate">"{req.message}"</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(req.created_at).toLocaleDateString()}
            </p>
            {req.status === 'borrowed' && (
              <div className="mt-3">
                <button
                  onClick={() => onRequestReturn(req)}
                  className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-200"
                >
                  Request Return
                </button>
              </div>
            )}
            {req.status === 'return_requested' && (
              <p className="text-xs text-orange-600 mt-2">
                Return request sent. Waiting for owner confirmation.
              </p>
            )}
            {req.status === 'returned' && (
              <p className="text-xs text-gray-500 mt-2">
                Item successfully returned.
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
