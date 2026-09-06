import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import ItemCard from '../components/ItemCard'

const CATEGORIES = ['Books', 'Electronics', 'Clothing', 'Furniture', 'Sports', 'Other']

export default function BrowsePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')

  useEffect(() => {
    async function fetchItems() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      // Fetch all owner usernames in one query
      const ownerIds = [...new Set(data.map((item) => item.owner_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ownerIds)

      const usernameById = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p.username])
      )

      setItems(data.map((item) => ({ ...item, ownerUsername: usernameById[item.owner_id] ?? null })))
      setLoading(false)
    }

    fetchItems()
  }, [])

  const filteredItems = useMemo(() => {
    let result = items

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          (item.description && item.description.toLowerCase().includes(term))
      )
    }

    if (category) {
      result = result.filter((item) => item.category === category)
    }

    if (type) {
      result = result.filter((item) => item.type === type)
    }

    return result
  }, [items, search, category, type])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Browse Items</h1>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          <option value="lend">Lend</option>
          <option value="donate">Donate</option>
        </select>
      </div>

      {/* States */}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <p className="text-gray-400 text-sm">No items found.</p>
      )}

      {/* Item grid */}
      {!loading && !error && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
