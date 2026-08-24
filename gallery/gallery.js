const galleryGrid = document.getElementById("gallery-grid");
const galleryIntro = document.getElementById("gallery-intro");
const galleryFilters = document.getElementById("gallery-filters");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxVideo = document.getElementById("lightbox-video");
const lightboxCategory = document.getElementById("lightbox-category");
const lightboxTitle = document.getElementById("lightbox-title");
const lightboxDescription = document.getElementById("lightbox-description");
const lightboxDate = document.getElementById("lightbox-date");

const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");

let galleryData = null;
let galleryImages = [];
let visibleImages = [];
let currentIndex = 0;

let currentSection = null;
let currentCategory = null;
let currentSubcategory = null;


/* ==================================================
   LOAD GALLERY
   ================================================== */

async function loadGallery() {

    try {

        const response = await fetch("data/gallery.json");

        if (!response.ok) {
            throw new Error("Unable to load gallery data.");
        }

        galleryData = await response.json();

        galleryImages = galleryData.images || [];

        galleryIntro.textContent =
            galleryData.intro ||
            "A visual record of astronomical observations.";

        showSections();

    } catch (error) {

        console.error(error);

        galleryIntro.textContent =
            "The gallery could not be loaded.";

        galleryGrid.innerHTML = `
            <p class="gallery-error">
                Unable to load the gallery at this time.
            </p>
        `;
    }
}


/* ==================================================
   NAVIGATION
   ================================================== */

function clearNavigation(backFunction = showSections, backLabel = "Gallery") {

    galleryFilters.innerHTML = "";

    const backButton = document.createElement("button");

    backButton.type = "button";
    backButton.className = "gallery-filter gallery-back";
    backButton.textContent = `← ${backLabel}`;

    backButton.addEventListener("click", backFunction);

    galleryFilters.appendChild(backButton);
}


function showSections() {

    currentSection = null;
    currentCategory = null;
    currentSubcategory = null;

    galleryFilters.innerHTML = "";

    galleryGrid.innerHTML = "";

    const heading = document.createElement("div");
    heading.className = "gallery-navigation-heading";

    heading.innerHTML = `
        <span>Explore the gallery</span>
        <strong>Choose a subject</strong>
    `;

    galleryGrid.appendChild(heading);

    galleryData.sections.forEach(section => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "gallery-navigation-card";

        button.innerHTML = `
            <span class="gallery-navigation-number">
                ${section.id === "boundary-layer" ? "01" :
                  section.id === "solar-system" ? "02" : "03"}
            </span>

            <span class="gallery-navigation-title">
                ${section.title}
            </span>

            <span class="gallery-navigation-description">
                ${section.description || ""}
            </span>

            <span class="gallery-navigation-arrow">→</span>
        `;

        button.addEventListener("click", () => {
            showCategories(section.id);
        });

        galleryGrid.appendChild(button);

    });

}


function showCategories(sectionId) {

    const section =
        galleryData.sections.find(
            item => item.id === sectionId
        );

    if (!section) {
        return;
    }

    currentSection = sectionId;
    currentCategory = null;
    currentSubcategory = null;

    clearNavigation(
    showSections,
    "Gallery"
);

    galleryGrid.innerHTML = "";

    const heading = document.createElement("div");

    heading.className = "gallery-navigation-heading";

    heading.innerHTML = `
        <span>${section.title}</span>
        <strong>Choose a subject</strong>
    `;

    galleryGrid.appendChild(heading);

    section.categories.forEach(category => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "gallery-navigation-card";

        const hasChildren =
            Array.isArray(category.children) &&
            category.children.length > 0;

        button.innerHTML = `
            <span class="gallery-navigation-title">
                ${category.title}
            </span>

            <span class="gallery-navigation-description">
                ${hasChildren
                    ? `${category.children.length} subjects`
                    : ""}
            </span>

            <span class="gallery-navigation-arrow">→</span>
        `;

        button.addEventListener("click", () => {

            if (hasChildren) {
                showSubcategories(sectionId, category.id);
            } else {
                showImages(sectionId, category.id);
            }

        });

        galleryGrid.appendChild(button);

    });

}


function showSubcategories(sectionId, categoryId) {

    const section =
        galleryData.sections.find(
            item => item.id === sectionId
        );

    const category =
        section?.categories.find(
            item => item.id === categoryId
        );

    if (!category || !category.children) {
        return;
    }

    currentSection = sectionId;
    currentCategory = categoryId;
    currentSubcategory = null;

    clearNavigation(
    () => showCategories(sectionId),
    section.title
);

    galleryGrid.innerHTML = "";

    const heading = document.createElement("div");

    heading.className = "gallery-navigation-heading";

    heading.innerHTML = `
        <span>${section.title} / ${category.title}</span>
        <strong>Choose a planet</strong>
    `;

    galleryGrid.appendChild(heading);

    category.children.forEach(child => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "gallery-navigation-card";

        button.innerHTML = `
            <span class="gallery-navigation-title">
                ${child.title}
            </span>

            <span class="gallery-navigation-arrow">→</span>
        `;

        button.addEventListener("click", () => {

            showImages(
                sectionId,
                categoryId,
                child.id
            );

        });

        galleryGrid.appendChild(button);

    });

}


/* ==================================================
   IMAGE DISPLAY
   ================================================== */

