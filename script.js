(function () {
  "use strict";

  const sheetApiUrl = (window.SHEET_API_URL || "").trim();
  const localGuests = window.GUEST_LIST || {};
  const params = new URLSearchParams(window.location.search);
  const rawCode = params.get("code") || params.get("id");
  const guestCode = rawCode ? rawCode.trim() : "";

  const boardingPassEl = document.getElementById("boardingPass");
  const cursorGlowEl = document.getElementById("cursorGlow");
  const passengerNameEl = document.getElementById("passengerName");
  const guestCallsignEl = document.getElementById("guestCallsign");
  const guestSeatEl = document.getElementById("guestSeat");
  const checkinBtn = document.getElementById("checkinBtn");
  const checkinBtnText = document.getElementById("checkinBtnText");
  const checkinStatusEl = document.getElementById("checkinStatus");
  const calendarBtn = document.getElementById("calendarBtn");
  const guestNoteInput = document.getElementById("guestNoteInput");
  const soundToggleBtn = document.getElementById("soundToggleBtn");
  const soundLabelEl = document.getElementById("soundLabel");

  const storageKey = `vqh_checkin_${guestCode || "default"}`;

  function formatSeat(sst) {
    if (!sst) return "VIP-00";
    const num = String(sst).trim();
    return /^\d+$/.test(num) ? `VIP-${num.padStart(2, "0")}` : `VIP-${num}`;
  }

  function setCheckedIn(isChecked) {
    if (isChecked) {
      checkinBtn.classList.add("checked");
      checkinBtnText.textContent = "Đã Check-in";
      checkinStatusEl.textContent = "CONFIRMED";
      checkinStatusEl.classList.remove("status-confirmed");
      checkinStatusEl.classList.add("status-checked");
    } else {
      checkinBtn.classList.remove("checked");
      checkinBtnText.textContent = "Check-in Tham Dự";
      checkinStatusEl.textContent = "INVITED";
      checkinStatusEl.classList.add("status-confirmed");
      checkinStatusEl.classList.remove("status-checked");
    }
  }

  function applyGuest(guest) {
    if (guest && guest.name) {
      passengerNameEl.textContent = guest.name;
      guestCallsignEl.textContent = "bạn";
      guestSeatEl.textContent = formatSeat(guest.sst);
      document.title = `VIP Boarding Pass — ${guest.name}`;

      if (guest.comment !== undefined && guestNoteInput) {
        guestNoteInput.value = guest.comment;
      }
      if (guest.status && guest.status.toUpperCase() === "CONFIRMED") {
        localStorage.setItem(storageKey, "1");
        setCheckedIn(true);
      }
    } else {
      passengerNameEl.textContent = "Quý Khách";
      guestCallsignEl.textContent = "bạn";
      guestSeatEl.textContent = "VIP-00";
    }
  }

  // 1. Load Guest Data (Google Sheet first if configured, fallback to local GUEST_LIST)
  const fallbackGuest = guestCode && localGuests[guestCode] ? localGuests[guestCode] : null;
  applyGuest(fallbackGuest);

  if (localStorage.getItem(storageKey) === "1") {
    setCheckedIn(true);
  }

  if (sheetApiUrl && guestCode) {
    if (!fallbackGuest) {
      passengerNameEl.textContent = "Đang tải thông tin...";
    }
    fetch(`${sheetApiUrl}?code=${encodeURIComponent(guestCode)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ok && data.guest) {
          applyGuest(data.guest);
        } else if (!fallbackGuest) {
          applyGuest(null);
        }
      })
      .catch(() => {
        if (!fallbackGuest) {
          applyGuest(null);
        }
      });
  }

  // 2. Interactive Check-in & Silent Write Back (Status + Comment) to Google Sheet
  checkinBtn.addEventListener("click", async () => {
    const nextChecked = localStorage.getItem(storageKey) !== "1";
    const nextStatus = nextChecked ? "CONFIRMED" : "INVITED";
    const comment = guestNoteInput ? guestNoteInput.value.trim() : "";

    localStorage.setItem(storageKey, nextChecked ? "1" : "0");
    setCheckedIn(nextChecked);
    if (nextChecked) {
      launchFireworks();
    }

    if (sheetApiUrl && guestCode) {
      checkinBtn.disabled = true;
      try {
        await fetch(sheetApiUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ code: guestCode, status: nextStatus, comment })
        });
      } catch {
        // Lưu tạm trên thiết bị nếu mất kết nối
      } finally {
        checkinBtn.disabled = false;
      }
    }
  });

  // 3. Download .ics Calendar Event
  calendarBtn.addEventListener("click", () => {
    const year = new Date().getFullYear();
    const dtStart = `${year}1128T133000`;
    const dtEnd = `${year}1128T163000`;
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Vo Quoc Huy//Graduation Invitation//VI",
      "BEGIN:VEVENT",
      `UID:vqh-grad-${year}@bk268`,
      `DTSTART;TZID=Asia/Ho_Chi_Minh:${dtStart}`,
      `DTEND;TZID=Asia/Ho_Chi_Minh:${dtEnd}`,
      "SUMMARY:Lễ Tốt Nghiệp — Võ Quốc Huy",
      "DESCRIPTION:VIP Boarding Pass - Lễ Tốt Nghiệp của Võ Quốc Huy tại Trường Đại học Bách Khoa.",
      "LOCATION:Trường Đại học Bách Khoa, 268 Lý Thường Kiệt, P.14, Q.10, TP.HCM",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "le-tot-nghiep-vo-quoc-huy.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // 4. Mute / Unmute Epic Uplifting Graduation Music (Web Audio multi-layer)
  let audioCtx = null;
  let masterGain = null;
  let soundTimer = null;
  let isMuted = false;
  let stepIndex = 0;

  // Triumphant cinematic progression: C -> G -> Am -> F (112 BPM, 8th-note steps)
  const chords = [
    { bass: 130.81, pad: [261.63, 329.63, 392.0], arp: [523.25, 659.25, 783.99, 1046.5], lead: 783.99 },
    { bass: 98.0,   pad: [246.94, 293.66, 392.0], arp: [493.88, 587.33, 783.99, 987.77], lead: 880.0 },
    { bass: 110.0,  pad: [220.0, 261.63, 329.63], arp: [440.0, 523.25, 659.25, 880.0],  lead: 1046.5 },
    { bass: 87.31,  pad: [220.0, 261.63, 349.23], arp: [440.0, 523.25, 698.46, 880.0],  lead: 987.77 }
  ];

  function playTone(freq, type, startTime, duration, peakGain, filterFreq) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.06, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    if (filterFreq) {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(filterFreq, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  function playKick(startTime) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(125, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.16);

    gain.gain.setValueAtTime(0.14, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + 0.24);
  }

  function playMusicStep() {
    if (isMuted || !audioCtx || !masterGain || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const chordIdx = Math.floor(stepIndex / 8) % chords.length;
    const beatStep = stepIndex % 8;
    const chord = chords[chordIdx];

    // On downbeat of each bar: warm swelling string pad + sub bass
    if (beatStep === 0) {
      playTone(chord.bass, "triangle", now, 2.0, 0.09, 450);
      chord.pad.forEach((f) => {
        playTone(f, "sawtooth", now, 2.1, 0.018, 1200);
      });
      // Soaring climax lead note
      playTone(chord.lead, "triangle", now, 1.35, 0.032, 2600);
    }

    // Cinematic pulse kick on beats 1 and 3 (steps 0 and 4)
    if (beatStep === 0 || beatStep === 4) {
      playKick(now);
    }

    // Energetic rising arpeggio on every 8th note
    const arpFreq = chord.arp[beatStep % chord.arp.length];
    playTone(arpFreq, "triangle", now, 0.36, 0.032, 3200);

    // Extra octave shimmer on climax bar (F major, bar 4)
    if (chordIdx === 3 && beatStep === 4) {
      playTone(1046.5, "sine", now, 0.85, 0.03);
    }

    stepIndex++;
  }

  function ensureAudioStarted() {
    if (isMuted) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(1, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }

    masterGain.gain.setValueAtTime(1, audioCtx.currentTime);

    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(() => {
        if (!isMuted) {
          masterGain.gain.setValueAtTime(1, audioCtx.currentTime);
          playMusicStep();
        }
      });
    } else {
      playMusicStep();
    }

    if (!soundTimer) {
      soundTimer = setInterval(playMusicStep, 265);
    }
  }

  function stopAudioImmediately() {
    if (soundTimer) {
      clearInterval(soundTimer);
      soundTimer = null;
    }
    if (masterGain && audioCtx) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }
    if (audioCtx && audioCtx.state !== "closed") {
      audioCtx.suspend().catch(() => {});
    }
  }

  function updateSoundUI() {
    soundToggleBtn.classList.toggle("muted", isMuted);
    soundToggleBtn.setAttribute("aria-pressed", String(!isMuted));
    soundToggleBtn.setAttribute("aria-label", isMuted ? "Bật âm thanh" : "Tắt âm thanh");
    if (soundLabelEl) {
      soundLabelEl.textContent = isMuted ? "Đã tắt" : "Âm thanh";
    }
  }

  soundToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    isMuted = !isMuted;
    updateSoundUI();

    if (isMuted) {
      stopAudioImmediately();
    } else {
      ensureAudioStarted();
    }
  });

  // Auto-start gentle audio on first interaction outside soundToggleBtn
  document.addEventListener("pointerdown", (e) => {
    if (soundToggleBtn.contains(e.target)) return;
    if (!isMuted && (!audioCtx || audioCtx.state === "suspended")) {
      ensureAudioStarted();
    }
  });

  // 5. Ambient Gold Bokeh, Outside-Ticket Cursor/Touch Glow & Stardust Trail
  const canvas = document.getElementById("bokehCanvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let burstParticles = [];
  let trailParticles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function initBokeh() {
    const count = Math.min(36, Math.floor(window.innerWidth / 32));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.4 + 0.8,
      vy: -(Math.random() * 0.25 + 0.08),
      vx: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.45 + 0.15
    }));
  }
  initBokeh();

  // Works on both desktop mouse AND mobile touch anywhere (including over the ticket)
  let lastTrailTime = 0;
  let touchFadeTimer = null;

  function handlePointerEffect(clientX, clientY, count = 2) {
    if (touchFadeTimer) {
      clearTimeout(touchFadeTimer);
      touchFadeTimer = null;
    }

    cursorGlowEl.style.opacity = "1";
    cursorGlowEl.style.left = `${clientX}px`;
    cursorGlowEl.style.top = `${clientY}px`;

    const now = performance.now();
    if (now - lastTrailTime > 18) {
      lastTrailTime = now;
      for (let i = 0; i < count; i++) {
        trailParticles.push({
          x: clientX + (Math.random() - 0.5) * 16,
          y: clientY + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1 - 0.35,
          r: Math.random() * 2.4 + 1,
          alpha: 0.9,
          color: Math.random() > 0.35 ? "#ffe3a3" : "#4da6ff"
        });
      }
      if (!fwAnimId) {
        fwLoop();
      }
    }
  }

  document.addEventListener("pointermove", (e) => {
    handlePointerEffect(e.clientX, e.clientY, 2);
  });

  document.addEventListener("pointerdown", (e) => {
    lastTrailTime = 0;
    handlePointerEffect(e.clientX, e.clientY, 6);
  });

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      lastTrailTime = 0;
      handlePointerEffect(t.clientX, t.clientY, 6);
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      handlePointerEffect(t.clientX, t.clientY, 2);
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    () => {
      touchFadeTimer = setTimeout(() => {
        cursorGlowEl.style.opacity = "0";
      }, 450);
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", () => {
    cursorGlowEl.style.opacity = "0";
  });

  // 6. Full-screen Intense Fireworks Overlay on Check-in
  const fwCanvas = document.getElementById("fireworksCanvas");
  const fwCtx = fwCanvas.getContext("2d");
  const rockets = [];
  const sparks = [];
  const rings = [];
  let fwAnimId = null;

  function resizeFwCanvas() {
    fwCanvas.width = window.innerWidth;
    fwCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeFwCanvas);
  resizeFwCanvas();

  const fwColors = ["#ffe3a3", "#f4c465", "#4da6ff", "#34d399", "#ff7eb6", "#ffd166", "#ffffff"];

  function explodeRocket(x, y, baseColor, isBig = false) {
    const count = isBig ? 130 : 95;
    rings.push({
      x,
      y,
      r: 8,
      maxR: isBig ? 140 : 95,
      alpha: 0.9,
      color: baseColor
    });

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
      const speed = Math.random() * (isBig ? 9.5 : 7.5) + 2.2;
      sparks.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 2.8 + 1.4,
        alpha: 1,
        decay: Math.random() * 0.012 + 0.009,
        color: Math.random() > 0.22 ? baseColor : "#ffffff",
        crackle: isBig && Math.random() > 0.82
      });
    }
  }

  function launchSingleRocket(delayMs, isBig = false) {
    setTimeout(() => {
      const startX = fwCanvas.width * (0.12 + Math.random() * 0.76);
      const targetY = fwCanvas.height * (0.12 + Math.random() * 0.38);
      rockets.push({
        x: startX,
        y: fwCanvas.height + 12,
        px: startX,
        py: fwCanvas.height + 12,
        vx: (Math.random() - 0.5) * 3.2,
        vy: -(Math.random() * 4.5 + 11.5),
        targetY,
        isBig,
        color: fwColors[Math.floor(Math.random() * fwColors.length)]
      });
      if (!fwAnimId) {
        fwLoop();
      }
    }, delayMs);
  }

  function launchFireworks() {
    // Wave 1: Immediate salvo
    [0, 90, 180, 270].forEach((d) => launchSingleRocket(d, false));
    // Wave 2: Rapid build-up
    [450, 560, 680, 800, 920].forEach((d) => launchSingleRocket(d, true));
    // Wave 3: Grand finale
    [1150, 1210, 1270, 1340, 1420].forEach((d) => launchSingleRocket(d, true));
  }

  function fwLoop() {
    fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);

    // Shockwave flash rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i];
      rg.r += (rg.maxR - rg.r) * 0.16;
      rg.alpha -= 0.045;
      if (rg.alpha <= 0) {
        rings.splice(i, 1);
        continue;
      }
      fwCtx.beginPath();
      fwCtx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      fwCtx.strokeStyle = rg.color;
      fwCtx.lineWidth = 2.5;
      fwCtx.globalAlpha = rg.alpha;
      fwCtx.stroke();
      fwCtx.globalAlpha = 1;
    }

    // Rockets with blazing tail
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.px = r.x;
      r.py = r.y;
      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.13;

      fwCtx.beginPath();
      fwCtx.moveTo(r.px, r.py);
      fwCtx.lineTo(r.x, r.y);
      fwCtx.strokeStyle = r.color;
      fwCtx.lineWidth = 3.5;
      fwCtx.stroke();

      if (r.y <= r.targetY || r.vy >= 0) {
        explodeRocket(r.x, r.y, r.color, r.isBig);
        rockets.splice(i, 1);
      }
    }

    // Sparks with glowing trails & secondary crackles
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.px = s.x;
      s.py = s.y;
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.975;
      s.vy = s.vy * 0.975 + 0.11;
      s.alpha -= s.decay;

      if (s.crackle && s.alpha < 0.45 && s.alpha > 0.35) {
        s.crackle = false;
        for (let k = 0; k < 5; k++) {
          const a = Math.random() * Math.PI * 2;
          sparks.push({
            x: s.x,
            y: s.y,
            px: s.x,
            py: s.y,
            vx: Math.cos(a) * 2.8,
            vy: Math.sin(a) * 2.8,
            r: 1.5,
            alpha: 0.9,
            decay: 0.035,
            color: "#ffffff",
            crackle: false
          });
        }
      }

      if (s.alpha <= 0) {
        sparks.splice(i, 1);
        continue;
      }

      fwCtx.beginPath();
      fwCtx.moveTo(s.px, s.py);
      fwCtx.lineTo(s.x, s.y);
      fwCtx.strokeStyle = s.color;
      fwCtx.lineWidth = s.r;
      fwCtx.lineCap = "round";
      fwCtx.globalAlpha = s.alpha;
      fwCtx.stroke();
      fwCtx.globalAlpha = 1;
    }

    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const tp = trailParticles[i];
      tp.x += tp.vx;
      tp.y += tp.vy;
      tp.alpha -= 0.024;
      tp.r *= 0.98;
      if (tp.alpha <= 0) {
        trailParticles.splice(i, 1);
        continue;
      }
      fwCtx.beginPath();
      fwCtx.arc(tp.x, tp.y, tp.r, 0, Math.PI * 2);
      fwCtx.globalAlpha = tp.alpha;
      fwCtx.fillStyle = tp.color;
      fwCtx.fill();
      fwCtx.globalAlpha = 1;
    }

    if (rockets.length > 0 || sparks.length > 0 || rings.length > 0 || trailParticles.length > 0) {
      fwAnimId = requestAnimationFrame(fwLoop);
    } else {
      fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
      fwAnimId = null;
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) {
        p.y = canvas.height + 10;
        p.x = Math.random() * canvas.width;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 196, 101, ${p.alpha})`;
      ctx.fill();
    }

    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const bp = burstParticles[i];
      bp.x += bp.vx;
      bp.y += bp.vy;
      bp.vy += 0.12;
      bp.alpha -= 0.02;
      if (bp.alpha <= 0) {
        burstParticles.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2);
      ctx.globalAlpha = bp.alpha;
      ctx.fillStyle = bp.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(animate);
  }
  animate();
})();
