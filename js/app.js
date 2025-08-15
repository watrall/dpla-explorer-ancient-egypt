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
                <a href="${linkUrl}" target="_blank" class="view-link">View Record</a>
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

    elements.listViewBtn.addEventListener('click', () => setView('list'));
    elements.compactImageViewBtn.addEventListener('click', () => setView('compact-image'));
    elements.tileViewBtn.addEventListener('click', () => setView('tile'));
    // ----------------------------------------------------


    // --- Search with Debouncing ---
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            appState.searchTerm = e.target.value.toLowerCase();
            appState.currentPage = 1; // Reset to first page on new search
            filterAndRender(); // Use the new filter-aware function
        }, SEARCH_DEBOUNCE_MS);
    });
    // ----------------------------


    // --- Pagination ---
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
    // ------------------


    // --- Faceted Filter Event Listeners ---
    // Handle multi-select for Type and Institution
    if (elements.typeFilterButton && elements.typeFilterMenu) {
        elements.typeFilterButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click listener from closing it immediately
            toggleDropdown(elements.typeFilterButton, elements.typeFilterMenu);
        });
    }

    if (elements.institutionFilterButton && elements.institutionFilterMenu) {
        elements.institutionFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(elements.institutionFilterButton, elements.institutionFilterMenu);
        });
    }

    // Handle single-select for Date
    if (elements.dateFilterButton && elements.dateFilterMenu) {
        elements.dateFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(elements.dateFilterButton, elements.dateFilterMenu);
        });
    }

    if (elements.dateFilterRadios.length > 0) {
        elements.dateFilterRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    appState.selectedDateRange = e.target.value;
                    // Update button text
                    const selectedLabel = e.target.parentElement.textContent.trim();
                    if (elements.dateFilterButton) {
                        elements.dateFilterButton.textContent = selectedLabel || 'All Dates';
                    }
                    appState.currentPage = 1;
                    filterAndRender(); // Use the new filter-aware function
                    updateUrlParams(); // Update URL on filter change
                    // Close the dropdown menu after selection
                    if (elements.dateFilterMenu) {
                        elements.dateFilterMenu.classList.remove('show');
                        elements.dateFilterButton?.setAttribute('aria-expanded', 'false');
                        elements.dateFilterButton?.classList.remove('active');
                    }
                }
            });
        });
    }

    if (elements.clearFiltersBtn) {
        elements.clearFiltersBtn.addEventListener('click', () => {
            appState.selectedTypes = [];
            appState.selectedInstitutions = [];
            appState.selectedDateRange = '';
            appState.searchTerm = '';
            appState.currentPage = 1;

            // Reset UI elements
            // Uncheck all checkboxes in type filter
            if (elements.typeFilterMenu) {
                const typeCheckboxes = elements.typeFilterMenu.querySelectorAll('input[type="checkbox"]');
                typeCheckboxes.forEach(cb => cb.checked = false);
            }
            // Uncheck all checkboxes in institution filter
            if (elements.institutionFilterMenu) {
                const instCheckboxes = elements.institutionFilterMenu.querySelectorAll('input[type="checkbox"]');
                instCheckboxes.forEach(cb => cb.checked = false);
            }
            // Reset date filter radio buttons
            if (elements.dateFilterRadios.length > 0) {
                elements.dateFilterRadios.forEach(radio => {
                    if (radio.value === '') {
                        radio.checked = true;
                        if (elements.dateFilterButton) {
                            elements.dateFilterButton.textContent = 'All Dates';
                        }
                    } else {
                        radio.checked = false;
                    }
                });
            }
            
            // Clear search input
            if (elements.searchInput) {
                elements.searchInput.value = '';
            }

            filterAndRender(); // Use the new filter-aware function
            updateUrlParams(); // Update URL to remove filter params
        });
    }
    // -------------------------------------
}

// --- Filter Logic ---

// Populate filter dropdowns with unique values from the dataset
function populateFilters() {
    // FIX: Check if allRecords exists and is an array before checking length
    if (!appState.allRecords || !Array.isArray(appState.allRecords) || appState.allRecords.length === 0) return;

    const types = new Set();
    const institutions = new Set();

    appState.allRecords.forEach(record => {
        // Extract types
        if (record.sourceResource?.type) {
            record.sourceResource.type.forEach(t => {
                if (t) types.add(t.trim());
            });
        }
        // Extract institutions (dataProvider.name)
        if (record.provider?.name) {
            institutions.add(record.provider.name.trim());
        }
    });

    // Populate Type Filter
    if (elements.typeFilterMenu) {
        // Clear existing options
        elements.typeFilterMenu.innerHTML = '';
        const sortedTypes = Array.from(types).sort();
        sortedTypes.forEach(type => {
            const li = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = type;
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!appState.selectedTypes.includes(type)) {
                        appState.selectedTypes.push(type);
                    }
                } else {
                    appState.selectedTypes = appState.selectedTypes.filter(t => t !== type);
                }
                appState.currentPage = 1;
                filterAndRender();
                updateUrlParams();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(type));
            li.appendChild(label);
            elements.typeFilterMenu.appendChild(li);
        });
    }

    // Populate Institution Filter
    if (elements.institutionFilterMenu) {
        // Clear existing options
        elements.institutionFilterMenu.innerHTML = '';
        const sortedInstitutions = Array.from(institutions).sort();
        sortedInstitutions.forEach(inst => {
            const li = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = inst;
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!appState.selectedInstitutions.includes(inst)) {
                        appState.selectedInstitutions.push(inst);
                    }
                } else {
                    appState.selectedInstitutions = appState.selectedInstitutions.filter(i => i !== inst);
                }
                appState.currentPage = 1;
                filterAndRender();
                updateUrlParams();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(inst));
            li.appendChild(label);
            elements.institutionFilterMenu.appendChild(li);
        });
    }

    // Date Filter options are predefined in HTML, no need to populate here.
}

