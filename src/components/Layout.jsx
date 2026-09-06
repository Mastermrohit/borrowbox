import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-xs text-gray-400">
        BorrowBox — Hackathon MVP
      </footer>
    </>
  )
}
