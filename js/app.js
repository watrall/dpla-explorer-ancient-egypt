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
    // --- Updated Default View ---
    currentView: 'tile', // 'list', 'compact-image', or 'tile'
    // ------------------
    currentPage: 1,
    itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
    searchTerm: '',
    isLoading: false,
    hasError: false
};

// --- DOM Elements ---
const elements = {
    listViewBtn: document.getElementById('listViewBtn'),
    compactImageViewBtn: document.getElementById('compactImageViewBtn'),
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
             data
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
    let fullDataset = loadFullDatasetFromCache();

    if (fullDataset) {
        return fullDataset;
    }

    setLoading(true);
    setError(false);

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        console.log("Generating new demo dataset...");
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
        const imageUrl = record.object;
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}">`;
        } else {
            let iconName = 'file';
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

    lucide.createIcons();
}

// --- Renamed and Updated Compact Image View Rendering Function ---
function renderCompactImageView(records) {
    const listElement = document.createElement('ul');
    listElement.className = 'compact-image-view';

    // Add header row
    const headerRow = document.createElement('li');
    headerRow.className = 'compact-image-header';
    headerRow.innerHTML = `
        <div class="civ-col-image"></div> <!-- Empty header for image column -->
        <div class="civ-col-title">Title</div>
        <div class="civ-col-description">Description</div>
        <div class="civ-col-date">Date Added</div>
        <div class="civ-col-institution">Institution</div>
        <div class="civ-col-link"></div> <!-- Empty header for link column -->
    `;
    listElement.appendChild(headerRow);

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'compact-image-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        // Use full description for compact view
        const description = record.sourceResource?.description?.[0] || 'No description available.';
        // Use provider.name as Partner Institution
        const institution = record.provider?.name || 'Unknown Institution';
        const linkUrl = record.isShownAt || '#';
        const imageUrl = record.object;
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}">`;
        } else {
            let iconName = 'file';
            if (resourceType.includes('image')) iconName = 'image';
            else if (resourceType.includes('text')) iconName = 'file-text';
            else if (resourceType.includes('physical')) iconName = 'gallery-vertical-end';
            else if (resourceType.includes('moving')) iconName = 'film';
            else if (resourceType.includes('sound')) iconName = 'music';
            else if (resourceType.includes('dataset')) iconName = 'database';

            imageHtml = `<i data-lucide="${iconName}" class="icon-placeholder"></i>`;
        }

        // --- Simulate Date Added ---
        // In a real app, this would come from the DPLA record (e.g., record.timestamp or similar)
        // For demo, we'll generate a plausible date within the last few years.
        const randomDaysAgo = Math.floor(Math.random() * 365 * 3); // Up to 3 years ago
        const dateAdded = new Date();
        dateAdded.setDate(dateAdded.getDate() - randomDaysAgo);
        const formattedDate = dateAdded.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        // --------------------------

        itemElement.innerHTML = `
            <div class="civ-col-image">
                <div class="civ-image-container">
                    ${imageHtml}
                </div>
            </div>
            <div class="civ-col-title">${title}</div>
            <div class="civ-col-description">${description}</div>
            <div class="civ-col-date">${formattedDate}</div>
            <div class="civ-col-institution">${institution}</div>
            <div class="civ-col-link">
                <a href="${linkUrl}" target="_blank" aria-label="View Record on DPLA">
                    <i data-lucide="square-arrow-out-up-right"></i>
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
// ---------------------------------------------------------------------


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
    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    const recordsToShow = appState.filteredRecords.slice(start, end);

    if (appState.currentView === 'list') {
        renderListView(recordsToShow);
    } else if (appState.currentView === 'tile') {
        renderTileView(recordsToShow);
    } else if (appState.currentView === 'compact-image') {
        renderCompactImageView(recordsToShow);
    }
    updatePaginationControls(appState.filteredRecords.length);
}


// --- Event Handlers ---

function setupEventListeners() {
    // --- Updated View Toggle Logic ---
    function setView(viewName) {
        appState.currentView = viewName;

        // Ensure ONLY the correct button is active
        elements.listViewBtn.classList.remove('active');
        elements.compactImageViewBtn.classList.remove('active');
        elements.tileViewBtn.classList.remove('active');

        if (viewName === 'list') {
            elements.listViewBtn.classList.add('active');
        } else if (viewName === 'compact-image') {
            elements.compactImageViewBtn.classList.add('active');
        } else if (viewName === 'tile') {
            elements.tileViewBtn.classList.add('active');
        }

        renderCurrentView();
    }

    elements.listViewBtn.addEventListener('click', () => setView('list'));
    elements.compactImageViewBtn.addEventListener('click', () => setView('compact-image'));
    elements.tileViewBtn.addEventListener('click', () => setView('tile'));
    // ---------------------------------


    // Search with Debouncing
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            appState.searchTerm = e.target.value.toLowerCase();
            appState.currentPage = 1;
            filterAndRender();
        }, SEARCH_DEBOUNCE_MS);
    });

    // Pagination
    elements.itemsPerPageSelect.addEventListener('change', (e) => {
        appState.itemsPerPage = parseInt(e.target.value, 10);
        appState.currentPage = 1;
        renderCurrentView();
    });

    elements.prevPageBtn.addEventListener('click', () => {
        if (appState.currentPage > 1) {
            appState.currentPage--;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    elements.nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(appState.filteredRecords.length / appState.itemsPerPage);
        if (appState.currentPage < totalPages) {
            appState.currentPage++;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        appState.filteredRecords = [...appState.allRecords];
    }
    appState.currentPage = 1;
    renderCurrentView();
}

// --- Initialization ---

async function initApp() {
    lucide.createIcons();

    setupEventListeners();

    // --- Updated Initial Active Button ---
    // Ensure the correct button is active on load based on the default view
    elements.listViewBtn.classList.remove('active');
    elements.compactImageViewBtn.classList.remove('active');
    elements.tileViewBtn.classList.add('active'); // Set Tile View button as active by default
    // ------------------------------------

    const fullDataset = await fetchFullDplaDataset();

    if (fullDataset && Array.isArray(fullDataset)) {
        appState.allRecords = fullDataset;
        appState.filteredRecords = [...appState.allRecords];
        renderCurrentView(); // This will now render the 'tile' view by default
        showElement(elements.contentArea);
        console.log("Application initialized successfully with demo data.");
    } else if (!appState.hasError && !appState.isLoading) {
         console.warn("Fetch did not return data and no error was set. This is unusual.");
         console.log("Falling back to local demo data generation.");
         appState.allRecords = generateDemoData(DEMO_RECORD_COUNT);
         appState.filteredRecords = [...appState.allRecords];
         renderCurrentView();
         showElement(elements.contentArea);
         saveFullDatasetToCache(appState.allRecords);
    }
}

// --- Demo Data Generator (MVP Placeholder) ---
function generateDemoData(count) {
    const types = ['image', 'text', 'physical object', 'moving image', 'sound', 'dataset'];
    // Expanded list of institutions for variety
    const providers = [
        'Internet Archive', 'Smithsonian Institution', 'New York Public Library',
        'Library of Congress', 'British Museum', 'Metropolitan Museum of Art',
        'Getty Research Institute', 'Harvard University', 'Yale University',
        'University of California Libraries', 'Digital Public Library of America'
    ];
    const titles = [
        "The Great Pyramid of Giza", "Tutankhamun's Tomb", "Hieroglyphics Decoded",
        "Papyrus of Ani", "Temple of Karnak", "Valley of the Kings Map",
        "Egyptian Mummy Portrait", "Rosetta Stone Fragment", "Sphinx of Giza",
        "Ancient Egyptian Pottery", "Pharaoh Ramesses II Statue", "Nile River Flood Cycle",
        "Book of the Dead Scroll", "Canopic Jars", "Egyptian Chariot Model",
        "Obelisk of Heliopolis", "Temple of Abu Simbel", "Cartouche of Cleopatra",
        "Egyptian Solar Barque", "Mortuary Temple of Hatshepsut",
        "Tomb of Seti I", "Dendera Zodiac", "Colossi of Memnon", "Temple of Hatshepsut",
        "Egyptian Book of the Dead", "Amarna Period Artifacts", "Pyramid of Djoser",
        "Temple of Luxor", "Egyptian Sarcophagus", "Ancient Egyptian Jewelry"
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
        "Ruins of the mortuary temple built for Queen Hatshepsut at Deir el-Bahri.",
        "Excavation report and photographs from the tomb of Seti I in the Valley of the Kings.",
        "Detailed astronomical map of the zodiac ceiling from the Temple of Dendera.",
        "Photographs and drawings of the two massive stone statues of Pharaoh Amenhotep III.",
        "Architectural drawings and historical context of the mortuary temple of Hatshepsut.",
        "Digital facsimile and commentary on the Egyptian Book of the Dead papyri.",
        "Artifacts and analysis from the Amarna period, showcasing Akhenaten's religious reforms.",
        "Archaeological report on the Step Pyramid of Djoser, the world's oldest stone pyramid.",
        "Historical documentation and images of the Temple of Luxor and its obelisks.",
        "Detailed examination of an ancient Egyptian sarcophagus and its inscriptions.",
        "Catalog of ancient Egyptian jewelry, including pieces from royal tombs."
    ];

    const data = [];
    for (let i = 1; i <= count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const provider = providers[Math.floor(Math.random() * providers.length)];
        const title = titles[Math.floor(Math.random() * titles.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];

        const hasImage = Math.random() > 0.2;
        const imageUrl = hasImage ? `https://picsum.photos/seed/egypt${i}/150/100` : null; // Smaller image for list view

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
            isShownAt: `https://example.com/record/${i}`,
            object: imageUrl
        });
    }
    return data;
}


// --- Start the App ---
document.addEventListener('DOMContentLoaded', initApp);