function showImages(
    sectionId,
    categoryId,
    subcategoryId = null
) {

    currentSection = sectionId;
    currentCategory = categoryId;
    currentSubcategory = subcategoryId;

    const section =
        galleryData.sections.find(
            item => item.id === sectionId
        );

    const category =
        section?.categories.find(
            item => item.id === categoryId
        );

    if (subcategoryId) {

        // Individual planet → back to The Planets
        clearNavigation(
            () => showSubcategories(sectionId, categoryId),
            category?.title || "Back"
        );

    } else {

        // Category → back to its section
        clearNavigation(
            () => showCategories(sectionId),
            section?.title || "Back"
        );

    }

    let title = category?.title || "";

    if (subcategoryId && category?.children) {

        const child =
            category.children.find(
                item => item.id === subcategoryId
            );

        if (child) {
            title = child.title;
        }

    }

    const heading = document.createElement("div");

    heading.className = "gallery-navigation-heading";

    heading.innerHTML = `
        <span>${section?.title || ""}</span>
        <strong>${title}</strong>
    `;

    galleryGrid.innerHTML = "";
    galleryGrid.appendChild(heading);

    visibleImages = galleryImages.filter(image => {

        if (image.section !== sectionId) {
            return false;
        }

        if (image.category !== categoryId) {
            return false;
        }

        if (
            subcategoryId &&
            image.subcategory !== subcategoryId
        ) {
            return false;
        }

        return true;

    });

    if (visibleImages.length === 0) {

        const empty = document.createElement("p");

        empty.className = "gallery-empty";

        empty.textContent =
            "There are no photographs in this section yet.";

        galleryGrid.appendChild(empty);

        return;
    }

    visibleImages.forEach((image, index) => {

        const article = document.createElement("article");

        article.className = "gallery-card";

        const button = document.createElement("button");

        button.type = "button";
        button.className = "gallery-image-button";

        button.setAttribute(
            "aria-label",
            `Open ${image.title || "gallery image"}`
        );

        const img = document.createElement("img");

        img.className = "gallery-image";

        img.src =
            `images/${image.thumbnail || image.image}`;

        img.alt =
            image.title ||
            "Billingborough Observatory";

        img.loading = "lazy";

        button.appendChild(img);

        button.addEventListener(
            "click",
            () => openLightbox(index)
        );

        const caption = document.createElement("div");

        caption.className = "gallery-caption";

        const titleElement =
            document.createElement("h3");

        titleElement.textContent =
            image.title ||
            "Billingborough Observatory";

        caption.appendChild(titleElement);

        if (image.description) {

            const description =
                document.createElement("p");

            description.textContent =
                image.description;

            caption.appendChild(description);

        }

        if (image.date) {

            const date =
                document.createElement("p");

            date.className = "gallery-date";

            date.textContent =
                image.date;

            caption.appendChild(date);

        }

        article.appendChild(button);
        article.appendChild(caption);

        galleryGrid.appendChild(article);

    });

}


/* ==================================================
   LIGHTBOX
   ================================================== */

function openLightbox(index) {

    currentIndex = index;

    updateLightbox();

    lightbox.classList.add("open");

    lightbox.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "lightbox-open"
    );

}


function closeLightbox() {

    if (lightboxVideo) {
        lightboxVideo.pause();
        lightboxVideo.removeAttribute("src");
        lightboxVideo.load();
    }

    lightbox.classList.remove("open");

    lightbox.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "lightbox-open"
    );

}


function updateLightbox() {

    const image =
        visibleImages[currentIndex];

    if (!image) {
        return;
    }

    if (image.type === "video") {
    lightboxImage.style.display = "none";
    lightboxVideo.style.display = "block";

    lightboxVideo.src =
        `images/${image.video}`;

    lightboxVideo.poster =
        `images/${image.thumbnail}`;

    lightboxVideo.controls = true;
    lightboxVideo.playsInline = true;
    lightboxVideo.preload = "metadata";

    lightboxVideo.load();
}

    } else {

        lightboxVideo.pause();

        lightboxVideo.removeAttribute("src");

        lightboxVideo.style.display = "none";

        lightboxImage.style.display = "block";

        lightboxImage.src =
            `images/${image.image}`;

        lightboxImage.alt =
            image.title ||
            "Billingborough Observatory";
    }

    lightboxCategory.textContent =
        image.category || "";

    lightboxTitle.textContent =
        image.title ||
        "Billingborough Observatory";

    lightboxDescription.textContent =
        image.description || "";

    lightboxDate.textContent =
        image.date || "";

}


function previousImage() {

    if (!visibleImages.length) {
        return;
    }

    currentIndex =
        (currentIndex - 1 + visibleImages.length)
        % visibleImages.length;

    updateLightbox();

}


function nextImage() {

    if (!visibleImages.length) {
        return;
    }

    currentIndex =
        (currentIndex + 1)
        % visibleImages.length;

    updateLightbox();

}


/* ==================================================
   EVENTS
   ================================================== */

lightboxClose.addEventListener(
    "click",
    closeLightbox
);

lightboxPrev.addEventListener(
    "click",
    previousImage
);

lightboxNext.addEventListener(
    "click",
    nextImage
);

lightbox.addEventListener(
    "click",
    event => {

        if (event.target === lightbox) {
            closeLightbox();
        }

    }
);

document.addEventListener(
    "keydown",
    event => {

        if (!lightbox.classList.contains("open")) {
            return;
        }

        if (event.key === "Escape") {
            closeLightbox();
        }

        if (event.key === "ArrowLeft") {
            previousImage();
        }

        if (event.key === "ArrowRight") {
            nextImage();
        }

    }
);


/* ==================================================
   START
   ================================================== */

loadGallery();

console.log("GALLERY JS VERSION 7 LOADED");