// js/app.js

// --- Configuration ---
// --- UPDATE THIS TO YOUR DIGITALOCEAN FUNCTION INVOKE URL ---
const API_PROXY_URL = 'https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-db103013-6f04-45ed-9d08-869494cf2959/default/dpla-api-proxy  ';
// -------------------------------------------------------------------------

const CACHE_DURATION_HOURS = 24;
const DEFAULT_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300; // Debounce search input
const DEMO_RECORD_COUNT = 200; // Total number of demo records to generate

// --- Simplified Ancient Egypt Keywords ---
const ANCIENT_EGYPT_KEYWORDS = [
    "Egypt--Antiquities",
    "Egypt--History--To 332 B.C.",
    "ancient egypt",
    "egyptian",
    "pharaoh",
    "tutankhamun",
    "cleopatra",
    "pyramids",
    "mummies",
    "hieroglyphics",
    "egyptology",
    "Giza",
    "Luxor",
    "Thebes",
    "Karnak",
    "Valley of the Kings",
    "Abu Simbel",
    "Memphis",
    "Nile",
    "sphinx",
    "rosetta stone",
    "ramesses",
    "hatshepsut",
    "akhmenaten"
];

// --- Date Range Definitions ---
const DATE_RANGES = {
    "before-1800": { start: null, end: 1799 },
    "1800-1900": { start: 1800, end: 1900 },
    "1900-1950": { start: 1900, end: 1950 },
    "1950-2000": { start: 1950, end: 2000 },
    "after-2000": { start: 2001, end: null }
};
// ----------------------------

// --- State Management ---
let appState = {
    allRecords: [],
    filteredRecords: [],
    // --- Update Initial View to Tile View ---
    currentView: 'tile', // 'list', 'compact-image', or 'tile'
    // -----------------------------------------
    currentPage: 1,
    itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
    searchTerm: '',
    // --- Filter State ---
    selectedTypes: [],
    selectedInstitutions: [],
    selectedDateRange: '',
    // ------------------
    isLoading: false,
    hasError: false
};

// --- DOM Elements ---
const elements = {
    listViewBtn: document.getElementById('listViewBtn'),
    // --- Add Compact Image Button Element ---
    compactImageViewBtn: document.getElementById('compactImageViewBtn'), // <-- Added
    // -------------------------------------
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
    totalPagesNum: document.getElementById('totalPagesNum'),
    // --- Filter Elements (Custom UI) ---
    typeFilterButton: document.querySelector('#typeFilterContainer .dropdown-button'),
    typeFilterMenu: document.querySelector('#typeFilterContainer .dropdown-menu'),
    typeFilterSelect: document.getElementById('typeFilter'), // Hidden select
    institutionFilterButton: document.querySelector('#institutionFilterContainer .dropdown-button'),
    institutionFilterMenu: document.querySelector('#institutionFilterContainer .dropdown-menu'),
    institutionFilterSelect: document.getElementById('institutionFilter'), // Hidden select
    dateFilterButton: document.querySelector('#dateFilterContainer .dropdown-button'),
    dateFilterMenu: document.querySelector('#dateFilterContainer .dropdown-menu'),
    dateFilterSelect: document.getElementById('dateFilter'), // Hidden select
    dateFilterRadios: document.querySelectorAll('input[name="dateFilterGroup"]'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn')
    // ----------------------------------
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
const FULL_DATASET_CACHE_KEY = 'dpla_egypt_full_dataset_demo_v3'; // Updated cache key to force refresh

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
        if (isCacheValid(cachedItem) && Array.isArray(cachedItem.data)) {
            console.log("Loaded valid full dataset from cache.");
            return cachedItem.data;
        } else {
            console.warn("Cached data is invalid or corrupted. Removing.");
            localStorage.removeItem(FULL_DATASET_CACHE_KEY);
            return null;
        }
    } catch (e) {
        console.warn("Could not load full dataset from localStorage", e);
        return null;
    }
}

// --- API Interaction (Real DPLA Data via DigitalOcean Function) ---

