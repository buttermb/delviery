import { useState } from 'react';
import { ComparisonSlider } from 'react-comparison-slider';
import { cn } from '@/lib/utils';

interface ImageComparisonProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  aspectRatio?: number;
}

export function ImageComparison({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className,
  aspectRatio = 16 / 9
}: ImageComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  return (
    <div className={cn('rounded-lg overflow-hidden', className)}>
      <ComparisonSlider
        value={sliderPosition}
        onValueChange={setSliderPosition}
        aspectRatio={aspectRatio}
        itemOne={<img src={beforeImage} alt={beforeLabel} className="w-full h-full object-cover" />}
        itemTwo={<img src={afterImage} alt={afterLabel} className="w-full h-full object-cover" />}
      />
    </div>
  );
}
