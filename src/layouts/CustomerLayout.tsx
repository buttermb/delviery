import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'

interface CustomerLayoutProps {
  children: ReactNode
  showBackHome?: boolean
}

export default function CustomerLayout({ children, showBackHome = false }: CustomerLayoutProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      
      {/* Navigation - Same as homepage */}
      <Navigation />
      
      {/* Back to Home - Optional */}
      {showBackHome && (
        <div className="border-b border-white/5 bg-black mt-[88px]">
          <div className="container mx-auto px-6 py-4">
            <Link 
              to="/"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-light transition-colors group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Footer - Same as homepage */}
      <Footer />
      
    </div>
  )
}

