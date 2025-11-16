import Lottie from 'lottie-react';
import { cn } from '@/lib/utils';

interface LoadingAnimationProps {
  className?: string;
  text?: string;
}

// Simple loading animation data
const loadingAnimation = {
  v: "5.5.7",
  fr: 60,
  ip: 0,
  op: 120,
  w: 200,
  h: 200,
  nm: "Loading",
  ddd: 0,
  assets: [],
  layers: [{
    ddd: 0,
    ind: 1,
    ty: 4,
    nm: "Circle",
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 1, k: [{ t: 0, s: [0], e: [360] }, { t: 120 }] },
      p: { a: 0, k: [100, 100, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    shapes: [{
      ty: "gr",
      it: [{
        d: 1,
        ty: "el",
        s: { a: 0, k: [80, 80] },
        p: { a: 0, k: [0, 0] }
      }, {
        ty: "st",
        c: { a: 0, k: [0.4, 0.6, 1, 1] },
        o: { a: 0, k: 100 },
        w: { a: 0, k: 8 },
        lc: 2
      }, {
        ty: "tr",
        p: { a: 0, k: [0, 0] },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 }
      }]
    }],
    ip: 0,
    op: 120,
    st: 0
  }]
};

export function LoadingAnimation({ className, text }: LoadingAnimationProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <Lottie
        animationData={loadingAnimation}
        loop
        className="w-32 h-32"
      />
      {text && (
        <p className="text-sm text-muted-foreground mt-4">{text}</p>
      )}
    </div>
  );
}
