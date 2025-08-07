// js/app.js

// --- Configuration ---
const API_PROXY_URL = 'https://YOUR_FUNCTION_REGION.functions.app/dpla-proxy'; // Placeholder
const CACHE_DURATION_HOURS = 24;
const DEFAULT_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300; // Debounce search input
const DEMO_RECORD_COUNT = 200; // Total number of demo records to generate

// --- State Management ---
let appState = {
    allRecords: [],
    filteredRecords: [],
    // --- Update Initial View to Compact Card ---
    currentView: 'compact-card', // 'list', 'compact-card', or 'tile' // <-- Changed default
    // -----------------------------------------
    currentPage: 1,
    itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
    searchTerm: '',
    isLoading: false,
    hasError: false
};

// --- DOM Elements ---
const elements = {
    listViewBtn: document.getElementById('listViewBtn'),
    compactCardViewBtn: document.getElementById('compactCardViewBtn'),
    tileViewBtn: document.getElementById('tileViewBtn'),
    searchInput: document.getElementById('searchInput'),
    contentArea: document.getElementById('contentArea'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    errorMessage: document.getElementById('errorMessage'),
    paginationControls: document.getElementById('paginationControls'),
    itemsPerPageSelect: document.getElementById('itemsPerPage'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    currentPageNum: document.getElementById('currentPageNum'),
    totalPagesNum: document.getElementById('totalPagesNum')
};

// --- Utility Functions ---

function showElement(el) {
    el.classList.remove('hidden');
}

function hideElement(el) {
    el.classList.add('hidden');
}

function setLoading(isLoading) {
    appState.isLoading = isLoading;
    if (isLoading) {
        showElement(elements.loadingSpinner);
        hideElement(elements.contentArea);
        hideElement(elements.errorMessage);
        hideElement(elements.paginationControls);
    } else {
        hideElement(elements.loadingSpinner);
    }
}

function setError(hasError) {
    appState.hasError = hasError;
    if (hasError) {
        showElement(elements.errorMessage);
        hideElement(elements.contentArea);
        hideElement(elements.loadingSpinner);
        hideElement(elements.paginationControls);
    } else {
        hideElement(elements.errorMessage);
    }
}

// --- Cache Management (using localStorage) ---
const FULL_DATASET_CACHE_KEY = 'dpla_egypt_full_dataset_demo';

function isCacheValid(cachedItem) {
    if (!cachedItem || !cachedItem.timestamp) return false;
    const now = new Date().getTime();
    const cacheAgeHours = (now - cachedItem.timestamp) / (1000 * 60 * 60);
    return cacheAgeHours < CACHE_DURATION_HOURS;
}

function saveFullDatasetToCache(data) {
    try {
        const cacheItem = {
            timestamp: new Date().getTime(),
            data: data // Store the full array directly
        };
        localStorage.setItem(FULL_DATASET_CACHE_KEY, JSON.stringify(cacheItem));
        console.log("Full dataset saved to cache.");
    } catch (e) {
        console.warn("Could not save full dataset to localStorage", e);
    }
}

function loadFullDatasetFromCache() {
    try {
        const cachedItemString = localStorage.getItem(FULL_DATASET_CACHE_KEY);
        if (!cachedItemString) {
            console.log("No cached dataset found.");
            return null;
        }
        const cachedItem = JSON.parse(cachedItemString);
        if (isCacheValid(cachedItem)) {
            console.log("Loaded full dataset from cache.");
            // Return the data array directly, as that's what we stored
            return cachedItem.data;
        } else {
            console.log("Cached dataset expired, removing.");
            localStorage.removeItem(FULL_DATASET_CACHE_KEY);
            return null;
        }
    } catch (e) {
        console.warn("Could not load full dataset from localStorage", e);
        return null;
    }
}

// --- API Interaction (Placeholder/Demo) ---

async function fetchFullDplaDataset() {
    // For MVP, we primarily care about the full dataset for search/filtering
    // Pagination on the full set can be done client-side.
    // Let's try to load the full set first.

    let fullDataset = loadFullDatasetFromCache();

    if (fullDataset) {
        return fullDataset;
    }

    setLoading(true);
    setError(false);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        console.log("Generating new demo dataset...");
        // In a real scenario, you would call the DigitalOcean function here
        // to get the *full* set of "ancient egypt" records.
        fullDataset = generateDemoData(DEMO_RECORD_COUNT);
        saveFullDatasetToCache(fullDataset);
        return fullDataset;

    } catch (error) {
        console.error("Error fetching full dataset:", error);
        setError(true);
        return null;
    } finally {
        setLoading(false);
    }
}

// --- View Rendering ---

function renderListView(records) {
    const listElement = document.createElement('ul');
    listElement.className = 'list-view';

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'list-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const description = record.sourceResource?.description?.[0] || 'No description available.';
        const provider = record.provider?.name || 'Unknown Provider';
        const linkUrl = record.isShownAt || '#';

        // Truncate description for list view
        const truncatedDescription = description.length > 200 ? description.substring(0, 200) + '...' : description;

        itemElement.innerHTML = `
            <h3>${title}</h3>
            <p>${truncatedDescription}</p>
            <p class="provider">Provider: ${provider}</p>
            <a href="${linkUrl}" target="_blank" class="view-link">View Record</a>
        `;
        listElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(listElement);
}

function renderTileView(records) {
    const gridElement = document.createElement('ul');
    gridElement.className = 'tile-view';

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'tile-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const provider = record.provider?.name || 'Unknown Provider';
        const linkUrl = record.isShownAt || '#';
        const imageUrl = record.object; // DPLA thumbnail URL
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}">`;
        } else {
            // Determine icon based on type
            let iconName = 'file'; // Default
            if (resourceType.includes('image')) iconName = 'image';
            else if (resourceType.includes('text')) iconName = 'file-text';
            else if (resourceType.includes('physical')) iconName = 'gallery-vertical-end';
            else if (resourceType.includes('moving')) iconName = 'film';
            else if (resourceType.includes('sound')) iconName = 'music';
            else if (resourceType.includes('dataset')) iconName = 'database';

            imageHtml = `<i data-lucide="${iconName}" class="icon-placeholder"></i>`;
        }

        itemElement.innerHTML = `
            <div class="tile-image-container">
                ${imageHtml}
            </div>
            <div class="tile-content">
                <h3>${title}</h3>
                <p class="provider">${provider}</p>
                <a href="${linkUrl}" target="_blank" class="view-link">View Record</a>
            </div>
        `;
        gridElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(gridElement);

    // Initialize Lucide icons for the newly added elements (including placeholders)
    lucide.createIcons();
}

