import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import OuterFooter from '@/components/OuterFooter'
import { Home } from 'lucide-react'

const RegLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Routes where Home button should be hidden
  const hideHomeRoutes = [
    '/register-supervisor/home',
    '/register-supervisor/personal-info',
    '/register-supervisor/educational-details',
    '/register-supervisor/research-paper',
    '/register-supervisor/upload-documents',
    '/register-supervisor/preview',
    '/register-supervisor/payment',
    '/register-supervisor/print',
    '/register-supervisor/status',
    '/register-scholar/home',
    '/register-scholar/personal-info',
    '/register-scholar/educational-details',
    '/register-scholar/upload-documents',
    '/register-scholar/preview',
    '/register-scholar/payment',
    '/register-scholar/print',
    '/register-scholar/status',
    '/register-scholar/admission-fee',
    '/register-scholar/admission-details',
    '/register-scholar/counselling-fee',
    '/register-scholar/interview-remark'
  ]

  const shouldHideHome = hideHomeRoutes.some(
    route => location.pathname.startsWith(route)
  )

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <TopBar />

      {/* Simple Navigation Bar */}
      {!shouldHideHome && (
        <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] px-4 md:px-8 py-3">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-white hover:text-blue-100 transition-colors duration-150"
              title="Go to Home"
            >
              <Home size={20} />
              <span className="text-sm font-medium">Home</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1">
        <Outlet />
      </div>

      <OuterFooter />
    </div>
  )
}

export default RegLayout
