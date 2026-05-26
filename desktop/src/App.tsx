import { useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import RoomsPage from './pages/RoomsPage'
import BookingsPage from './pages/BookingsPage'
import PairingPage from './pages/PairingPage'
import './App.css'

export type Page = 'dashboard' | 'rooms' | 'bookings' | 'pairing'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />
      case 'rooms':     return <RoomsPage />
      case 'bookings':  return <BookingsPage />
      case 'pairing':   return <PairingPage />
      default:          return <DashboardPage />
    }
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
