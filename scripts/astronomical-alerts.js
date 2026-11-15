(() => {

    // ------------------------------------------------------------
    // Shared helpers
    // ------------------------------------------------------------

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function parseUTCDate(value) {
        if (!value) {
            return null;
        }

        let normalized = String(value)
            .trim()
            .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");

        if (/\s*UTC$/i.test(normalized)) {
            normalized = normalized.replace(/\s*UTC$/i, "Z");
        } else if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
            normalized += "Z";
        }

        const date = new Date(normalized);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(iso, fallback = "Date unavailable") {
        const date = parseUTCDate(iso);

        if (!date) {
            return fallback;
        }

        return date.toLocaleString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/London",
            timeZoneName: "short"
        });
    }


    // ------------------------------------------------------------
    // ESA NEOCC — Imminent Impactors
    // ------------------------------------------------------------

    const esaList =
        document.getElementById("esa-impactors-list");

    const esaUpdated =
        document.getElementById("esa-updated");

    function formatESAImpactDate(value) {
        if (!value) {
            return "Impact time unavailable";
        }

        return formatDate(value, String(value));
    }

    async function loadESAImpactors() {
        if (!esaList) {
            return;
        }

        try {
            const response = await fetch(
                "data/esa-imminent-impactors.json",
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            const observations =
                Array.isArray(data.observations)
                    ? data.observations
                    : [];

            // ----------------------------------------------------
            // Last update information
            // ----------------------------------------------------

            if (data.esaLastUpdate && data.generated) {
                esaUpdated.textContent =
                    `ESA source data last updated ${formatDate(
                        data.esaLastUpdate
                    )} · Feed checked ${formatDate(
                        data.generated
                    )}`;
            } else if (data.esaLastUpdate) {
                esaUpdated.textContent =
                    `ESA source data last updated ${formatDate(
                        data.esaLastUpdate
                    )}`;
            } else if (data.generated) {
                esaUpdated.textContent =
                    `Feed checked ${formatDate(
                        data.generated
                    )}`;
            } else {
                esaUpdated.textContent =
                    "Latest ESA information";
            }

            // ----------------------------------------------------
            // No imminent impactors
            // ----------------------------------------------------

            if (!observations.length) {
                esaList.innerHTML = `
                    <div class="alert-empty">
                        ESA NEOCC currently reports no confirmed
                        imminent impactors.
                    </div>
                `;

                return;
            }

            // ----------------------------------------------------
            // Render imminent impactors
            // ----------------------------------------------------

            esaList.innerHTML = observations.map(
                impactor => {
                    const designation =
                        impactor.designation ||
                        "Designation unavailable";

                    const impactDate =
                        impactor.impactDate ||
                        "";

                    const absoluteMagnitude =
                        impactor.absoluteMagnitude ||
                        "Not available";

                    const diameterRange =
                        impactor.diameterRange ||
                        "Not available";

                    const meerkatImage =
                        impactor.meerkatImage ||
                        "";

                    return `
                        <article class="esa-impactor-card">

                            <div class="esa-impactor-card-top">

                                <span class="alert-type alert-type-impactor">
                                    CONFIRMED IMPACTOR
                                </span>

                                <span class="esa-impact-status">
                                    100% impact probability
                                </span>

                            </div>

                            <h3>
                                ${escapeHTML(designation)}
                            </h3>

                            <div class="esa-impact-details">

                                <div class="esa-impact-detail">

                                    <span class="esa-detail-label">
                                        Nominal impact
                                    </span>

                                    <strong>
                                        ${escapeHTML(
                                            formatESAImpactDate(impactDate)
                                        )}
                                    </strong>

                                </div>

                                <div class="esa-impact-detail">

                                    <span class="esa-detail-label">
                                        Estimated diameter
                                    </span>

                                    <strong>
                                        ${escapeHTML(diameterRange)} m
                                    </strong>

                                </div>

                                <div class="esa-impact-detail">

                                    <span class="esa-detail-label">
                                        Absolute magnitude
                                    </span>

                                    <strong>
                                        ${escapeHTML(absoluteMagnitude)}
                                    </strong>

                                </div>

                            </div>

                            ${
                                meerkatImage
                                    ? `
                                        <div class="esa-meerkat">

                                            <img
                                                src="${escapeHTML(meerkatImage)}"
                                                alt="ESA NEOCC Meerkat impact plot for ${escapeHTML(designation)}"
                                                loading="lazy">

                                        </div>
                                      `
                                    : ""
                            }

                            <a
                                class="text-link"
                                href="https://neo.ssa.esa.int/imminent-impactors"
                                target="_blank"
                                rel="noopener">

                                View ESA NEOCC imminent impactors →

                            </a>

                        </article>
                    `;
                }
            ).join("");

        } catch (error) {

            console.error("ESA imminent impactors:", error);

            esaUpdated.textContent =
                "ESA data temporarily unavailable";

            esaList.innerHTML = `
                <div class="alert-empty">

                    The latest ESA imminent impactor
                    information could not be loaded.

                    <a
                        href="https://neo.ssa.esa.int/imminent-impactors"
                        target="_blank"
                        rel="noopener">

                        View ESA NEOCC directly →

                    </a>

                </div>
            `;
        }
    }


    // ------------------------------------------------------------
    // TNS — Recent transient announcements
    // ------------------------------------------------------------

    const tnsList =
        document.getElementById("tns-list");

    const tnsUpdated =
        document.getElementById("tns-updated");

    function formatTNSDate(value) {
        return formatDate(value, "Date unavailable");
    }

    function getTNSBadge(alert) {
        const classification = String(alert.classification || "").trim();
        const objectType = String(alert.objectType || alert.atType || "").trim();

        let label = "TRANSIENT";
        let cssClass = "alert-type-transient";

        if (classification) {
            label = classification;
        } else {
            switch (objectType) {
                case "SN":
                    label = "SUPERNOVA";
                    break;
                case "PSN":
                    label = "POSSIBLE SUPERNOVA";
                    break;
                case "PNV":
                    label = "POSSIBLE NOVA";
                    break;
                case "TDE":
                    label = "TIDAL DISRUPTION EVENT";
                    break;
                case "AT":
                    label = "ASTRONOMICAL TRANSIENT";
                    break;
                default:
                    label = "TRANSIENT";
            }
        }

        if (
            objectType === "SN" ||
            objectType === "PSN" ||
            /^SN\b/i.test(classification)
        ) {
            cssClass = "alert-type-supernova";
        } else if (
            objectType === "PNV" ||
            /\bnova\b/i.test(classification)
        ) {
            cssClass = "alert-type-nova";
        }

        return { label, cssClass };
    }

    async function loadTNS() {
        if (!tnsList) {
            return;
        }

        try {
            const response = await fetch(
                "data/tns-alerts.json",
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            const alerts =
                Array.isArray(data.alerts)
                    ? data.alerts
                    : [];

            // ----------------------------------------------------
            // Last update information
            // ----------------------------------------------------

            if (data.generated) {
                tnsUpdated.textContent =
                    `TNS data last updated ${formatDate(data.generated)}`;
            } else {
                tnsUpdated.textContent =
                    "Latest TNS announcements";
            }

            // ----------------------------------------------------
            // No alerts
            // ----------------------------------------------------

            if (!alerts.length) {
                tnsList.innerHTML = `
                    <div class="alert-empty">
                        No qualifying transient announcements
                        have been reported recently.
                    </div>
                `;

                return;
            }

            // ----------------------------------------------------
            // Render TNS alerts
            // ----------------------------------------------------

            tnsList.innerHTML = alerts.map(
                alert => {
                    const name =
                        alert.name ||
                        "Unnamed transient";

                    const badge = getTNSBadge(alert);

                    const objectUrl =
                        alert.url ||
                        "";

                    const received =
                        alert.receivedTimestamp ||
                        alert.received ||
                        "";

                    const receivedDisplay =
                        received
                            ? formatTNSDate(received)
                            : "Time unavailable";

                    const discoveryMagnitudeValue =
                        Number.parseFloat(alert.discoveryMag);

                    const metaLines = [];

                    if (alert.reportingGroup) {
                        metaLines.push(
                            `Reporting group: ${escapeHTML(alert.reportingGroup)}`
                        );
                    }

                    if (alert.classification) {
                        metaLines.push(
                            `Classification: ${escapeHTML(alert.classification)}`
                        );
                    }

                    if (Number.isFinite(discoveryMagnitudeValue)) {
                        metaLines.push(
                            `Discovery magnitude: ${discoveryMagnitudeValue.toFixed(2)} mag`
                        );
                    }

                    if (alert.objectId) {
                        metaLines.push(
                            `TNS ID: ${escapeHTML(alert.objectId)}`
                        );
                    }

                    return `
                        <article class="tns-alert-card">
                            <div class="tns-alert-card-top">
                                <span class="alert-type ${badge.cssClass}">
                                    ${escapeHTML(badge.label)}
                                </span>

                                <time datetime="${escapeHTML(received)}">
                                    Report received:
                                    ${escapeHTML(receivedDisplay)}
                                </time>
                            </div>

                            <h3>
                                ${
                                    objectUrl
                                        ? `
                                            <a
                                                href="${escapeHTML(objectUrl)}"
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                ${escapeHTML(name)}
                                            </a>
                                          `
                                        : escapeHTML(name)
                                }
                            </h3>

                            ${
                                metaLines.length
                                    ? `<p class="tns-meta">${metaLines.join("<br>")}</p>`
                                    : ""
                            }

                            ${
                                objectUrl
                                    ? `
                                        <a
                                            class="text-link"
                                            href="${escapeHTML(objectUrl)}"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            View full details at TNS →
                                        </a>
                                      `
                                    : ""
                            }
                        </article>
                    `;
                }
            ).join("");

        } catch (error) {
            console.error("TNS alerts:", error);

            tnsUpdated.textContent =
                "Feed temporarily unavailable";

            tnsList.innerHTML = `
                <div class="alert-empty">
                    The latest TNS announcements
                    could not be loaded.

                    <a
                        href="https://www.wis-tns.org/"
                        target="_blank"
                        rel="noopener"
                    >
                        View the TNS directly →
                    </a>
                </div>
            `;
        }
    }


    // ------------------------------------------------------------
    // COBS — Recent Comet Observations
    // ------------------------------------------------------------

    const cobsList =
        document.getElementById("cobs-list");

    const cobsUpdated =
        document.getElementById("cobs-updated");

    function formatCOBSDate(value) {
        if (!value) {
            return "Date unavailable";
        }

        return formatDate(value, String(value));
    }

    async function loadCOBS() {
        if (!cobsList) {
            return;
        }

        try {
            const response = await fetch(
                "data/cobs-observations.json",
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            const observations =
                Array.isArray(data.observations)
                    ? data.observations
                    : [];

            if (data.generated) {
                cobsUpdated.textContent =
                    `Feed checked ${formatDate(data.generated)}`;
            } else {
                cobsUpdated.textContent =
                    "Latest observations";
            }

            if (!observations.length) {
                cobsList.innerHTML =
                    '<div class="alert-empty">No recent comet observations are available.</div>';

                return;
            }

            cobsList.innerHTML =
                observations.map(observation => {
                    const observer =
                        observation.observer ||
                        "Observer not specified";

                    const observerDetails = [
                        observer,
                        observation.country
                    ]
                        .filter(Boolean)
                        .join(" — ");

                    const magnitude =
                        observation.magnitude
                            ? ` · Magnitude: ${escapeHTML(observation.magnitude)}`
                            : "";

                    const location =
                        observation.location
                            ? `<br>Location: ${escapeHTML(observation.location)}`
                            : "";

                    const cobsUrl =
                        observation.cobsUrl ||
                        "https://cobs.si/recent/";

                    return `
                        <article class="cobs-card">

                            <div class="cobs-card-top">

                                <span class="alert-type alert-type-comet">
                                    COMET OBSERVATION
                                </span>

                                <time datetime="${escapeHTML(
                                    observation.observationDate || ""
                                )}">
                                    ${escapeHTML(
                                        formatCOBSDate(observation.observationDate)
                                    )}
                                </time>

                            </div>

                            <h3>
                                ${escapeHTML(observation.comet)}
                            </h3>

                            <p class="cobs-meta">
                                Observer:
                                ${escapeHTML(observerDetails)}
                                ${location}
                                ${magnitude}
                            </p>

                            <a class="text-link"
                               href="${escapeHTML(cobsUrl)}"
                               target="_blank"
                               rel="noopener">
                                View observations on COBS →
                            </a>

                        </article>
                    `;
                }).join("");

        } catch (error) {

            console.error("COBS observations:", error);

            cobsUpdated.textContent =
                "Feed temporarily unavailable";

            cobsList.innerHTML = `
                <div class="alert-empty">

                    The latest COBS comet observations could not
                    be loaded.

                    <a href="https://cobs.si/recent/"
                       target="_blank"
                       rel="noopener">

                        View COBS directly →

                    </a>

                </div>
            `;
        }
    }


    // ------------------------------------------------------------
    // Initial load and automatic refresh
    // ------------------------------------------------------------

    loadESAImpactors();
    loadTNS();
    loadCOBS();

    // Refresh all three feeds every 5 minutes.
    setInterval(() => {
        loadESAImpactors();
        loadTNS();
        loadCOBS();
    }, 5 * 60 * 1000);

})();