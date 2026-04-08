/**
 * BIOS + Emulator Configuration
 * Edit this file to customise everything.
 */
window.BIOS_CONFIG = {

  /* ── Machine Identity ──────────────────────────────── */
  cpu:          'Intel(R) Pentium(R) CPU @ 100MHz',
  cpuSpeed:     '100MHz',
  ramMB:        16,
  ramFrequency: '60 ns EDO',
  biosDate:     '04/25/94 09:12:53',
  biosVer:      '04.00.01',
  drives: {
    priMaster:  'LBA, 504 MB',
    priSlave:   'Not Detected',
    secMaster:  'Not Detected',
    secSlave:   'Not Detected',
  },
  bootOrder: ['Floppy (A:)', 'Hard Disk (C:)', 'CD-ROM'],

  /* ── Timing ────────────────────────────────────────── */
  timing: {
    blackFlash:       350,
    fanSpinDuration:  1400,
    memCountDuration: 3200,
    summaryHold:      2500,   /* short — real BIOS only holds ~2s */
    handoffDelay:     400,
  },

  /* ── Visual Effects ────────────────────────────────── */
  effects: {
    crtBezel:         true,
    barrelDistortion: true,
    phosphorBurnIn:   true,
    powerLED:         true,
    crtFlicker:       true,
    screenJitter:     true,
    glitchLines:      true,
  },

  /* ── Sound ─────────────────────────────────────────── */
  sounds: {
    fanSpinUp:       true,
    degauss:         true,
    postBeep:        true,
    typewriterSound: true,
    hdSeekSound:     true,
  },

  /* ── Easter Eggs ───────────────────────────────────── */
  easterEggs: {
    failChance:   0.10,
    virusChance:  0.20,
    keyboardJoke: 0.15,
    konamiUnlock: true,
    doomUnlock:   true,
  },

  /* ══════════════════════════════════════════════════════
     v86 EMULATOR SETTINGS
     ══════════════════════════════════════════════════════
     diskImageUrl — URL to the MS-DOS 6.22 floppy image.

     We use a publicly available DOS 6.22 boot disk image
     hosted on the Internet Archive (public domain).

     The image is a standard 1.44 MB FAT12 floppy that
     contains: IO.SYS, MSDOS.SYS, COMMAND.COM, AUTOEXEC.BAT,
     CONFIG.SYS, EDIT.COM, FORMAT.COM, SCANDISK.EXE,
     DEFRAG.EXE, MEM.EXE, FDISK.EXE, SYS.COM, and more.

     If you want to use your OWN disk image:
       1. Put the .img file next to index.html
       2. Change diskImageUrl to './my-disk.img'

     CORS note: images must be served from the same origin
     OR have Access-Control-Allow-Origin: * headers.
     The archive.org URL below has CORS enabled.
  ════════════════════════════════════════════════════════ */
  emulator: {

    /*
      Primary: raw 1.44 MB MS-DOS 6.22 boot floppy
      Source: Winworld / archive.org (public domain)
    */
    diskImageUrl: 'https://archive.org/download/msdos622/MS-DOS622.img',

    /*
      Fallback if primary fails — smaller FreeDOS floppy
      which has COMMAND.COM + core utilities (~600 KB)
    */
    fallbackUrl: 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/distributions/1.3/official/FD13BOOT.img',

    /* RAM for the emulated machine in megabytes */
    memoryMB: 16,

    /* v86 runs the CPU as fast as possible — set false to throttle */
    fastBoot: true,

    /* Scale the emulator canvas to fill the screen area */
    scaleToFit: true,

    /* Show the hints bar at the bottom */
    showHints: true,
  },
};
 