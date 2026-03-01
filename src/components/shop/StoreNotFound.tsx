import { Link } from 'react-router-dom';
import { Store, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StoreNotFound() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-neutral-100 to-neutral-50 flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Icon */}
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm border border-neutral-200">
          <Store className="h-14 w-14 text-neutral-400" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-3">
          Store Not Found
        </h1>

        {/* Description */}
        <p className="text-lg text-neutral-500 mb-2">
          The store you&apos;re looking for doesn&apos;t exist or is no longer available.
        </p>
        <p className="text-sm text-neutral-400 mb-10">
          Double-check the URL or browse our marketplace to find what you need.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/">
            <Button size="lg" className="gap-2">
              <Search className="h-4 w-4" />
              Browse Stores
            </Button>
          </Link>
          <Link to="/" onClick={(e) => { e.preventDefault(); window.history.back(); }}>
            <Button variant="outline" size="lg" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