// --- Add Compact Card View Rendering Function ---
function renderCompactCardView(records) {
    const listElement = document.createElement('ul');
    listElement.className = 'compact-card-view'; // Use the new CSS class

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'compact-card-item'; // Use the new CSS class

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const description = record.sourceResource?.description?.[0] || 'No description available.';
        const provider = record.provider?.name || 'Unknown Provider';
        const linkUrl = record.isShownAt || '#';
        const imageUrl = record.object; // DPLA thumbnail URL
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}">`;
        } else {
            // Determine icon based on type (same logic as tile view)
            let iconName = 'file'; // Default
            if (resourceType.includes('image')) iconName = 'image';
            else if (resourceType.includes('text')) iconName = 'file-text';
            else if (resourceType.includes('physical')) iconName = 'gallery-vertical-end';
            else if (resourceType.includes('moving')) iconName = 'film';
            else if (resourceType.includes('sound')) iconName = 'music';
            else if (resourceType.includes('dataset')) iconName = 'database';

            imageHtml = `<i data-lucide="${iconName}" class="icon-placeholder"></i>`;
        }

        // Truncate description for compact card view
        const truncatedDescription = description.length > 150 ? description.substring(0, 150) + '...' : description;

        itemElement.innerHTML = `
            <div class="compact-card-image-container">
                ${imageHtml}
            </div>
            <div class="compact-card-content">
                <h3>${title}</h3>
                <p class="description">${truncatedDescription}</p>
                <p class="provider">Provider: ${provider}</p>
                <a href="${linkUrl}" target="_blank" class="view-link">
                    View Record
                    <i data-lucide="square-arrow-out-up-right"></i> <!-- Link icon -->
                </a>
            </div>
        `;
        listElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(listElement);

    // Initialize Lucide icons for the newly added elements (including placeholders and link icons)
    lucide.createIcons();
}
// -------------------------------------------------


