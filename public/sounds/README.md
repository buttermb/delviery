# Sound Files

This directory should contain the following audio files for sound alerts:

| File | Purpose | Recommended Duration |
|------|---------|---------------------|
| `new-order.mp3` | New order received notification | 1-2 seconds |
| `order-ready.mp3` | Order is ready for pickup/delivery | 1-2 seconds |
| `new-message.mp3` | New chat message received | 0.5-1 second |
| `alert.mp3` | Generic alert sound | 0.5-1 second |
| `success.mp3` | Successful action | 0.5-1 second |
| `error.mp3` | Error or failure | 0.5-1 second |

## Recommended Sources

Free notification sounds can be found at:
- [Notification Sounds](https://notificationsounds.com/)
- [Zapsplat](https://www.zapsplat.com/) (requires free account)
- [Freesound](https://freesound.org/)

## File Format

- **Format**: MP3 or OGG (MP3 preferred for compatibility)
- **Bitrate**: 128kbps is sufficient for notification sounds
- **Size**: Keep files under 100KB for fastest loading

## Implementation

To add sounds:
1. Download/create MP3 files
2. Place them in `public/sounds/`
3. The sound alert system will automatically use them

Sounds are optional - the system will work without them, just no audio will play.
