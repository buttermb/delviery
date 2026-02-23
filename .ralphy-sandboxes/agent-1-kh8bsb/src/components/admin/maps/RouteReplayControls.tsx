import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Gauge,
  Clock,
  Battery,
  Navigation
} from 'lucide-react';
import { LocationPoint } from '@/hooks/useRunnerLocationHistory';
import { formatDistanceToNow } from 'date-fns';
import { formatSmartDate } from '@/lib/formatters';

interface RouteReplayControlsProps {
  locations: LocationPoint[];
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onIndexChange: (index: number) => void;
  onPlayPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

export function RouteReplayControls({
  locations,
  currentIndex,
  isPlaying,
  playbackSpeed,
  onIndexChange,
  onPlayPause,
  onReset,
  onSpeedChange,
}: RouteReplayControlsProps) {

  const currentLocation = locations[currentIndex];
  const progress = locations.length > 0 ? (currentIndex / (locations.length - 1)) * 100 : 0;

  const handleSliderChange = (value: number[]) => {
    const newIndex = Math.floor((value[0] / 100) * (locations.length - 1));
    onIndexChange(newIndex);
  };

  const handleSkipBack = () => {
    const newIndex = Math.max(0, currentIndex - 10);
    onIndexChange(newIndex);
  };

  const handleSkipForward = () => {
    const newIndex = Math.min(locations.length - 1, currentIndex + 10);
    onIndexChange(newIndex);
  };

  const speedOptions = [0.5, 1, 2, 5, 10];

  if (locations.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          No location data available for replay
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Current Location Info */}
      {currentLocation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Time</div>
              <div className="font-medium">
                {formatDistanceToNow(new Date(currentLocation.recorded_at), { addSuffix: true })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Speed</div>
              <div className="font-medium">
                {currentLocation.speed ? `${currentLocation.speed.toFixed(1)} km/h` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Heading</div>
              <div className="font-medium">
                {currentLocation.heading ? `${Math.round(currentLocation.heading)}°` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Battery className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Battery</div>
              <div className="font-medium">
                {currentLocation.battery_level ? `${currentLocation.battery_level}%` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Point {currentIndex + 1} of {locations.length}
          </span>
          <Badge variant="outline">
            {formatSmartDate(currentLocation?.recorded_at || '', { includeTime: true })}
          </Badge>
        </div>
        <Slider
          value={[progress]}
          onValueChange={handleSliderChange}
          max={100}
          step={100 / (locations.length - 1)}
          className="w-full"
        />
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            disabled={currentIndex === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSkipBack}
            disabled={currentIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            size="default"
            onClick={onPlayPause}
            className="gap-2"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Play
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSkipForward}
            disabled={currentIndex >= locations.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Speed:</span>
          <div className="flex gap-1">
            {speedOptions.map((speed) => (
              <Button
                key={speed}
                size="sm"
                variant={playbackSpeed === speed ? 'default' : 'outline'}
                onClick={() => onSpeedChange(speed)}
                className="min-w-[50px]"
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
