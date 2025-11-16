// Simple back button - just copy and use anywhere

import { Link } from 'react-router-dom'

export default function BackHomeButton() {
  return (
    <div className="border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <svg 
            className="w-4 h-4 group-hover:-translate-x-1 transition-transform" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 19l-7-7m0 0l7-7m-7 7h18" 
            />
          </svg>
          <span className="text-sm font-medium">Back to Home</span>
        </Link>
      </div>
    </div>
  )
}