function updatePaginationControls(totalRecords) {
    const totalPages = Math.ceil(totalRecords / appState.itemsPerPage);
    elements.totalPagesNum.textContent = totalPages;
    elements.currentPageNum.textContent = appState.currentPage;

    elements.prevPageBtn.disabled = appState.currentPage <= 1;
    elements.nextPageBtn.disabled = appState.currentPage >= totalPages;

    if (totalPages > 0) {
        showElement(elements.paginationControls);
    } else {
        hideElement(elements.paginationControls);
    }
}

function renderCurrentView() {
    // Calculate records to show based on current page and items per page
    // This operates on the `filteredRecords` array
    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    const recordsToShow = appState.filteredRecords.slice(start, end);

    if (appState.currentView === 'list') {
        renderListView(recordsToShow);
    } else if (appState.currentView === 'tile') { // <-- Added 'tile' check
        renderTileView(recordsToShow);
    } else if (appState.currentView === 'compact-card') { // <-- Added 'compact-card' check
        renderCompactCardView(recordsToShow);
    }
    updatePaginationControls(appState.filteredRecords.length); // Total count for pagination
}


// --- Event Handlers ---

function setupEventListeners() {
    // --- Corrected View Toggle Logic ---
    function setView(viewName) {
        appState.currentView = viewName;

        // Ensure ONLY the correct button is active
        elements.listViewBtn.classList.remove('active');
        elements.compactCardViewBtn.classList.remove('active');
        elements.tileViewBtn.classList.remove('active');

        if (viewName === 'list') {
            elements.listViewBtn.classList.add('active');
        } else if (viewName === 'compact-card') {
            elements.compactCardViewBtn.classList.add('active');
        } else if (viewName === 'tile') {
            elements.tileViewBtn.classList.add('active');
        }

        renderCurrentView();
    }

    elements.listViewBtn.addEventListener('click', () => setView('list'));
    elements.compactCardViewBtn.addEventListener('click', () => setView('compact-card'));
    elements.tileViewBtn.addEventListener('click', () => setView('tile'));
    // ---------------------------------


    // Search with Debouncing
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            appState.searchTerm = e.target.value.toLowerCase();
            appState.currentPage = 1; // Reset to first page on new search
            filterAndRender();
        }, SEARCH_DEBOUNCE_MS);
    });

    // Pagination
    elements.itemsPerPageSelect.addEventListener('change', (e) => {
        appState.itemsPerPage = parseInt(e.target.value, 10);
        appState.currentPage = 1; // Reset to first page
        renderCurrentView(); // Re-render with new page size
    });

    elements.prevPageBtn.addEventListener('click', () => {
        if (appState.currentPage > 1) {
            appState.currentPage--;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
        }
    });

    elements.nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(appState.filteredRecords.length / appState.itemsPerPage);
        if (appState.currentPage < totalPages) {
            appState.currentPage++;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
        }
    });
}

function filterAndRender() {
    if (appState.searchTerm) {
        appState.filteredRecords = appState.allRecords.filter(record =>
            (record.sourceResource?.title?.[0]?.toLowerCase().includes(appState.searchTerm)) ||
            (record.sourceResource?.description?.[0]?.toLowerCase().includes(appState.searchTerm))
        );
    } else {
        appState.filteredRecords = [...appState.allRecords]; // Shallow copy of all records
    }
    appState.currentPage = 1; // Reset to first page after filtering
    renderCurrentView();
}

// --- Initialization ---

async function initApp() {
    // Initialize Lucide icons on page load (including those in the view toggle buttons)
    lucide.createIcons();

    setupEventListeners();

    // --- Ensure Correct Button is Active on Load ---
    // Based on the initial appState.currentView ('compact-card')
    // The setView function handles this correctly now, so we can just call it.
    // Alternatively, set the initial state directly:
    elements.listViewBtn.classList.remove('active');
    elements.compactCardViewBtn.classList.add('active'); // Set Compact Card View button as active by default
    elements.tileViewBtn.classList.remove('active');
    // ----------------------------------------------

    // --- Fetch the full dataset ---
    const fullDataset = await fetchFullDplaDataset();

    if (fullDataset && Array.isArray(fullDataset)) {
        appState.allRecords = fullDataset;
        appState.filteredRecords = [...appState.allRecords]; // Initially, no filter
        renderCurrentView(); // This will render the first page of the 'compact-card' view
        showElement(elements.contentArea);
        console.log("Application initialized successfully with demo data.");
    } else if (!appState.hasError && !appState.isLoading) {
         // If fetch failed but no error was set, and we are not still loading, it's unexpected
         console.warn("Fetch did not return data and no error was set. This is unusual.");
         // Fallback to local generation if cache and fetch both failed unexpectedly
         console.log("Falling back to local demo data generation.");
         appState.allRecords = generateDemoData(DEMO_RECORD_COUNT);
         appState.filteredRecords = [...appState.allRecords];
         renderCurrentView();
         showElement(elements.contentArea);
         // Save this fallback generation to cache for next time
         saveFullDatasetToCache(appState.allRecords);
    }
    // If there was an error, setError(true) would have been called and UI updated
    // If still loading, the load success will trigger the render.
}

