(() => {

    // ------------------------------------------------------------
    // CBAT TOCP
    // ------------------------------------------------------------

    const list = document.getElementById("alerts-list");
    const updated = document.getElementById("alerts-updated");
    const filters = [...document.querySelectorAll(".alert-filter")];

    let alerts = [];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function formatDate(iso) {
        const date = new Date(iso);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/London"
        }) + " BST";
    }

    function render(filter = "all") {
        const visible = filter === "all"
            ? alerts
            : alerts.filter(alert => alert.category === filter);

        if (!visible.length) {
            list.innerHTML =
                '<div class="alert-empty">No recent reports in this category.</div>';
            return;
        }

        list.innerHTML = visible.map(alert => `
            <article class="alert-card">

                <div class="alert-card-top">

                    <span class="alert-type alert-type-${escapeHTML(alert.category)}">
                        ${escapeHTML(alert.typeLabel)}
                    </span>

                    <time datetime="${escapeHTML(alert.updated)}">
                        ${escapeHTML(formatDate(alert.updated))}
                    </time>

                </div>

                <h3>${escapeHTML(alert.designation || alert.title)}</h3>

                <p class="alert-meta">
                    ${alert.observationDate
                        ? `Observation: ${escapeHTML(alert.observationDate)}`
                        : ""}
                    ${alert.magnitude
                        ? ` · Magnitude: ${escapeHTML(alert.magnitude)}`
                        : ""}
                </p>

                <a class="text-link"
                   href="http://www.cbat.eps.harvard.edu/unconf/tocp.html"
                   target="_blank"
                   rel="noopener">
                    View original CBAT TOCP page →
                </a>

            </article>
        `).join("");
    }

    async function loadAlerts() {

        try {

            const response = await fetch(
                "data/cbat-tocp.json",
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            alerts = Array.isArray(data.entries)
                ? data.entries
                : [];

            if (data.generated) {
                updated.textContent =
                    `Feed checked ${formatDate(data.generated)}`;
            } else {
                updated.textContent = "Latest reports";
            }

            render("all");

        } catch (error) {

            console.error("CBAT TOCP:", error);

            updated.textContent =
                "Feed temporarily unavailable";

            list.innerHTML = `
                <div class="alert-empty">

                    The latest CBAT reports could not be loaded.

                    <a href="http://www.cbat.eps.harvard.edu/unconf/tocp.html"
                       target="_blank"
                       rel="noopener">
                        View the CBAT TOCP directly →
                    </a>

                </div>
            `;
        }
    }

    filters.forEach(button => {

        button.addEventListener("click", () => {

            filters.forEach(item =>
                item.classList.remove("active")
            );

            button.classList.add("active");

            render(button.dataset.filter);

        });

    });


    // ------------------------------------------------------------
    // COBS — Recent Comet Observations
    // ------------------------------------------------------------

    const cobsList = document.getElementById("cobs-list");
    const cobsUpdated = document.getElementById("cobs-updated");

    function formatCOBSDate(value) {

        if (!value) {
            return "Date unavailable";
        }

        // COBS supplies dates as:
        // YYYY-MM-DD HH:MM:SS
        const date = new Date(value.replace(" ", "T"));

        if (Number.isNaN(date.getTime())) {
            return escapeHTML(value);
        }

        return date.toLocaleString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/London"
        }) + " BST";
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

            const observations = Array.isArray(data.observations)
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

            cobsList.innerHTML = observations.map(observation => {

                const observer = observation.observer || "Observer not specified";

                const observerDetails = [
                    observer,
                    observation.country
                ].filter(Boolean).join(" — ");

                const magnitude = observation.magnitude
                    ? ` · Magnitude: ${escapeHTML(observation.magnitude)}`
                    : "";

                const location = observation.location
                    ? `<br>Location: ${escapeHTML(observation.location)}`
                    : "";

                const cobsUrl = observation.cobsUrl || "https://cobs.si/recent/";

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
                                    formatCOBSDate(
                                        observation.observationDate
                                    )
                                )}
                            </time>

                        </div>

                        <h3>${escapeHTML(observation.comet)}</h3>

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

                    The latest COBS comet observations could not be loaded.

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

    loadAlerts();
    loadCOBS();

    // Refresh both feeds every 5 minutes.
    // The GitHub Actions feeds update independently.
    setInterval(() => {
        loadAlerts();
        loadCOBS();
    }, 5 * 60 * 1000);

})();