// Apply search term and filters to get filteredRecords
function filterRecords() {
    let results = [...appState.allRecords];

    // 1. Apply search term filter
    if (appState.searchTerm) {
        results = results.filter(record =>
            (record.sourceResource?.title?.[0]?.toLowerCase().includes(appState.searchTerm)) ||
            (record.sourceResource?.description?.[0]?.toLowerCase().includes(appState.searchTerm)) ||
            (record.sourceResource?.subject?.some(subject => subject.toLowerCase().includes(appState.searchTerm))) ||
            (record.sourceResource?.spatial?.some(spatial => spatial.toLowerCase().includes(appState.searchTerm)))
        );
    }

    // 2. Apply Type filter (AND logic between selected types)
    if (appState.selectedTypes.length > 0) {
        results = results.filter(record => {
            const recordTypes = record.sourceResource?.type || [];
            // Check if the record has ANY of the selected types
            return appState.selectedTypes.some(selectedType =>
                recordTypes.includes(selectedType)
            );
        });
    }

    // 3. Apply Institution filter (AND logic between selected institutions)
    if (appState.selectedInstitutions.length > 0) {
        results = results.filter(record =>
            appState.selectedInstitutions.includes(record.provider?.name)
        );
    }

    // 4. Apply Date Range filter (single select)
    if (appState.selectedDateRange && DATE_RANGES[appState.selectedDateRange]) {
        const range = DATE_RANGES[appState.selectedDateRange];
        results = results.filter(record => {
            // Try to get a usable date string from sourceResource.date
            const dateStr = record.sourceResource?.date?.[0];
            if (!dateStr) return false; // If no date, it doesn't match any range filter

            // Attempt to extract a year from the date string
            // This is a simple extraction, real API data might need more robust parsing
            const yearMatch = dateStr.match(/\d{4}/);
            if (!yearMatch) return false; // If no 4-digit year found, can't filter

            const year = parseInt(yearMatch[0], 10);
            if (isNaN(year)) return false;

            // Check if year falls within the selected range
            const isAfterStart = range.start ? year >= range.start : true;
            const isBeforeEnd = range.end ? year <= range.end : true;
            return isAfterStart && isBeforeEnd;
        });
    }

    return results;
}

// Central function to apply filters and re-render
function filterAndRender() {
    appState.filteredRecords = filterRecords();
    renderCurrentView();
}
// ------------------


// --- URL Parameter Handling ---
function updateUrlParams() {
    const url = new URL(window.location);
    const params = url.searchParams;

    // Update or remove params based on current state
    if (appState.selectedTypes.length > 0) {
        params.set('types', appState.selectedTypes.join(','));
    } else {
        params.delete('types');
    }

    if (appState.selectedInstitutions.length > 0) {
        params.set('institutions', appState.selectedInstitutions.join(','));
    } else {
        params.delete('institutions');
    }

    if (appState.selectedDateRange) {
        params.set('date', appState.selectedDateRange);
    } else {
        params.delete('date');
    }

    // Note: Updating the URL without page reload
    window.history.replaceState({}, '', url);
}

// TODO: Implement reading initial filter state from URL on page load
// This requires integrating with the data loading sequence in initApp
// function readUrlParams() { ... }
// ----------------------------


// --- Initialization ---

async function initApp() {
    lucide.createIcons();

    setupEventListeners();

    // --- Update Initial Active Button State ---
    elements.listViewBtn.classList.remove('active');
    elements.compactImageViewBtn.classList.remove('active');
    elements.tileViewBtn.classList.add('active'); // Set Tile View as default active
    // ---------------------------------------

    const fullDataset = await fetchAllDplaRecords();

    if (fullDataset && Array.isArray(fullDataset)) {
        appState.allRecords = fullDataset;
        appState.filteredRecords = [...appState.allRecords]; // Initially, no filter
        // --- Populate Filters after data is loaded ---
        populateFilters();
        // --------------------------------------------
        renderCurrentView(); // This will render the first page of the 'tile' view
        showElement(elements.contentArea);
        console.log("Application initialized successfully with real DPLA data.");
    } else if (!appState.hasError && !appState.isLoading) {
         // If fetch failed but no error was set, and we are not still loading, it's unexpected
         console.warn("Fetch did not return data and no error was set. This is unusual.");
         // Fallback to local generation if cache and fetch both failed unexpectedly
         console.log("Falling back to local demo data generation.");
         appState.allRecords = generateDemoData(DEMO_RECORD_COUNT);
         appState.filteredRecords = [...appState.allRecords];
         // --- Populate Filters after fallback data is generated ---
         populateFilters();
         // --------------------------------------------------------
         renderCurrentView();
         showElement(elements.contentArea);
         saveFullDatasetToCache(appState.allRecords);
    }
    // If there was an error, setError(true) would have been called and UI updated
    // If still loading, the load success will trigger the render.
}

// --- Demo Data Generator (MVP Placeholder) ---
function generateDemoData(count) {
    const types = ['image', 'text', 'physical object', 'moving image', 'sound', 'dataset'];
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

        // Simulate having or not having an image
        const hasImage = Math.random() > 0.2; // 80% chance of having an image
        const imageUrl = hasImage ? `https://picsum.photos/seed/egypt  ${i}/300/200` : null; // Using Picsum for placeholder images

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
            isShownAt: `https://example.com/record/  ${i}`, // Placeholder link
            object: imageUrl // DPLA thumbnail URL field
        });
    }
    return data;
}


// --- Start the App ---
document.addEventListener('DOMContentLoaded', initApp);