// --- Demo Data Generator (MVP Placeholder) ---
function generateDemoData(count) {
    const types = ['image', 'text', 'physical object', 'moving image', 'sound', 'dataset'];
    const providers = ['Internet Archive', 'Smithsonian Institution', 'New York Public Library', 'Library of Congress', 'British Museum'];
    const titles = [
        "The Great Pyramid of Giza", "Tutankhamun's Tomb", "Hieroglyphics Decoded",
        "Papyrus of Ani", "Temple of Karnak", "Valley of the Kings Map",
        "Egyptian Mummy Portrait", "Rosetta Stone Fragment", "Sphinx of Giza",
        "Ancient Egyptian Pottery", "Pharaoh Ramesses II Statue", "Nile River Flood Cycle",
        "Book of the Dead Scroll", "Canopic Jars", "Egyptian Chariot Model",
        "Obelisk of Heliopolis", "Temple of Abu Simbel", "Cartouche of Cleopatra",
        "Egyptian Solar Barque", "Mortuary Temple of Hatshepsut"
    ];
    const descriptions = [
        "A detailed study of the construction techniques used in the Great Pyramid.",
        "Artifacts and findings from the discovery of Tutankhamun's intact tomb.",
        "Analysis of the decipherment of Egyptian hieroglyphs using the Rosetta Stone.",
        "Digital scan and translation of the Papyrus of Ani, part of the Book of the Dead.",
        "Architectural plans and historical context of the Temple of Karnak complex.",
        "Geological survey map of the Valley of the Kings excavation sites.",
        "Portrait of a young man, painted on wood, found in an Egyptian mummy wrappings.",
        "High-resolution image of a fragment of the stone bearing inscriptions in three scripts.",
        "Photograph of the limestone statue of the Great Sphinx, restored in recent years.",
        "Collection of pottery shards illustrating daily life in ancient Egyptian villages.",
        "Granite sculpture of the powerful pharaoh Ramesses II, now in the British Museum.",
        "Illustration depicting the annual flooding of the Nile and its impact on agriculture.",
        "Facsimile of a page from the Book of the Dead, showing spells for the afterlife.",
        "Set of four limestone canopic jars used to store mummified organs.",
        "Miniature wooden model of a chariot, found in the tomb of an Egyptian noble.",
        "Historical engraving of the tall obelisk originally erected in Heliopolis.",
        "Panoramic view of the rock-cut temples of Abu Simbel before relocation.",
        "Inscription of Cleopatra VII's royal cartouche found on a temple wall.",
        "Reconstruction of the mythical solar barque used by Ra in Egyptian mythology.",
        "Ruins of the mortuary temple built for Queen Hatshepsut at Deir el-Bahri."
    ];

    const data = [];
    for (let i = 1; i <= count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const provider = providers[Math.floor(Math.random() * providers.length)];
        const title = titles[Math.floor(Math.random() * titles.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];

        // Simulate having or not having an image
        const hasImage = Math.random() > 0.2; // 80% chance of having an image
        const imageUrl = hasImage ? `https://picsum.photos/seed/egypt${i}/300/200` : null; // Using Picsum for placeholder images

        data.push({
            id: `demo-record-${i}`,
            sourceResource: {
                title: [title],
                description: [description],
                type: [type]
            },
            provider: {
                name: provider
            },
            isShownAt: `https://example.com/record/${i}`, // Placeholder link
            object: imageUrl // DPLA thumbnail URL field
        });
    }
    return data;
}


// --- Start the App ---
document.addEventListener('DOMContentLoaded', initApp);