import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceMessagePlayerProps {
  src: string;
  duration?: number; // stored duration hint in seconds
  isOwn: boolean;
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// Static decorative waveform bars (visual only, not real waveform data)
const BAR_COUNT = 28;
const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
  // Pseudo-random heights for a natural look
  const heights = [3,5,8,6,9,7,4,10,8,5,7,9,6,4,8,10,7,5,9,6,8,4,7,10,5,8,6,9];
  return heights[i % heights.length];
});

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = memo(({ src, duration, isOwn }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration ?? 0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      setProgress(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      await audio.play();
      setPlaying(true);
    }
  }, [playing]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  }, []);

  const displayTime = playing || currentTime > 0 ? currentTime : totalDuration;

  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[200px] max-w-[260px]",
      isOwn
        ? "bg-[hsl(var(--accent-primary))] rounded-br-sm"
        : "bg-card border border-border/60 rounded-bl-sm"
    )}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          isOwn
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-[hsl(var(--accent-primary)/0.12)] hover:bg-[hsl(var(--accent-primary)/0.2)] text-[hsl(var(--accent-primary))]"
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing
          ? <Pause className="w-3.5 h-3.5 fill-current" />
          : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        }
      </button>

      {/* Waveform + seek */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div
          className="flex items-center gap-[2px] h-8 cursor-pointer"
          onClick={handleSeek}
          role="slider"
          aria-label="Voice message progress"
        >
          {bars.map((h, i) => {
            const barProgress = i / BAR_COUNT;
            const active = barProgress <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-full flex-shrink-0 transition-colors",
                  isOwn
                    ? active ? "bg-white" : "bg-white/35"
                    : active ? "bg-[hsl(var(--accent-primary))]" : "bg-muted-foreground/30"
                )}
                style={{ width: 2, height: `${h * 2.5}px` }}
              />
            );
          })}
        </div>
        <span className={cn(
          "text-[10px] leading-none",
          isOwn ? "text-white/70" : "text-muted-foreground"
        )}>
          {formatDuration(displayTime)}
        </span>
      </div>
    </div>
  );
});

VoiceMessagePlayer.displayName = 'VoiceMessagePlayer';
export default VoiceMessagePlayer;
