// js/app.js

// --- Configuration ---
const API_PROXY_URL = 'https://YOUR_FUNCTION_REGION.functions.app/dpla-proxy'; // Placeholder
const CACHE_DURATION_HOURS = 24;
const DEFAULT_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300; // Debounce search input

// --- State Management ---
let appState = {
    allRecords: [], // Full dataset fetched from API
    filteredRecords: [], // Records after applying search filter
    currentView: 'list', // 'list' or 'tile'
    currentPage: 1,
    itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
    searchTerm: '',
    isLoading: false,
    hasError: false
};

// --- DOM Elements ---
const elements = {
    listViewBtn: document.getElementById('listViewBtn'),
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

function getCacheKey(query, page, perPage) {
    return `dpla_egypt_${query}_page${page}_per${perPage}`;
}

function isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    const now = new Date().getTime();
    const cacheAgeHours = (now - cachedData.timestamp) / (1000 * 60 * 60);
    return cacheAgeHours < CACHE_DURATION_HOURS;
}

function saveToCache(key, data) {
    try {
        const cacheItem = {
            timestamp: new Date().getTime(),
             data
        };
        localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (e) {
        console.warn("Could not save to localStorage", e);
        // Fail silently, app should still work
    }
}

function loadFromCache(key) {
    try {
        const cachedItem = JSON.parse(localStorage.getItem(key));
        if (isCacheValid(cachedItem)) {
            return cachedItem.data;
        } else {
            localStorage.removeItem(key); // Remove expired cache
            return null;
        }
    } catch (e) {
        console.warn("Could not load from localStorage", e);
        return null;
    }
}

// --- API Interaction (Placeholder/Demo) ---

// Simulate fetching data from the DigitalOcean proxy function
async function fetchDplaData(query = "ancient egypt", page = 1, perPage = DEFAULT_ITEMS_PER_PAGE) {
    const cacheKey = getCacheKey(query, page, perPage);
    const cachedData = loadFromCache(cacheKey);

    if (cachedData) {
        console.log("Loaded data from cache for key:", cacheKey);
        return cachedData;
    }

    setLoading(true);
    setError(false);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        // In a real scenario, you would call the DigitalOcean function:
        // const response = await fetch(API_PROXY_URL, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ query, page, perPage })
        // });
        // if (!response.ok) throw new Error(`API error: ${response.status}`);
        // const data = await response.json();

        // For MVP, use demo data
        const demoData = generateDemoData(200); // Generate 200 demo records
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const paginatedData = demoData.slice(start, end);

        const result = {
            total: demoData.length,
            currentPage: page,
            itemsPerPage: perPage,
             paginatedData
        };

        saveToCache(cacheKey, result);
        return result;

    } catch (error) {
        console.error("Error fetching data:", error);
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
    } else {
        renderTileView(recordsToShow);
    }
    updatePaginationControls(appState.filteredRecords.length);
}


// --- Event Handlers ---

function setupEventListeners() {
    // View Toggle
    elements.listViewBtn.addEventListener('click', () => {
        appState.currentView = 'list';
        elements.listViewBtn.classList.add('active');
        elements.tileViewBtn.classList.remove('active');
        renderCurrentView();
    });

    elements.tileViewBtn.addEventListener('click', () => {
        appState.currentView = 'tile';
        elements.tileViewBtn.classList.add('active');
        elements.listViewBtn.classList.remove('active');
        renderCurrentView();
    });

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
        // Note: In a full implementation fetching from API, this would trigger a new fetch.
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
        appState.filteredRecords = [...appState.allRecords]; // Shallow copy
    }
    appState.currentPage = 1; // Reset to first page after filtering
    renderCurrentView();
}

// --- Initialization ---

async function initApp() {
    // Initialize Lucide icons on page load (including those in the view toggle buttons)
    lucide.createIcons();

    setupEventListeners();

    // Initial data fetch (for MVP, this is demo data)
    const initialData = await fetchDplaData(); // Uses default "ancient egypt" query
    if (initialData && initialData.data) {
        appState.allRecords = initialData.data;
        appState.filteredRecords = [...appState.allRecords]; // Initially, no filter
        renderCurrentView();
        showElement(elements.contentArea);
    } else if (!appState.hasError) {
         // If fetch failed but no error was set, it might be due to cache miss and network issue in demo
         // For demo, we can generate data locally if fetch fails unexpectedly
         console.log("Initial fetch failed or returned no data, using local generation.");
         appState.allRecords = generateDemoData(100);
         appState.filteredRecords = [...appState.allRecords];
         renderCurrentView();
         showElement(elements.contentArea);
    }
    // If there was an error, setError(true) would have been called and UI updated
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