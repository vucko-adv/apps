# Sound Test

A test app (vucko-adv, Nov 2026): can an app on the iDrive 7 head unit play sound through the car's speakers, and how?
It is the first step toward an engine sound app (a made-up engine note following the revs and the throttle). It
changes nothing on the head unit: **Probe** only looks, and the sounds play only when a button is pressed, short and
quiet.

## On the page

- **Probe:** who the app runs as; the sound cards (`/proc/asound/cards`); `/dev/snd` and how many playback devices
  the app may open; the players on the head unit (aplay, paplay, pactl, pw-play, gst-launch-1.0, ...); PulseAudio's
  socket; the PCM names in `/etc/asound.conf`; `aplay -L` and, if there is `pactl`, PulseAudio's sinks. The main lines
  show on the page; the whole report goes to `probe.txt` in the app's data folder and to the log.
- **Device:** the ALSA device `aplay` plays to: `default`, then each name `aplay -L` gave (a tap goes to the next).
- **Tone:** 1 s of 440 Hz at a fifth of full scale, faded in and out, through `aplay` to that device.
- **Engine:** 3 s of a made-up four-cylinder from 1000 to 5000 rpm (the firing note, rpm / 60 x 2, and a few harmonics).
- **Tone, paplay / Tone, gst:** the tone through PulseAudio's player or GStreamer, if the head unit has them.

Each play shows the command, how it ended (the exit code and the first line it complained with) and how long it took.

## What to tell from it

Whether a sound was heard, through which player and device, whether the radio or the music stopped or went quieter
meanwhile, and how long a 1 s tone took to play (much longer: a slow start, so a sound following the revs would lag).
