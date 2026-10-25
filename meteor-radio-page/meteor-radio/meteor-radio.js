(() => {
    "use strict";

    const DATA_URL = "https://meteor-radio.billingboroughobservatory.space/detections.json";
    const IMAGE_BASE = "https://meteor-radio.billingboroughobservatory.space/";

    let detections = [];
    let lightboxDetections = detections;
    let currentIndex = 0;

    const $ = (id) => document.getElementById(id);

    function parseDate(value) {
        if (!value) return null;
        const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        const date = parseDate(value);
        if (!date) return "Unknown date";
        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric", month: "long", year: "numeric",
            timeZone: "UTC"
        }).format(date);
    }

    function formatTime(value, seconds = true) {
        const date = parseDate(value);
        if (!date) return "—";
        return new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit", minute: "2-digit",
            ...(seconds ? { second: "2-digit" } : {}),
            hour12: false, timeZone: "UTC"
        }).format(date);
    }

    function formatNumber(value, digits = 1) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toFixed(digits) : "—";
    }

    function imageUrl(path) {
        if (!path) return "";
        if (/^https?:\/\//i.test(path)) return path;

        const cleanPath = path.replace(/^\/+/, "");

        if (!cleanPath.startsWith("images/")) {
            return IMAGE_BASE + "images/" + cleanPath;
        }

        return IMAGE_BASE + cleanPath;
    }

    function audioUrl(path) {
        if (!path) return "";
        if (/^https?:\/\//i.test(path)) return path;

        const cleanPath = path.replace(/^\/+/, "");

        if (!cleanPath.startsWith("audio/")) {
            return IMAGE_BASE + "audio/" + cleanPath;
        }

        return IMAGE_BASE + cleanPath;
    }

    function sortNewestFirst(items) {
        return [...items].sort((a, b) => {
            const da = parseDate(a.timestamp_utc)?.getTime() || 0;
            const db = parseDate(b.timestamp_utc)?.getTime() || 0;
            return db - da;
        });
    }

    function renderStats(data) {
        const now = new Date();
        const today = data.filter(d => {
            const date = parseDate(d.timestamp_utc);
            return date && date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
        });

        $("today-count").textContent = today.length;

        if (!data.length) return;
        const last = data[0];
        $("last-time").textContent = formatTime(last.timestamp_utc, false);
        $("last-date").textContent = `${formatDate(last.timestamp_utc)} UTC`;

        if (today.length) {
            const strongest = [...today].sort((a, b) => Number(b.snr || -Infinity) - Number(a.snr || -Infinity))[0];
            $("strongest-snr").textContent = `${formatNumber(strongest.snr, 1)} dB`;
            $("strongest-time").textContent = `${formatTime(strongest.timestamp_utc)} UTC`;
        } else {
            $("strongest-snr").textContent = "—";
            $("strongest-time").textContent = "No detections today";
        }
    }

    function renderCards(data) {
        const grid = $("detection-grid");
        grid.innerHTML = "";

        if (!data.length) {
            grid.innerHTML = '<div class="loading-message">No Meteor Radio detections are currently available.</div>';
            return;
        }

        data.slice(0, 12).forEach((detection, index) => {
            const card = document.createElement("article");
            card.className = "detection-card";

            const imageButton = document.createElement("button");
            imageButton.className = "detection-image-button";
            imageButton.type = "button";
            imageButton.setAttribute("aria-label", `Open detection from ${formatDate(detection.timestamp_utc)} ${formatTime(detection.timestamp_utc)}`);
            imageButton.addEventListener("click", () => openLightbox(index));

            const image = document.createElement("img");
            image.className = "detection-image";
            image.loading = "lazy";
            image.src = imageUrl(detection.detail_image || detection.full_image);
            image.alt = `Meteor Radio spectrogram recorded ${formatDate(detection.timestamp_utc)} at ${formatTime(detection.timestamp_utc)} UTC`;
            imageButton.appendChild(image);

            const caption = document.createElement("div");
            caption.className = "detection-caption";
            caption.innerHTML = `
                <p class="detection-category">RADIO DETECTION</p>
                <h3>${formatDate(detection.timestamp_utc)}</h3>
                <p>${formatTime(detection.timestamp_utc)} UTC · ${formatNumber(detection.duration_seconds, 2)} s duration</p>
                <div class="detection-metrics">
                    <div class="detection-metric"><strong>${formatNumber(detection.snr, 1)} dB</strong><span>SNR</span></div>
                    <div class="detection-metric"><strong>${formatNumber(detection.doppler_estimate_hz, 0)} Hz</strong><span>Doppler</span></div>
                    <div class="detection-metric"><strong>${formatNumber(detection.spectral_peak_frequency_hz, 0)} Hz</strong><span>Peak offset</span></div>
                </div>
            `;

            if (detection.audio) {
                const audioWrap = document.createElement("div");
                audioWrap.className = "detection-audio";
                audioWrap.innerHTML = `
                    <span class="detection-audio-label">Detection audio</span>
                    <audio controls preload="none">
                        <source src="${audioUrl(detection.audio)}" type="audio/wav">
                        Your browser does not support the audio element.
                    </audio>
                `;
                caption.appendChild(audioWrap);
            }

            card.append(imageButton, caption);
            grid.appendChild(card);
        });
    }

    function renderMonthlyHighlights(data) {
        const grid = $("monthly-highlights-grid");

        if (!grid) return;

        grid.innerHTML = "";

        if (!Array.isArray(data) || !data.length) {
            grid.innerHTML = '<div class="loading-message">No qualifying radio highlights have been recorded this month yet.</div>';
            return;
        }

        data.slice(0, 12).forEach((d) => {
            const card = document.createElement("article");
            card.className = "detection-card monthly-highlight-card";

            const image = imageUrl(d.detail_image || d.full_image);

            card.innerHTML = `
                <button class="detection-image-button" type="button" aria-label="View radio detection spectrogram">
                    <img class="detection-image"
                         src="${image}"
                         alt="Meteor Radio spectrogram recorded ${formatDate(d.timestamp_utc)} at ${formatTime(d.timestamp_utc)} UTC"
                         loading="lazy">
                </button>

                <div class="detection-caption">
                    <p class="detection-category">HIGHLIGHTED RADIO ECHO</p>
                    <h3>${formatDate(d.timestamp_utc)} · ${formatTime(d.timestamp_utc)} UTC</h3>
                    <p>Strong radio detection selected from this month's observations.</p>

                    <div class="detection-metrics">
                        <div class="detection-metric">
                            <strong>${formatNumber(d.duration_seconds, 2)} s</strong>
                            <span>DURATION</span>
                        </div>
                        <div class="detection-metric">
                            <strong>${formatNumber(d.snr, 1)} dB</strong>
                            <span>SNR</span>
                        </div>
                        <div class="detection-metric">
                            <strong>${formatNumber(d.spectral_peak_frequency_hz, 0)} Hz</strong>
                            <span>PEAK OFFSET</span>
                        </div>
                    </div>

                    ${d.audio ? `
                        <div class="detection-audio">
                            <span class="detection-audio-label">Listen to recording</span>
                            <audio controls preload="none">
                                <source src="${audioUrl(d.audio)}" type="audio/wav">
                                Your browser does not support audio playback.
                            </audio>
                        </div>
                    ` : ""}
                </div>
            `;

            card.querySelector(".detection-image-button").addEventListener("click", () => {
                const highlightIndex = data.indexOf(d);
                openLightbox(highlightIndex, data);
            });

            grid.appendChild(card);
        });
    }

    function renderColourgramme(data) {
        const grid = $("colourgramme");
        grid.innerHTML = "";

        const now = new Date();

        const firstDay = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            1
        ));

        const daysInMonth = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            0
        )).getUTCDate();

        const days = [];

        for (let i = 0; i < daysInMonth; i++) {
            const date = new Date(firstDay);
            date.setUTCDate(date.getUTCDate() + i);
            days.push(date);
        }

        grid.style.gridTemplateColumns =
            `42px repeat(${days.length}, minmax(22px, 1fr))`;

        const counts = new Map();

        data.forEach(detection => {
            const date = parseDate(detection.timestamp_utc);
            if (!date) return;

            const key = `${date.toISOString().slice(0, 10)}-${date.getUTCHours()}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const visibleCounts = [];
        days.forEach(date => {
            const dateString = date.toISOString().slice(0, 10);
            for (let hour = 0; hour < 24; hour++) {
                visibleCounts.push(counts.get(`${dateString}-${hour}`) || 0);
            }
        });

        const maxCount = 100;
        const heatColours = [
            "#000004", "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60",
            "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"
        ];
        function heatColour(value) {
            if (value <= 0) return "#edf1f5";
            if (value >= 100) {
                return heatColours[heatColours.length - 1];
            }
            const position = Math.floor(
                (value / 100) * (heatColours.length - 1)
            );
            return heatColours[position];
        }

        const corner = document.createElement("div");
        corner.className = "colourgramme-header";
        corner.textContent = "UTC";
        grid.appendChild(corner);

        days.forEach(date => {
            const header = document.createElement("div");
            header.className = "colourgramme-header";

            const day = String(date.getUTCDate()).padStart(2, "0");
            header.textContent = day;
            header.title = date.toISOString().slice(0, 10);

            grid.appendChild(header);
        });

        for (let hour = 0; hour < 24; hour++) {
            const hourLabel = document.createElement("div");
            hourLabel.className = "colourgramme-hour";
            hourLabel.textContent = `${String(hour).padStart(2, "0")}:00`;
            grid.appendChild(hourLabel);

            days.forEach(date => {
                const dateString = date.toISOString().slice(0, 10);
                const key = `${dateString}-${hour}`;
                const count = counts.get(key) || 0;

                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "colourgramme-cell";
                cell.dataset.count = count;
                cell.title =
                    `${dateString} ${String(hour).padStart(2, "0")}:00 UTC — ` +
                    `${count} detection${count === 1 ? "" : "s"}`;

                cell.style.background = heatColour(count);

                if (count > 0 && count / maxCount < 0.35) {
                    cell.style.color = "#ffffff";
                }

                grid.appendChild(cell);
            });
        }

        const monthName = new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC"
        }).format(firstDay);

        $("activity-range").textContent = monthName;

        const monthPrefix = firstDay.toISOString().slice(0, 7);
        const monthDetections = data.filter(detection => {
            const date = parseDate(detection.timestamp_utc);
            return date && date.toISOString().slice(0, 7) === monthPrefix;
        }).length;

        $("activity-count").textContent =
            `${monthDetections} detection${monthDetections === 1 ? "" : "s"}`;
    }

    function renderHistoricalColourgramme(data) {
        const grid = $("historical-colourgramme");
        if (!grid) return;
        grid.innerHTML = "";

        const validDates = data
            .map(d => parseDate(d.timestamp_utc))
            .filter(Boolean)
            .map(date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())))
            .sort((a, b) => a - b);

        if (!validDates.length) {
            grid.innerHTML = '<div class="historical-empty">No historical activity data available.</div>';
            return;
        }

        const firstDay = validDates[0];
        const lastDay = validDates[validDates.length - 1];
        const days = [];
        for (const day = new Date(firstDay); day <= lastDay; day.setUTCDate(day.getUTCDate() + 1)) {
            days.push(new Date(day));
        }

        const counts = new Map();
        data.forEach(detection => {
            const date = parseDate(detection.timestamp_utc);
            if (!date) return;
            const key = `${date.toISOString().slice(0, 10)}-${date.getUTCHours()}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const maxCount = 100;
        const heatColours = [
            "#000004", "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60",
            "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"
        ];
        function heatColour(value) {
            if (value <= 0) return "#edf1f5";
            if (value >= 100) {
                return heatColours[heatColours.length - 1];
            }
            const position = Math.floor(
                (value / 100) * (heatColours.length - 1)
            );
            return heatColours[position];
        }

        const columns = 26; // month label, date, and 24 UTC hours
        grid.style.gridTemplateColumns = `150px 34px repeat(24, minmax(11px, 1fr))`;
        grid.style.gridTemplateRows = `28px repeat(${days.length}, 22px)`;
        grid.style.setProperty("--history-rows", days.length);

        const addCell = (className, text, row, column, rowSpan = 1) => {
            const cell = document.createElement("div");
            cell.className = className;
            cell.textContent = text;
            cell.style.gridRow = rowSpan > 1 ? `${row} / span ${rowSpan}` : String(row);
            cell.style.gridColumn = String(column);
            grid.appendChild(cell);
            return cell;
        };

        addCell("history-header", "MONTH", 1, 1);
        addCell("history-header history-date-header", "DATE", 1, 2);
        for (let hour = 0; hour < 24; hour++) {
            addCell("history-header history-hour-header", String(hour).padStart(2, "0"), 1, hour + 3);
        }

        let currentMonth = "";
        let monthStartIndex = 0;
        const monthGroups = [];
        days.forEach((date, index) => {
            const monthKey = date.toISOString().slice(0, 7);
            if (monthKey !== currentMonth) {
                if (currentMonth) monthGroups.push({ key: currentMonth, start: monthStartIndex, length: index - monthStartIndex });
                currentMonth = monthKey;
                monthStartIndex = index;
            }
        });
        monthGroups.push({ key: currentMonth, start: monthStartIndex, length: days.length - monthStartIndex });

        // Approximate annual activity windows and peak dates for major showers.
        // Dates are calendar guides; activity profiles are illustrative, not predictions.
        const meteorShowers = [
            { name: "Quadrantids", start: "12-28", peak: "01-03", end: "01-12" },
            { name: "Lyrids", start: "04-14", peak: "04-22", end: "04-30" },
            { name: "Eta Aquariids", start: "04-19", peak: "05-06", end: "05-28" },
            { name: "June Bootids", start: "06-22", peak: "06-27", end: "07-02" },
            { name: "Alpha Capricornids", start: "07-03", peak: "07-31", end: "08-15" },
            { name: "Southern Delta Aquariids", start: "07-12", peak: "07-31", end: "08-23" },
            { name: "Perseids", start: "07-17", peak: "08-13", end: "08-24" },
            { name: "Aurigids", start: "08-28", peak: "09-01", end: "09-05" },
            { name: "September epsilon-Perseids", start: "09-05", peak: "09-09", end: "09-21" },
            { name: "Southern Taurids", start: "09-10", peak: "11-05", end: "11-20" },
            { name: "Draconids", start: "10-06", peak: "10-09", end: "10-10" },
            { name: "Orionids", start: "10-02", peak: "10-21", end: "11-07" },
            { name: "Northern Taurids", start: "10-20", peak: "11-12", end: "12-10" },
            { name: "Leonids", start: "11-05", peak: "11-17", end: "11-30" },
            { name: "Geminids", start: "12-04", peak: "12-14", end: "12-17" },
            { name: "Ursids", start: "12-17", peak: "12-22", end: "12-26" }
        ];

        const dayNumber = date => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000;
        const dateForMonthDay = (year, monthDay) => {
            const [month, day] = monthDay.split("-").map(Number);
            return new Date(Date.UTC(year, month - 1, day));
        };
        // Keep the annotation visually restrained: shade only the three days
        // either side of each peak, with the strongest shade on the peak date.
        const showerActivity = date => {
            const year = date.getUTCFullYear();
            const current = dayNumber(date);
            let strongest = 0;
            const activeNames = [];
            const peakNames = [];
            meteorShowers.forEach(shower => {
                // Adjacent years handle showers whose peak is near New Year.
                for (const seasonYear of [year - 1, year, year + 1]) {
                    const peakDate = dateForMonthDay(seasonYear, shower.peak);
                    const peakDay = dayNumber(peakDate);
                    const distance = Math.abs(current - peakDay);
                    if (distance > 3) continue;
                    const intensity = 1 - distance / 4;
                    strongest = Math.max(strongest, intensity);
                    if (!activeNames.includes(shower.name)) activeNames.push(shower.name);
                    if (distance === 0 && !peakNames.includes(shower.name)) peakNames.push(shower.name);
                }
            });
            return { intensity: strongest, activeNames, peakNames };
        };

        days.forEach((date, index) => {
            const row = index + 2;
            const dateString = date.toISOString().slice(0, 10);
            const activity = showerActivity(date);
            const isFirstOfMonth = date.getUTCDate() === 1;
            const monthLabel = new Intl.DateTimeFormat("en-GB", {
                month: "short", year: "numeric", timeZone: "UTC"
            }).format(date);
            const monthText = activity.peakNames.length
                ? activity.peakNames.join(" · ")
                : (isFirstOfMonth ? monthLabel : "");
            const monthCell = addCell(
                activity.peakNames.length ? "history-month-label history-shower-peak" : "history-month-blank",
                monthText,
                row,
                1
            );
            if (activity.intensity > 0 && !activity.peakNames.length) {
                // Restrained gold shading, limited to three days either side of peak.
                const alpha = 0.12 + activity.intensity * 0.42;
                monthCell.style.backgroundColor = `rgba(224, 160, 32, ${alpha.toFixed(3)})`;
                monthCell.style.color = activity.intensity > 0.58 ? "#6b4200" : "#39485a";
                monthCell.title = `${activity.activeNames.join(", ")} near approximate peak; shading indicates proximity to peak`;
            }
            if (activity.peakNames.length) {
                monthCell.title = `${activity.peakNames.join(", ")} approximate peak date; surrounding three days shaded`;
                monthCell.setAttribute("aria-label", monthCell.title);
            } else if (isFirstOfMonth) {
                monthCell.title = `Start of ${new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)}`;
            }
            const dateCell = addCell("history-date", dateString.slice(8, 10), row, 2);
            dateCell.title = dateString;
            if (date.getUTCDay() === 0 || date.getUTCDay() === 6) dateCell.classList.add("history-weekend");

            for (let hour = 0; hour < 24; hour++) {
                const count = counts.get(`${dateString}-${hour}`) || 0;
                const cell = addCell("history-cell", "", row, hour + 3);
                cell.dataset.count = count;
                cell.style.backgroundColor = heatColour(count);
                cell.title = `${dateString} ${String(hour).padStart(2, "0")}:00–${String(hour).padStart(2, "0")}:59 UTC — ${count} detection${count === 1 ? "" : "s"}`;
                cell.setAttribute("aria-label", cell.title);
            }
        });

        const format = date => new Intl.DateTimeFormat("en-GB", {
            day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
        }).format(date);
        $("history-range").textContent = `${format(firstDay)} – ${format(lastDay)}`;
        $("history-count").textContent = `${data.length.toLocaleString("en-GB")} detections`;
    }

    function openLightbox(index, collection = detections) {
        if (!collection.length) return;

        lightboxDetections = collection;
        currentIndex = Math.max(0, Math.min(index, lightboxDetections.length - 1));

        const d = lightboxDetections[currentIndex];

        $("lightbox-image").src = imageUrl(d.detail_image || d.full_image);
        $("lightbox-image").alt = `Meteor Radio spectrogram recorded ${formatDate(d.timestamp_utc)} at ${formatTime(d.timestamp_utc)} UTC`;
        $("lightbox-title").textContent = `${formatDate(d.timestamp_utc)} · ${formatTime(d.timestamp_utc)} UTC`;
        $("lightbox-description").textContent = `Duration ${formatNumber(d.duration_seconds, 2)} s · SNR ${formatNumber(d.snr, 1)} dB · frequency offset ${formatNumber(d.spectral_peak_frequency_hz, 0)} Hz`;
        $("lightbox-date").textContent = `143.050 MHz GRAVES · MeteorRadio detection`;

        $("lightbox").classList.add("open");
        $("lightbox").setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
        $("lightbox").classList.remove("open");
        $("lightbox").setAttribute("aria-hidden", "true");
        $("lightbox-image").src = "";
        document.body.style.overflow = "";
    }

    function moveLightbox(step) {
        if (!lightboxDetections.length) return;

        currentIndex = (currentIndex + step + lightboxDetections.length) % lightboxDetections.length;
        openLightbox(currentIndex, lightboxDetections);
    }

    async function loadData() {
        try {
            const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            detections = sortNewestFirst(Array.isArray(json) ? json : (json.detections || []));

            if (json.station) $("station-name").textContent = json.station;
            if (json.source) $("station-source").textContent = json.source;

            renderStats(detections);
            renderCards(detections);
            renderMonthlyHighlights(json.monthly_highlights || []);
            renderColourgramme(detections);
            renderHistoricalColourgramme(detections);
        } catch (error) {
            console.error("Meteor Radio data error:", error);
            $("detection-grid").innerHTML = '<div class="error-message">Meteor Radio data is temporarily unavailable. Please try again later.</div>';
            $("timeline").innerHTML = '<div class="timeline-empty">Activity data is temporarily unavailable.</div>';
        }
    }

    $("lightbox-close").addEventListener("click", closeLightbox);
    $("lightbox-prev").addEventListener("click", () => moveLightbox(-1));
    $("lightbox-next").addEventListener("click", () => moveLightbox(1));
    $("lightbox").addEventListener("click", (event) => {
        if (event.target === $("lightbox")) closeLightbox();
    });
    document.addEventListener("keydown", (event) => {
        if (!$("lightbox").classList.contains("open")) return;
        if (event.key === "Escape") closeLightbox();
        if (event.key === "ArrowLeft") moveLightbox(-1);
        if (event.key === "ArrowRight") moveLightbox(1);
    });

    loadData();

    // Refresh Meteor Radio data every 5 minutes without reloading the page.
    setInterval(loadData, 5 * 60 * 1000);
})();