// Build simpler search query to avoid API limits
function buildSearchQuery() {
    // Join keywords with OR, but limit the number to avoid query length issues
    const limitedKeywords = ANCIENT_EGYPT_KEYWORDS.slice(0, 10);
    const queryParts = limitedKeywords.map(keyword => `"${keyword}"`).join(' OR ');
    console.log("Built search query:", queryParts);
    return queryParts;
}

async function fetchAllDplaRecords() {
    // Force refresh by clearing old cache
    localStorage.removeItem('dpla_egypt_full_dataset_demo');
    localStorage.removeItem('dpla_egypt_full_dataset_demo_v2');
    
    let allRecords = loadFullDatasetFromCache();
    
    if (allRecords) {
        console.log("Using cached data with", allRecords.length, "records");
        return allRecords;
    }
    
    setLoading(true);
    setError(false);
    
    try {
        console.log("Fetching all records from DPLA API via DigitalOcean proxy...");
        
        // Build simpler search query
        const searchQuery = buildSearchQuery();
        
        // First, get the total count
        const countUrl = new URL(API_PROXY_URL);
        countUrl.searchParams.set('endpoint', 'items');
        countUrl.searchParams.set('q', searchQuery);
        countUrl.searchParams.set('page_size', '0'); // Just get count
        
        console.log("Fetching record count with URL:", countUrl.toString());
        
        const countResponse = await fetch(countUrl.toString());
        if (!countResponse.ok) {
            const errorText = await countResponse.text();
            console.error("API Error Response:", errorText);
            throw new Error(`Failed to get record count: ${countResponse.status} - ${errorText}`);
        }
        
        const countData = await countResponse.json();
        const totalRecords = countData.count;
        console.log(`Total records to fetch: ${totalRecords}`);
        
        if (totalRecords === 0) {
            console.log("No records found with the search query");
            return [];
        }
        
        // Now fetch all records in batches
        const batchSize = 100;
        const totalPages = Math.ceil(totalRecords / batchSize);
        let allDocs = [];
        
        console.log(`Fetching ${Math.min(totalPages, 20)} pages of data...`); // Limit to 20 pages
        
        for (let page = 1; page <= Math.min(totalPages, 20); page++) {
            const proxyUrl = new URL(API_PROXY_URL);
            proxyUrl.searchParams.set('endpoint', 'items');
            proxyUrl.searchParams.set('q', searchQuery);
            proxyUrl.searchParams.set('page_size', batchSize.toString());
            proxyUrl.searchParams.set('page', page.toString());
            
            console.log(`Fetching page ${page} of ${Math.min(totalPages, 20)}...`);
            
            const response = await fetch(proxyUrl.toString());
            if (!response.ok) {
                console.error(`Failed to fetch page ${page}: ${response.status}`);
                // Continue with next page instead of failing completely
                continue;
            }
            
            const data = await response.json();
            if (data && Array.isArray(data.docs)) {
                allDocs = allDocs.concat(data.docs);
                console.log(`Fetched ${data.docs.length} records from page ${page}`);
            } else {
                console.warn(`No docs found in page ${page} response`);
            }
            
            // Add a small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        allRecords = allDocs;
        console.log(`Successfully fetched ${allRecords.length} total records from DPLA.`);
        saveFullDatasetToCache(allRecords); // Cache the fetched data
        return allRecords;
        
    } catch (error) {
        console.error("Error fetching full dataset:", error);
        setError(true);
        // Try fallback approach with a simpler query
        try {
            console.log("Trying fallback approach with simpler query...");
            const fallbackQuery = '"ancient egypt" OR "egyptian"';
            const fallbackUrl = new URL(API_PROXY_URL);
            fallbackUrl.searchParams.set('endpoint', 'items');
            fallbackUrl.searchParams.set('q', fallbackQuery);
            fallbackUrl.searchParams.set('page_size', '100');
            
            const fallbackResponse = await fetch(fallbackUrl.toString());
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData && Array.isArray(fallbackData.docs)) {
                    console.log(`Fallback successful, fetched ${fallbackData.docs.length} records`);
                    saveFullDatasetToCache(fallbackData.docs);
                    return fallbackData.docs;
                }
            }
        } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError);
        }
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
        // Use DPLA record URL instead of institution URL
        const linkUrl = record.id ? `https://dp.la/item/${record.id}` : '#';

        // Truncate description for list view
        const truncatedDescription = description.length > 200 ? description.substring(0, 200) + '...' : description;

        itemElement.innerHTML = `
            <h3>${title}</h3>
            <p>${truncatedDescription}</p>
            <p class="provider">Provider: ${provider}</p>
            <a href="${linkUrl}" target="_blank" class="view-link">View Record on the DPLA</a>
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
        // Use DPLA record URL instead of institution URL
        const linkUrl = record.id ? `https://dp.la/item/${record.id}` : '#';
        const imageUrl = record.object; // DPLA thumbnail URL
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}" onerror="this.style.display='none'">`;
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
                <a href="${linkUrl}" target="_blank" class="view-link">View Record on the DPLA</a>
            </div>
        `;
        gridElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(gridElement);

    lucide.createIcons();
}

// --- Add Compact Image View Rendering Function ---
function renderCompactImageView(records) {
    const listElement = document.createElement('ul');
    listElement.className = 'compact-image-view'; // Use the new CSS class

    const headerRow = document.createElement('li');
    headerRow.className = 'compact-image-header';
    headerRow.innerHTML = `
        <div class="civ-col-image"></div>
        <div class="civ-col-title">Title</div>
        <div class="civ-col-description">Description</div>
        <div class="civ-col-date">Date Added</div>
        <div class="civ-col-institution">Institution</div>
        <div class="civ-col-link"></div>
    `;
    listElement.appendChild(headerRow);

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'compact-image-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const description = record.sourceResource?.description?.[0] || 'No description available.';
        const institution = record.provider?.name || 'Unknown Institution';
        // Use DPLA record URL instead of institution URL
        const linkUrl = record.id ? `https://dp.la/item/${record.id}` : '#';
        const imageUrl = record.object; // DPLA thumbnail URL
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}" onerror="this.style.display='none'">`;
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

        // Truncate description for compact image view
        const truncatedDescription = description.length > 150 ? description.substring(0, 150) + '...' : description;

        itemElement.innerHTML = `
            <div class="civ-col-image">
                <div class="civ-image-container">
                    ${imageHtml}
                </div>
            </div>
            <div class="civ-col-title">${title}</div>
            <div class="civ-col-description">${truncatedDescription}</div>
            <div class="civ-col-date">${new Date().toLocaleDateString()}</div> <!-- Placeholder -->
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
    updatePaginationControls(appState.filteredRecords.length); // Total count for pagination
}

// --- Dropdown Toggle Function ---
function toggleDropdown(button, menu) {
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    
    // Close all dropdowns first
    document.querySelectorAll('.custom-dropdown .dropdown-menu').forEach(dropdown => {
        dropdown.classList.remove('show');
        const dropdownButton = dropdown.previousElementSibling;
        if (dropdownButton) {
            dropdownButton.setAttribute('aria-expanded', 'false');
            dropdownButton.classList.remove('active');
        }
    });
    
    // Toggle the clicked dropdown
    if (!isExpanded) {
        menu.classList.add('show');
        button.setAttribute('aria-expanded', 'true');
        button.classList.add('active');
    } else {
        menu.classList.remove('show');
        button.setAttribute('aria-expanded', 'false');
        button.classList.remove('active');
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown .dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
            const button = menu.previousElementSibling;
            if (button) {
                button.setAttribute('aria-expanded', 'false');
                button.classList.remove('active');
            }
        });
    }
});
// ------------------------------

// --- Event Handlers ---

function setupEventListeners() {
    // --- Updated View Toggle Logic for Three Views ---
    function setView(viewName) {
        appState.currentView = viewName;

        // Update button states: only one active at a time
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

    elements.listView