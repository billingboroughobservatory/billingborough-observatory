const galleryGrid = document.getElementById("gallery-grid");
const galleryIntro = document.getElementById("gallery-intro");
const galleryFilters = document.getElementById("gallery-filters");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxCategory = document.getElementById("lightbox-category");
const lightboxTitle = document.getElementById("lightbox-title");
const lightboxDescription = document.getElementById("lightbox-description");
const lightboxDate = document.getElementById("lightbox-date");

const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");

let galleryImages = [];
let visibleImages = [];
let currentIndex = 0;
let activeCategory = "All";


async function loadGallery() {

    try {

        const response = await fetch("data/gallery.json");

        if (!response.ok) {
            throw new Error("Unable to load gallery data.");
        }

        const data = await response.json();

        galleryImages = data.images || [];

        galleryIntro.textContent =
            data.intro ||
            "A visual record of Billingborough Observatory.";

        buildFilters();

        renderGallery();

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


function buildFilters() {

    const categories = [
        "All",
        ...new Set(
            galleryImages
                .map(image => image.category)
                .filter(Boolean)
        )
    ];

    galleryFilters.innerHTML = "";

    categories.forEach(category => {

        const button = document.createElement("button");

        button.type = "button";

        button.className =
            "gallery-filter" +
            (category === activeCategory ? " active" : "");

        button.textContent = category;

        button.addEventListener("click", () => {

            activeCategory = category;

            document
                .querySelectorAll(".gallery-filter")
                .forEach(filter => {
                    filter.classList.remove("active");
                });

            button.classList.add("active");

            renderGallery();

        });

        galleryFilters.appendChild(button);

    });
}


function renderGallery() {

    galleryGrid.innerHTML = "";

    visibleImages =
        activeCategory === "All"
            ? galleryImages
            : galleryImages.filter(
                image => image.category === activeCategory
            );

    visibleImages.forEach((image, index) => {

        const article = document.createElement("article");

        article.className = "gallery-card";

        const button = document.createElement("button");

        button.type = "button";

        button.className = "gallery-image-button";

        button.setAttribute(
            "aria-label",
            `Open ${image.caption || "gallery image"}`
        );

        const img = document.createElement("img");

        img.className = "gallery-image";

        img.src = `images/${image.thumbnail || image.image}`;

        img.alt = image.caption || "Billingborough Observatory";

        img.loading = "lazy";

        button.appendChild(img);

        button.addEventListener("click", () => {
            openLightbox(index);
        });


        const caption = document.createElement("div");

        caption.className = "gallery-caption";


        if (image.category) {

            const category = document.createElement("p");

            category.className = "gallery-category";

            category.textContent = image.category;

            caption.appendChild(category);

        }


        const title = document.createElement("h3");

        title.textContent =
            image.caption || "Billingborough Observatory";

        caption.appendChild(title);


        if (image.description) {

            const description = document.createElement("p");

            description.textContent = image.description;

            caption.appendChild(description);

        }


        if (image.date) {

            const date = document.createElement("p");

            date.className = "gallery-date";

            date.textContent = image.date;

            caption.appendChild(date);

        }


        article.appendChild(button);

        article.appendChild(caption);

        galleryGrid.appendChild(article);

    });
}


function openLightbox(index) {

    currentIndex = index;

    updateLightbox();

    lightbox.classList.add("open");

    lightbox.setAttribute("aria-hidden", "false");

    document.body.classList.add("lightbox-open");

}


function closeLightbox() {

    lightbox.classList.remove("open");

    lightbox.setAttribute("aria-hidden", "true");

    document.body.classList.remove("lightbox-open");

}


function updateLightbox() {

    const image = visibleImages[currentIndex];

    if (!image) {
        return;
    }

    lightboxImage.src =
        `images/${image.image}`;

    lightboxImage.alt =
        image.caption || "Billingborough Observatory";


    lightboxCategory.textContent =
        image.category || "";


    lightboxTitle.textContent =
        image.caption || "Billingborough Observatory";


    lightboxDescription.textContent =
        image.description || "";


    lightboxDate.textContent =
        image.date || "";

}


function showPrevious() {

    if (!visibleImages.length) {
        return;
    }

    currentIndex =
        (currentIndex - 1 + visibleImages.length) %
        visibleImages.length;

    updateLightbox();

}


function showNext() {

    if (!visibleImages.length) {
        return;
    }

    currentIndex =
        (currentIndex + 1) %
        visibleImages.length;

    updateLightbox();

}


lightboxClose.addEventListener(
    "click",
    closeLightbox
);


lightboxPrev.addEventListener(
    "click",
    showPrevious
);


lightboxNext.addEventListener(
    "click",
    showNext
);


lightbox.addEventListener("click", event => {

    if (event.target === lightbox) {
        closeLightbox();
    }

});


document.addEventListener("keydown", event => {

    if (!lightbox.classList.contains("open")) {
        return;
    }

    if (event.key === "Escape") {
        closeLightbox();
    }

    if (event.key === "ArrowLeft") {
        showPrevious();
    }

    if (event.key === "ArrowRight") {
        showNext();
    }

});


loadGallery();