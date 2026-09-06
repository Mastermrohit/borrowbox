import { Link } from 'react-router-dom'

export default function ItemCard({ item }) {
  const username = item.ownerUsername ?? 'Unknown'

  return (
    <Link
      to={`/items/${item.id}`}
      className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow block"
    >
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.title}
          className="object-cover h-48 w-full rounded-t-xl"
        />
      ) : (
        <div className="h-48 w-full bg-gray-200 rounded-t-xl" />
      )}

      <div className="p-4">
        <p className="text-base font-semibold text-gray-900 mb-2">{item.title}</p>

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
        </div>

        <p className="text-xs text-gray-500">by {username}</p>
      </div>
    </Link>
  )
}
